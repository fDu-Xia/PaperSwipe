package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

const searchCacheTTL = 30 * time.Minute
const searchCacheMaxBytes = 4 << 20

type cachedResponse struct {
	data    []byte
	created time.Time
}
type searchCache struct {
	mu      sync.Mutex
	entries map[string]cachedResponse
	flights map[string]chan struct{}
	bytes   int
}

func newSearchCache() *searchCache {
	return &searchCache{entries: map[string]cachedResponse{}, flights: map[string]chan struct{}{}}
}
func (c *searchCache) get(key string) ([]byte, bool) {
	if c == nil {
		return nil, false
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	e, ok := c.entries[key]
	if !ok {
		return nil, false
	}
	if time.Since(e.created) >= searchCacheTTL {
		delete(c.entries, key)
		c.bytes -= len(e.data)
		return nil, false
	}
	return append([]byte(nil), e.data...), true
}
func (c *searchCache) put(key string, data []byte) {
	if c == nil || len(data) > searchCacheMaxBytes {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if old, ok := c.entries[key]; ok {
		c.bytes -= len(old.data)
		delete(c.entries, key)
	}
	for len(c.entries) >= 16 || c.bytes+len(data) > searchCacheMaxBytes {
		oldest := ""
		var at time.Time
		for k, e := range c.entries {
			if oldest == "" || e.created.Before(at) {
				oldest = k
				at = e.created
			}
		}
		if oldest == "" {
			break
		}
		c.bytes -= len(c.entries[oldest].data)
		delete(c.entries, oldest)
	}
	c.entries[key] = cachedResponse{data: append([]byte(nil), data...), created: time.Now()}
	c.bytes += len(data)
}

// Serialize identical work within one account. Waiters reuse only completed results.
func (c *searchCache) acquire(ctx context.Context, key string) (func(), bool, error) {
	if c == nil {
		return func() {}, false, nil
	}
	waited := false
	for {
		c.mu.Lock()
		ch, ok := c.flights[key]
		if !ok {
			ch = make(chan struct{})
			c.flights[key] = ch
			c.mu.Unlock()
			return func() { c.mu.Lock(); delete(c.flights, key); close(ch); c.mu.Unlock() }, waited, nil
		}
		c.mu.Unlock()
		waited = true
		select {
		case <-ch:
		case <-ctx.Done():
			return nil, waited, ctx.Err()
		}
	}
}
func (a *API) cacheKey(kind, query string, prefs ReaderPreferences, limit int) string {
	// Include the generator settings and prompt revision; never expose this key to clients.
	raw, _ := json.Marshal([]any{"reader-cards-v2", kind, strings.ToLower(cleanSpace(query)), normalizePreferences(prefs), limit, a.summarizer.baseURL, a.summarizer.model, a.summarizer.apiKey, a.summarizer.thinking, a.summarizer.reasoningEffort, a.summarizer.maxTokens})
	hash := sha256.Sum256(raw)
	return hex.EncodeToString(hash[:])
}
func (a *API) searchKey(r *http.Request) (string, bool) {
	q := cleanSpace(r.URL.Query().Get("q"))
	if len([]rune(q)) < 2 || len([]rune(q)) > 120 {
		return "", false
	}
	limit := 20
	if raw := r.URL.Query().Get("limit"); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil || n < 3 || n > 30 {
			return "", false
		}
		limit = n
	}
	level, _ := strconv.Atoi(r.URL.Query().Get("complexity"))
	return a.cacheKey("search", q, ReaderPreferences{Identity: r.URL.Query().Get("identity"), DiscoveryStyle: r.URL.Query().Get("discoveryStyle"), Complexity: level}, limit), true
}
func writeCachedSearch(w http.ResponseWriter, data []byte) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Accel-Buffering", "no")
	w.Write(data)
	if f, ok := w.(http.Flusher); ok {
		f.Flush()
	}
}
func (a *API) tryCachedSearch(w http.ResponseWriter, r *http.Request) bool {
	if r.Method != "GET" || r.URL.Path != "/api/search" || r.URL.Query().Get("refresh") == "1" {
		return false
	}
	key, ok := a.searchKey(r)
	if !ok {
		return false
	}
	data, ok := a.cache.get(key)
	if !ok {
		return false
	}
	writeCachedSearch(w, data)
	if a.store != nil {
		_ = a.store.RecordSearch(cleanSpace(r.URL.Query().Get("q")))
	}
	return true
}
func encodeCachedSearch(meta map[string]any, papers []Paper) []byte {
	meta["cached"] = true
	var out []byte
	for _, event := range []struct {
		name string
		data any
	}{{"meta", meta}, {"batch", map[string]any{"papers": papers}}, {"done", map[string]any{"ai_applied": true, "cached": true}}} {
		b, _ := json.Marshal(event.data)
		out = append(out, []byte(fmt.Sprintf("event: %s\ndata: %s\n\n", event.name, b))...)
	}
	return out
}
