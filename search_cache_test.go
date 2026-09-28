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
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func cacheFixture(t *testing.T, delay time.Duration) (*API, *atomic.Int32, *atomic.Int32) {
	t.Helper()
	sourceCalls, aiCalls := new(atomic.Int32), new(atomic.Int32)
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		aiCalls.Add(1)
		time.Sleep(delay)
		var req struct {
			Messages []struct {
				Content string `json:"content"`
			} `json:"messages"`
		}
		json.NewDecoder(r.Body).Decode(&req)
		prompt := req.Messages[1].Content
		marker := strings.LastIndex(prompt, "Papers: ")
		var papers []Paper
		json.Unmarshal([]byte(prompt[marker+8:]), &papers)
		items := []llmDigest{}
		for _, p := range papers {
			items = append(items, llmDigest{ID: p.ID, Digest: Digest{Hook: "具体研究发现", Verdict: "核验原文"}})
		}
		b, _ := json.Marshal(llmDigestResponse{Papers: items})
		json.NewEncoder(w).Encode(map[string]any{"choices": []any{map[string]any{"message": map[string]string{"content": string(b)}}}})
	}))
	t.Cleanup(provider.Close)
	client := &http.Client{Transport: sourceRetryTransport(func(r *http.Request) (*http.Response, error) {
		sourceCalls.Add(1)
		papers := []map[string]any{}
		for i := 0; i < 20; i++ {
			papers = append(papers, map[string]any{"paperId": fmt.Sprint(i), "title": fmt.Sprintf("Memory paper %d", i), "abstract": "A study of memory with documented results.", "year": 2025})
		}
		b, _ := json.Marshal(map[string]any{"data": papers})
		return &http.Response{StatusCode: 200, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(string(b))), Request: r}, nil
	})}
	store, _ := NewStore(filepath.Join(t.TempDir(), "state.json"))
	return NewAPI(NewPaperSearcher(client), &Summarizer{client: provider.Client(), apiKey: "test", baseURL: provider.URL, model: "test"}, &ImageGenerator{}, store, slog.New(slog.NewTextHandler(io.Discard, nil))), sourceCalls, aiCalls
}
func measuredSearch(a *API, query string) (*httptest.ResponseRecorder, time.Duration) {
	w := httptest.NewRecorder()
	start := time.Now()
	a.search(w, httptest.NewRequest("GET", "/api/search?q="+query+"&limit=20", nil))
	return w, time.Since(start)
}
func TestSearchPerformanceSample(t *testing.T) {
	for i := 0; i < 3; i++ {
		a, source, ai := cacheFixture(t, 120*time.Millisecond)
		_, cold := measuredSearch(a, "memory")
		_, warm := measuredSearch(a, "memory")
		t.Logf("run=%d cold=%s repeat=%s source_calls=%d ai_calls=%d", i+1, cold.Round(time.Millisecond), warm.Round(time.Millisecond), source.Load(), ai.Load())
	}
}

