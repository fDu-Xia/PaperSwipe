package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
)

func TestReaderPreferencesAndSelection(t *testing.T) {
	p := normalizePreferences(ReaderPreferences{Identity: "injected", Complexity: 99, DiscoveryStyle: "bad"})
	if p.Identity != "graduate" || p.Complexity != 3 || p.DiscoveryStyle != "focus" {
		t.Fatal(p)
	}
	easy := readerInstructions(withPreferences(context.Background(), ReaderPreferences{Identity: "enthusiast", Complexity: 1}))
	expert := readerInstructions(withPreferences(context.Background(), ReaderPreferences{Identity: "researcher", Complexity: 5}))
	if !strings.Contains(easy, "非专业爱好者") || !strings.Contains(easy, "日常语言") || !strings.Contains(expert, "可复现性") || !strings.Contains(expert, "比较条件") {
		t.Fatal("preferences not reflected in prompts")
	}
	papers := []Paper{{ID: "1", Title: "memory memory", Fields: []string{"A"}}, {ID: "2", Title: "memory technique", Fields: []string{"A"}}, {ID: "3", Title: "memory study", Fields: []string{"B"}}}
	focus := selectForReader(papers, "memory", 2, ReaderPreferences{DiscoveryStyle: "focus"})
	broad := selectForReader(papers, "memory", 2, ReaderPreferences{DiscoveryStyle: "broaden"})
	if focus[1].ID != "2" || broad[1].ID != "3" {
		t.Fatalf("focus=%v broad=%v", focus, broad)
	}
}

func TestRetrySummaryAndPersistence(t *testing.T) {
	var prompt string
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Messages []struct {
				Content string `json:"content"`
			} `json:"messages"`
		}
		json.NewDecoder(r.Body).Decode(&req)
		prompt = req.Messages[1].Content
		content := `{"papers":[{"id":"p1","hook":"先查资料再回答可以减少编造。","verdict":"需要核对原文","method":"先检索再生成"}]}`
		json.NewEncoder(w).Encode(map[string]any{"choices": []any{map[string]any{"message": map[string]string{"content": content}}}})
	}))
	defer provider.Close()
	store, _ := NewStore(filepath.Join(t.TempDir(), "state.json"))
	paper := Paper{ID: "p1", Title: "Retrieval study", Abstract: "Study abstract"}
	store.RecordAction(paper, "priority")
	before := store.Library()[0].UpdatedAt
	other, _ := NewStore(filepath.Join(t.TempDir(), "other.json"))
	other.RecordAction(paper, "save")
	a := NewAPI(nil, &Summarizer{client: provider.Client(), apiKey: "test", baseURL: provider.URL, model: "test"}, nil, store, slog.New(slog.NewTextHandler(io.Discard, nil)))
	body := `{"paper":{"id":"p1","title":"Retrieval study","abstract":"Study abstract"},"preferences":{"identity":"enthusiast","complexity":1}}`
	w := httptest.NewRecorder()
	a.retrySummary(w, httptest.NewRequest("POST", "/api/summary-retry", strings.NewReader(body)))
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	var result Paper
	json.Unmarshal(w.Body.Bytes(), &result)
	if result.SummaryStatus != "success" || result.SummaryPreferences.Complexity != 1 || !strings.Contains(prompt, "非专业爱好者") {
		t.Fatal(result)
	}
	entry := store.Library()[0]
	if entry.Action != "priority" || !entry.UpdatedAt.Equal(before) || entry.Paper.SummaryStatus != "success" {
		t.Fatal("collection changed unexpectedly")
	}
	if other.Library()[0].Paper.SummaryStatus != "" {
		t.Fatal("other account modified")
	}
	restored, _ := NewStore(store.path)
	if restored.Library()[0].Paper.Digest.Hook != result.Digest.Hook {
		t.Fatal("summary not persisted")
	}
}

