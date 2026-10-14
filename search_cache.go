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
const betaCacheBudget = 32 << 20

type cachedResponse struct {
	data    []byte
	created time.Time
}
type searchCache struct {
	mu       sync.Mutex
	entries  map[string]cachedResponse
	flights  map[string]chan struct{}
	bytes    int
	maxBytes int
	expiry   *time.Timer
}

func newSearchCache() *searchCache {
	return &searchCache{entries: map[string]cachedResponse{}, flights: map[string]chan struct{}{}, maxBytes: searchCacheMaxBytes}
}

// One timer per non-empty cache; idle accounts release expired payloads too.
func (c *searchCache) expireLocked(now time.Time) {
	for key, item := range c.entries {
		if now.Sub(item.created) >= searchCacheTTL {
			delete(c.entries, key)
			c.bytes -= len(item.data)
		}
	}
}

func (c *searchCache) scheduleExpiryLocked() {
	if c.expiry != nil || len(c.entries) == 0 {
		return
	}
	var earliest time.Time
	for _, item := range c.entries {
		deadline := item.created.Add(searchCacheTTL)
		if earliest.IsZero() || deadline.Before(earliest) {
			earliest = deadline
		}
	}
	c.expiry = time.AfterFunc(time.Until(earliest), func() {
		c.mu.Lock()
		defer c.mu.Unlock()
		c.expiry = nil
		c.expireLocked(time.Now())
		c.scheduleExpiryLocked()
	})
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
	c.expireLocked(time.Now())
	if len(data) > c.maxBytes {
		return
	}
	if old, ok := c.entries[key]; ok {
		c.bytes -= len(old.data)
		delete(c.entries, key)
	}
	// Small translated fragments share the byte budget but not the 16-result
	// search count. A single 24-fragment batch must not evict itself or searches.
	translation := strings.HasPrefix(key, "translation:")
	entryLimit := 16
	if translation {
		entryLimit = 256
	}
	count := 0
	for k := range c.entries {
		if strings.HasPrefix(k, "translation:") == translation {
			count++
		}
	}
	for count >= entryLimit || c.bytes+len(data) > c.maxBytes {
		oldest := ""
		var at time.Time
		for k, e := range c.entries {
			if count >= entryLimit && strings.HasPrefix(k, "translation:") != translation {
				continue
			}
			if oldest == "" || e.created.Before(at) {
				oldest = k
				at = e.created
			}
		}
		if oldest == "" {
			break
		}
		c.bytes -= len(c.entries[oldest].data)
		if strings.HasPrefix(oldest, "translation:") == translation {
			count--
		}
		delete(c.entries, oldest)
	}
	c.entries[key] = cachedResponse{data: append([]byte(nil), data...), created: time.Now()}
	c.bytes += len(data)
	c.scheduleExpiryLocked()
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