func TestSearchCacheReuseAndRefresh(t *testing.T) {
	a, source, ai := cacheFixture(t, 0)
	first, _ := measuredSearch(a, "memory")
	if first.Code != 200 {
		t.Fatal(first.Code)
	}
	calls := ai.Load()
	second, _ := measuredSearch(a, "memory")
	if ai.Load() != calls || source.Load() != 1 || !strings.Contains(second.Body.String(), `"cached":true`) {
		t.Fatal("cache miss", ai.Load(), second.Body.String())
	}
	measuredSearch(a, "memory&complexity=1")
	if ai.Load() == calls {
		t.Fatal("difficulty not isolated")
	}
	calls = ai.Load()
	measuredSearch(a, "memory&identity=researcher")
	if ai.Load() == calls {
		t.Fatal("identity not isolated")
	}
	calls = ai.Load()
	measuredSearch(a, "memory&discoveryStyle=broaden")
	if ai.Load() == calls {
		t.Fatal("style not isolated")
	}
	calls = ai.Load()
	refreshed, _ := measuredSearch(a, "memory&refresh=1")
	if ai.Load() == calls || strings.Contains(refreshed.Body.String(), `"cached":true`) {
		t.Fatal("refresh reused cache")
	}
	a.summarizer.model = "changed-model"
	calls = ai.Load()
	measuredSearch(a, "memory")
	if ai.Load() == calls {
		t.Fatal("model not isolated")
	}
}
func TestSearchCacheExpiryBoundsAndCopies(t *testing.T) {
	c := newSearchCache()
	raw := []byte("original")
	c.put("a", raw)
	raw[0] = 'x'
	data, _ := c.get("a")
	if string(data) != "original" {
		t.Fatal("mutable input")
	}
	data[0] = 'z'
	data, _ = c.get("a")
	if string(data) != "original" {
		t.Fatal("mutable output")
	}
	c.mu.Lock()
	e := c.entries["a"]
	e.created = time.Now().Add(-searchCacheTTL)
	c.entries["a"] = e
	c.mu.Unlock()
	if _, ok := c.get("a"); ok {
		t.Fatal("expired data served")
	}
	for i := 0; i < 30; i++ {
		c.put(fmt.Sprint(i), make([]byte, 400000))
	}
	if c.bytes > searchCacheMaxBytes || len(c.entries) > 16 {
		t.Fatal("unbounded cache")
	}
}
func TestSearchCacheCoalescesAndCancellation(t *testing.T) {
	a, source, _ := cacheFixture(t, 10*time.Millisecond)
	var wg sync.WaitGroup
	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); measuredSearch(a, "memory") }()
	}
	wg.Wait()
	if source.Load() != 1 {
		t.Fatal("duplicate concurrent generation", source.Load())
	}
	release, _, _ := a.cache.acquire(context.Background(), "waiting")
	defer release()
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, _, err := a.cache.acquire(ctx, "waiting"); err == nil {
		t.Fatal("cancel ignored")
	}
}
func TestFailedSearchNotCached(t *testing.T) {
	a, source, ai := cacheFixture(t, 0)
	a.summarizer.client = &http.Client{Transport: sourceRetryTransport(func(r *http.Request) (*http.Response, error) {
		ai.Add(1)
		return &http.Response{StatusCode: 401, Header: make(http.Header), Body: io.NopCloser(strings.NewReader("denied")), Request: r}, nil
	})}
	measuredSearch(a, "memory")
	measuredSearch(a, "memory")
	if source.Load() != 2 {
		t.Fatal("failure cached")
	}
	if len(a.cache.entries) != 0 {
		t.Fatal("failed response stored")
	}
}
func TestBetaCacheIsolationAndQuota(t *testing.T) {
	base, _, _ := cacheFixture(t, 0)
	b, err := newBeta(base, t.TempDir(), "https://beta.example.com", "alice:"+tokenHash("alice-secret")+",bob:"+tokenHash("bob-secret"))
	if err != nil {
		t.Fatal(err)
	}
	aliceAPI, bobAPI := b.users[tokenHash("alice-secret")], b.users[tokenHash("bob-secret")]
	measuredSearch(aliceAPI, "memory")
	if len(bobAPI.cache.entries) != 0 || aliceAPI.cache == bobAPI.cache {
		t.Fatal("cross-account cache")
	}
	h := b.Handler(http.NotFoundHandler())
	alice := betaLogin(t, h, "alice-secret")
	for i := 0; i < 20; i++ {
		aliceAPI.store.ConsumeQuota()
	}
	w := betaRequest(h, "GET", "/api/search?q=memory&limit=20", "", alice, "")
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"cached":true`) || aliceAPI.store.state.QuotaCount != 20 {
		t.Fatal("cached read charged/blocked", w.Code)
	}
	w = betaRequest(h, "GET", "/api/search?q=memory&limit=20&refresh=1", "", alice, "")
	if w.Code != 429 {
		t.Fatal("refresh bypassed quota", w.Code)
	}
	if w = betaRequest(h, "GET", "/api/search?q=memory&limit=20", "", nil, ""); w.Code != 401 {
		t.Fatal("cache exposed without login")
	}
}