func TestStreamSummaryStatusesAndErrors(t *testing.T) {
	for _, code := range []int{401, 429, 500} {
		t.Run(http.StatusText(code), func(t *testing.T) {
			provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(code)
				io.WriteString(w, "secret-provider-body")
			}))
			defer provider.Close()
			s := &Summarizer{client: provider.Client(), apiKey: "test", baseURL: provider.URL}
			applied := s.SummarizeStream(context.Background(), "topic", []Paper{{ID: "p", Title: "Paper"}}, func(batch []Paper) {
				if batch[0].SummaryStatus != "failed" || batch[0].SummaryMessage == "" || strings.Contains(batch[0].SummaryMessage, "secret") {
					t.Fatal(batch)
				}
				if code == 401 && !strings.Contains(batch[0].SummaryMessage, "认证") {
					t.Fatal(batch)
				}
				if code == 429 && !strings.Contains(batch[0].SummaryMessage, "频繁") {
					t.Fatal(batch)
				}
			})
			if applied {
				t.Fatal("failed request marked successful")
			}
		})
	}
	s := &Summarizer{}
	s.SummarizeStream(context.Background(), "topic", []Paper{{ID: "p", Title: "Paper"}}, func(batch []Paper) {
		if batch[0].SummaryStatus != "disabled" {
			t.Fatal(batch)
		}
	})
}

func TestRetrySummaryValidation(t *testing.T) {
	a := &API{summarizer: &Summarizer{}}
	for _, tc := range []struct {
		body string
		code int
	}{{`{}`, 400}, {`{"paper":{"id":"p","title":"Paper"}}`, 503}} {
		w := httptest.NewRecorder()
		a.retrySummary(w, httptest.NewRequest("POST", "/api/summary-retry", strings.NewReader(tc.body)))
		if w.Code != tc.code {
			t.Fatal(w.Code)
		}
	}
}

func TestBetaSummaryRetryProtection(t *testing.T) {
	b, h := betaFixture(t)
	body := `{"paper":{"id":"p","title":"Paper"}}`
	if w := betaRequest(h, "POST", "/api/summary-retry", body, nil, "https://beta.example.com"); w.Code != 401 {
		t.Fatal("retry requires authentication", w.Code)
	}
	cookie := betaLogin(t, h, "alice-secret")
	if w := betaRequest(h, "POST", "/api/summary-retry", body, cookie, "https://evil.example"); w.Code != 403 {
		t.Fatal("origin bypass", w.Code)
	}
	b.slots <- struct{}{}
	b.slots <- struct{}{}
	if w := betaRequest(h, "POST", "/api/summary-retry", body, cookie, "https://beta.example.com"); w.Code != 429 {
		t.Fatal("busy bypass", w.Code)
	}
	<-b.slots
	<-b.slots
	store := b.users[tokenHash("alice-secret")].store
	if store.state.QuotaCount != 0 {
		t.Fatal("busy charged quota")
	}
	for i := 0; i < 20; i++ {
		store.ConsumeQuota()
	}
	if w := betaRequest(h, "POST", "/api/summary-retry", body, cookie, "https://beta.example.com"); w.Code != 429 {
		t.Fatal("quota bypass", w.Code)
	}
}

func TestSearchPreferencesAndInitialStatus(t *testing.T) {
	for _, style := range []string{"focus", "broaden"} {
		t.Run(style, func(t *testing.T) {
			papers := make([]map[string]any, 30)
			for i := range papers {
				papers[i] = map[string]any{"paperId": fmt.Sprint(i), "title": fmt.Sprintf("Memory study %d", i), "abstract": "Memory study evidence.", "year": 2025}
			}
			content, _ := json.Marshal(map[string]any{"data": papers})
			client := &http.Client{Transport: sourceRetryTransport(func(r *http.Request) (*http.Response, error) {
				return &http.Response{StatusCode: 200, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(string(content))), Request: r}, nil
			})}
			store, _ := NewStore(filepath.Join(t.TempDir(), "state.json"))
			a := NewAPI(NewPaperSearcher(client), &Summarizer{}, nil, store, slog.New(slog.NewTextHandler(io.Discard, nil)))
			// search only needs image capability; the disabled generator is safe.
			a.images = &ImageGenerator{}
			w := httptest.NewRecorder()
			a.search(w, httptest.NewRequest("GET", "/api/search?q=memory&limit=3&identity=enthusiast&complexity=1&discoveryStyle="+style, nil))
			if w.Code != 200 || strings.Contains(w.Body.String(), "event: initial") || !strings.Contains(w.Body.String(), `"summary_status":"disabled"`) || !strings.Contains(w.Body.String(), `"complexity":1`) {
				t.Fatal(w.Code, w.Body.String())
			}
			if strings.Index(w.Body.String(), "event: batch") > strings.Index(w.Body.String(), "event: done") {
				t.Fatal("final cards arrive after completion")
			}
		})
	}
}
