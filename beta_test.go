package main

import (
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

func betaFixture(t *testing.T) (*Beta, http.Handler) {
	t.Helper()
	store, err := NewStore(filepath.Join(t.TempDir(), "legacy.json"))
	if err != nil {
		t.Fatal(err)
	}
	base := NewAPI(NewPaperSearcher(http.DefaultClient), &Summarizer{}, &ImageGenerator{}, store, slog.New(slog.NewTextHandler(io.Discard, nil)))
	b, err := newBeta(base, t.TempDir(), "https://beta.example.com", "alice:"+tokenHash("alice-secret")+",bob:"+tokenHash("bob-secret"))
	if err != nil {
		t.Fatal(err)
	}
	return b, b.Handler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { fmt.Fprint(w, "app") }))
}

func TestBetaConcurrentQuotaAndBusyGate(t *testing.T) {
	b, h := betaFixture(t)
	s := b.users[tokenHash("alice-secret")].store
	var accepted atomic.Int32
	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if s.ConsumeQuota() == nil {
				accepted.Add(1)
			}
		}()
	}
	wg.Wait()
	if accepted.Load() != 20 {
		t.Fatalf("concurrent quota accepted %d", accepted.Load())
	}
	c := betaLogin(t, h, "bob-secret")
	b.slots <- struct{}{}
	b.slots <- struct{}{}
	w := betaRequest(h, "POST", "/api/topic-plan", `{"description":"agent memory"}`, c, "https://beta.example.com")
	if w.Code != 429 || b.users[tokenHash("bob-secret")].store.state.QuotaCount != 0 {
		t.Fatal("busy gate did not reject before charging")
	}
}

func TestStoreFailedWriteRollsBack(t *testing.T) {
	s, err := NewStore(filepath.Join(t.TempDir(), "state.json"))
	if err != nil {
		t.Fatal(err)
	}
	s.path = t.TempDir() // Replacing a directory with the state file must fail.
	if s.RecordAction(Paper{ID: "failed"}, "save") == nil {
		t.Fatal("write unexpectedly succeeded")
	}
	if len(s.Library()) != 0 {
		t.Fatal("failed write leaked into memory")
	}
	if s.ConsumeQuota() == nil || s.state.QuotaCount != 0 {
		t.Fatal("quota write failure did not roll back")
	}
}
func betaRequest(h http.Handler, method, path, body string, cookie *http.Cookie, origin string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(method, "https://beta.example.com"+path, strings.NewReader(body))
	if cookie != nil {
		r.AddCookie(cookie)
	}
	if origin != "" {
		r.Header.Set("Origin", origin)
	}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}
func betaLogin(t *testing.T, h http.Handler, token string) *http.Cookie {
	t.Helper()
	w := betaRequest(h, "POST", "/api/login", `{"token":"`+token+`"}`, nil, "https://beta.example.com")
	if w.Code != 200 {
		t.Fatalf("login: %d %s", w.Code, w.Body)
	}
	c := w.Result().Cookies()[0]
	if !c.HttpOnly || !c.Secure || c.SameSite != http.SameSiteStrictMode {
		t.Fatal("unsafe cookie")
	}
	return c
}
func TestBetaAuthenticationIsolationAndRestart(t *testing.T) {
	b, h := betaFixture(t)
	for _, path := range []string{"/api/actions", "/api/library", "/api/search", "/api/stats", "/api/searches", "/api/me"} {
		if w := betaRequest(h, "GET", path, "", nil, ""); w.Code != 401 {
			t.Fatalf("%s: %d", path, w.Code)
		}
	}
	alice := betaLogin(t, h, "alice-secret")
	bob := betaLogin(t, h, "bob-secret")
	w := betaRequest(h, "POST", "/api/actions", `{"paper":{"id":"p1","title":"Private Alice Paper"},"action":"save"}`, alice, "https://beta.example.com")
	if w.Code != 200 {
		t.Fatal(w.Body)
	}
	if w = betaRequest(h, "GET", "/api/library", "", bob, ""); strings.Contains(w.Body.String(), "Private Alice") {
		t.Fatal("cross-user leak")
	}
	if w = betaRequest(h, "GET", "/api/library", "", alice, ""); !strings.Contains(w.Body.String(), "Private Alice") {
		t.Fatal("missing saved paper")
	}
	reloaded, err := NewStore(b.users[tokenHash("alice-secret")].store.path)
	if err != nil || len(reloaded.Library()) != 1 {
		t.Fatal("persistence failed", err)
	}
	if w = betaRequest(h, "POST", "/api/actions", `{}`, alice, "https://evil.example"); w.Code != 403 {
		t.Fatal("cross-origin write allowed")
	}
	if w = betaRequest(h, "POST", "/api/paper-image", `{}`, alice, "https://beta.example.com"); w.Code != 403 {
		t.Fatal("image enabled")
	}
	betaLogin(t, h, "alice-secret")
	if w = betaRequest(h, "GET", "/api/me", "", alice, ""); w.Code != 401 {
		t.Fatal("previous session still active")
	}
	if w = betaRequest(h, "POST", "/api/logout", "", bob, "https://beta.example.com"); w.Code != 200 {
		t.Fatal("logout failed")
	}
	if w = betaRequest(h, "GET", "/api/me", "", bob, ""); w.Code != 401 {
		t.Fatal("logged-out session valid")
	}
}
func TestBetaQuotaPersistsAndResets(t *testing.T) {
	b, _ := betaFixture(t)
	s := b.users[tokenHash("alice-secret")].store
	for i := 0; i < 20; i++ {
		if err := s.ConsumeQuota(); err != nil {
			t.Fatal(err)
		}
	}
	s, err := NewStore(s.path)
	if err != nil {
		t.Fatal(err)
	}
	if s.ConsumeQuota() == nil {
		t.Fatal("quota reset on reload")
	}
	s.state.QuotaDay = "2000-01-01"
	if err = s.ConsumeQuota(); err != nil {
		t.Fatal(err)
	}
	if s.state.QuotaCount != 1 {
		t.Fatal("daily reset failed")
	}
}
func TestBetaInvalidConfigAndExpiredSession(t *testing.T) {
	for _, origin := range []string{"", "http://public.example", "https://beta.example/", "https://beta.example?x=1"} {
		if _, err := newBeta(&API{}, t.TempDir(), origin, "alice:"+tokenHash("a")); err == nil {
			t.Fatalf("accepted origin %q", origin)
		}
	}
	b, h := betaFixture(t)
	c := betaLogin(t, h, "alice-secret")
	b.sessions[tokenHash(c.Value)] = betaSession{tokenHash("alice-secret"), time.Now().Add(-time.Minute)}
	if w := betaRequest(h, "GET", "/api/me", "", c, ""); w.Code != 401 {
		t.Fatal("expired session accepted")
	}
	if w := betaRequest(h, "POST", "/api/login", `{"token":"bad"}`, nil, "https://beta.example.com"); w.Code != 401 {
		t.Fatal("bad invite accepted")
	}
	for i := 0; i < 30; i++ {
		betaRequest(h, "POST", "/api/login", `{}`, nil, "https://beta.example.com")
	}
	if w := betaRequest(h, "POST", "/api/login", `{}`, nil, "https://beta.example.com"); w.Code != 429 {
		t.Fatal("login rate limit missing")
	}
}
