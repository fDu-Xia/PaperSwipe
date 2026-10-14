package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
)

func TestTranslationValidationCacheAndIsolation(t *testing.T) {
	var calls atomic.Int32
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		var body struct {
			Messages []struct {
				Content string `json:"content"`
			} `json:"messages"`
		}
		if json.NewDecoder(r.Body).Decode(&body) != nil || len(body.Messages) != 2 {
			t.Error("invalid provider request")
			http.Error(w, "bad", 400)
			return
		}
		if !strings.Contains(body.Messages[0].Content, "do NOT summarize again") {
			t.Error("missing faithful translation instruction")
		}
		var texts []string
		_ = json.Unmarshal([]byte(body.Messages[1].Content), &texts)
		for i := range texts {
			texts[i] = "译文：" + texts[i]
		}
		result, _ := json.Marshal(map[string]any{"translations": texts})
		_ = json.NewEncoder(w).Encode(map[string]any{"choices": []any{map[string]any{"message": map[string]string{"content": string(result)}}}})
	}))
	defer provider.Close()
	t.Setenv("LLM_API_KEY", "test-key")
	t.Setenv("LLM_BASE_URL", provider.URL)
	t.Setenv("LLM_MODEL", "test-model")
	b, h := betaFixture(t)
	for _, a := range b.users {
		a.summarizer = NewSummarizer(provider.Client())
	}
	alice := betaLogin(t, h, "alice-secret")
	bob := betaLogin(t, h, "bob-secret")
	request := `{"language":"zh","texts":["Case-sensitive title","Keep **evidence** and 20%."]}`
	origin := "https://beta.example.com"
	for _, invalid := range []string{`{}`, `{"language":"fr","texts":["text"]}`, `{"language":"en","texts":[]}`, `{"language":"en","texts":[""]}`, `{"language":"en","texts":["` + strings.Repeat("x", 5001) + `"]}`} {
		if w := betaRequest(h, "POST", "/api/translate", invalid, alice, origin); w.Code != 400 {
			t.Fatalf("invalid request status=%d", w.Code)
		}
	}
	if b.users[tokenHash("alice-secret")].store.state.QuotaCount != 0 {
		t.Fatal("invalid requests consumed quota")
	}
	if w := betaRequest(h, "POST", "/api/translate", request, alice, "https://evil.example"); w.Code != 403 {
		t.Fatal("cross origin translation allowed")
	}
	if w := betaRequest(h, "POST", "/api/translate", request, nil, origin); w.Code != 401 {
		t.Fatal("unauthenticated translation allowed")
	}
	for i := 0; i < 2; i++ {
		if w := betaRequest(h, "POST", "/api/translate", request, alice, origin); w.Code != 200 || !strings.Contains(w.Body.String(), "译文") {
			t.Fatalf("translation: %d %s", w.Code, w.Body.String())
		}
	}
	if calls.Load() != 1 || b.users[tokenHash("alice-secret")].store.state.QuotaCount != 1 {
		t.Fatal("cache hit charged or contacted provider")
	}
	if w := betaRequest(h, "POST", "/api/translate", request, bob, origin); w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	if calls.Load() != 2 {
		t.Fatal("accounts unexpectedly share content cache")
	}
	a := b.users[tokenHash("alice-secret")]
	if a.translationKey("zh", "CASE") == a.translationKey("zh", "case") {
		t.Fatal("case-sensitive content collision")
	}
	for _, path := range []string{"/locales.js", "/i18n.js"} {
		if w := betaRequest(h, "GET", path, "", nil, ""); w.Code != 200 {
			t.Fatalf("login dependency unavailable %s", path)
		}
	}
}

func TestTranslationRejectsIncompleteProviderResponse(t *testing.T) {
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{"choices": []any{map[string]any{"message": map[string]string{"content": `{"translations":[]}`}}}})
	}))
	defer provider.Close()
	t.Setenv("LLM_API_KEY", "test-key")
	t.Setenv("LLM_BASE_URL", provider.URL)
	t.Setenv("LLM_MODEL", "test-model")
	a := &API{cache: newSearchCache(), summarizer: NewSummarizer(provider.Client())}
	request := `{"language":"en","texts":["研究结果"]}`
	w := httptest.NewRecorder()
	a.translate(w, httptest.NewRequest("POST", "/api/translate", strings.NewReader(request)))
	if w.Code != 502 {
		t.Fatalf("unexpected result %d", w.Code)
	}
	if _, complete := a.cachedTranslations(translationRequest{Language: "en", Texts: []string{"研究结果"}}); complete {
		t.Fatal("cached incomplete response")
	}
	a.summarizer = &Summarizer{}
	w = httptest.NewRecorder()
	a.translate(w, httptest.NewRequest("POST", "/api/translate", strings.NewReader(request)))
	if w.Code != 503 {
		t.Fatalf("disabled AI returned %d", w.Code)
	}
}

func TestTranslationBatchCacheDoesNotEvictSearchByEntryCount(t *testing.T) {
	c := newSearchCache()
	c.put("existing-search", []byte("search result"))
	for i := 0; i < 24; i++ {
		c.put(fmt.Sprintf("translation:%d", i), []byte("translated fragment"))
	}
	for i := 0; i < 24; i++ {
		if _, ok := c.get(fmt.Sprintf("translation:%d", i)); !ok {
			t.Fatal("a translation batch evicted its own fragment")
		}
	}
	if _, ok := c.get("existing-search"); !ok {
		t.Fatal("translations evicted search by entry count")
	}
	for i := 24; i < 300; i++ {
		c.put(fmt.Sprintf("translation:%d", i), []byte("translated fragment"))
	}
	if len(c.entries) != 257 {
		t.Fatalf("unbounded fragment count: %d", len(c.entries))
	}
	if c.bytes > c.maxBytes {
		t.Fatal("shared byte budget exceeded")
	}
}
