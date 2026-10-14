package main

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestSchedulePersistsAndIsolates(t *testing.T) {
	b, h := betaFixture(t)
	a, z := betaLogin(t, h, "alice-secret"), betaLogin(t, h, "bob-secret")
	betaRequest(h, "POST", "/api/actions", `{"paper":{"id":"p"},"action":"save"}`, a, b.origin)
	patch := `{"paper_id":"p","date":"2026-10-20","priority":"high","done":true}`
	if w := betaRequest(h, "POST", "/api/schedule", patch, a, b.origin); w.Code != 200 {
		t.Fatal(w.Body)
	}
	s, err := NewStore(b.users[tokenHash("alice-secret")].store.path)
	if err != nil || s.Schedule()["p"].Date != "2026-10-20" || !s.Schedule()["p"].Done {
		t.Fatal("schedule not persisted", err)
	}
	if w := betaRequest(h, "POST", "/api/schedule", patch, z, b.origin); w.Code != 400 {
		t.Fatal("foreign paper accepted")
	}
	if w := betaRequest(h, "POST", "/api/schedule", patch, nil, b.origin); w.Code != 401 {
		t.Fatal("missing auth")
	}
	if w := betaRequest(h, "POST", "/api/schedule", patch, a, "https://evil.example"); w.Code != 403 {
		t.Fatal("missing origin check")
	}
	w := betaRequest(h, "GET", "/api/library", "", z, "")
	if strings.Contains(w.Body.String(), "2026-10-20") {
		t.Fatal("schedule leak")
	}
	betaRequest(h, "POST", "/api/schedule", `{"paper_id":"p","removed":true}`, a, b.origin)
	if len(b.users[tokenHash("alice-secret")].store.Library()) != 1 {
		t.Fatal("remove deleted collection")
	}
	for _, body := range []string{`{"paper_id":"p","date":"2026-02-30"}`, `{"paper_id":"p","priority":"wrong"}`} {
		if w := betaRequest(h, "POST", "/api/schedule", body, a, b.origin); w.Code != 400 {
			t.Fatal("invalid schedule accepted")
		}
	}
}

func TestScheduleFailedWriteRollback(t *testing.T) {
	s, _ := NewStore(filepath.Join(t.TempDir(), "state.json"))
	s.RecordAction(Paper{ID: "p"}, "save")
	s.path = t.TempDir()
	done := true
	if s.UpdateSchedule(SchedulePatch{PaperID: "p", Done: &done}) == nil || len(s.Schedule()) != 0 {
		t.Fatal("write rollback failed")
	}
}

func TestBetaGlobalCacheBudget(t *testing.T) {
	base, _, _ := cacheFixture(t, 0)
	entries := make([]string, 130)
	for i := range entries {
		entries[i] = fmt.Sprintf("u%d:%s", i, tokenHash(fmt.Sprint(i)))
	}
	b, err := newBeta(base, t.TempDir(), "https://example.com", strings.Join(entries, ","))
	if err != nil {
		t.Fatal(err)
	}
	total := 0
	for _, a := range b.users {
		total += a.cache.maxBytes
		a.cache.put("too-big", make([]byte, a.cache.maxBytes+1))
		if a.cache.bytes != 0 {
			t.Fatal("per-account budget ignored")
		}
	}
	if total > betaCacheBudget {
		t.Fatal("global budget exceeded", total)
	}
	t.Logf("130 accounts: cache payload ceilings total=%d bytes (old ceiling=%d)", total, 130*searchCacheMaxBytes)
}

func TestCacheIdleExpiry(t *testing.T) {
	c := newSearchCache()
	c.mu.Lock()
	c.entries["old"] = cachedResponse{data: []byte("x"), created: time.Now().Add(-searchCacheTTL + 20*time.Millisecond)}
	c.bytes = 1
	c.scheduleExpiryLocked()
	c.mu.Unlock()
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		c.mu.Lock()
		empty := len(c.entries) == 0 && c.bytes == 0
		c.mu.Unlock()
		if empty {
			return
		}
		time.Sleep(time.Millisecond)
	}
	t.Fatal("idle cache did not expire")
}

func TestQueueCancellationAndFull(t *testing.T) {
	b, _ := betaFixture(t)
	b.slots <- struct{}{}
	b.slots <- struct{}{}
	ctx, cancel := context.WithCancel(context.Background())
	r := httptest.NewRequest("GET", "/api/search", nil).WithContext(ctx)
	r.Header.Set("Prefer", "wait=20")
	finished := make(chan bool, 1)
	go func() { finished <- b.waitForSlot(httptest.NewRecorder(), r) }()
	deadline := time.Now().Add(time.Second)
	for len(b.waiting) == 0 && time.Now().Before(deadline) {
		time.Sleep(time.Millisecond)
	}
	cancel()
	if <-finished || len(b.waiting) != 0 || len(b.slots) != 2 {
		t.Fatal("cancel leaked slot")
	}
	for i := 0; i < cap(b.waiting); i++ {
		b.waiting <- struct{}{}
	}
	w := httptest.NewRecorder()
	if b.waitForSlot(w, r) || w.Code != 429 {
		t.Fatal("queue overflow accepted")
	}
}

func TestQueueResumes(t *testing.T) {
	b, _ := betaFixture(t)
	b.slots <- struct{}{}
	b.slots <- struct{}{}
	r := httptest.NewRequest("GET", "/api/search", nil)
	r.Header.Set("Prefer", "wait=20")
	result := make(chan bool, 1)
	go func() { result <- b.waitForSlot(httptest.NewRecorder(), r) }()
	<-b.slots
	select {
	case accepted := <-result:
		if !accepted || len(b.slots) != 2 || len(b.waiting) != 0 {
			t.Fatal("queue failed")
		}
	case <-time.After(time.Second):
		t.Fatal("queue stalled")
	}
}

func TestLoginFailuresDoNotBlockOtherValidAccounts(t *testing.T) {
	_, h := betaFixture(t)
	for i := 0; i < 35; i++ {
		betaRequest(h, "POST", "/api/login", `{"token":"invalid"}`, nil, "https://beta.example.com")
	}
	if w := betaRequest(h, "POST", "/api/login", `{"token":"bob-secret"}`, nil, "https://beta.example.com"); w.Code != http.StatusOK {
		t.Fatal("invalid attempts blocked valid account", w.Code)
	}
}

func TestOneOutstandingJobPerAccount(t *testing.T) {
	b, h := betaFixture(t)
	cookie := betaLogin(t, h, "alice-secret")
	b.costlyUsers = map[string]bool{tokenHash("alice-secret"): true}
	w := betaRequest(h, "POST", "/api/topic-plan", `{"description":"agent memory"}`, cookie, b.origin)
	if w.Code != 429 || b.users[tokenHash("alice-secret")].store.state.QuotaCount != 0 {
		t.Fatal("duplicate job was admitted or charged")
	}
}

func Test130ValidAccountsCanLogin(t *testing.T) {
	base, _, _ := cacheFixture(t, 0)
	entries := make([]string, 130)
	for i := range entries {
		entries[i] = fmt.Sprintf("u%d:%s", i, tokenHash(fmt.Sprint(i)))
	}
	b, err := newBeta(base, t.TempDir(), "https://beta.example.com", strings.Join(entries, ","))
	if err != nil {
		t.Fatal(err)
	}
	h := b.Handler(http.NotFoundHandler())
	for i := range entries {
		betaLogin(t, h, fmt.Sprint(i))
	}
}
