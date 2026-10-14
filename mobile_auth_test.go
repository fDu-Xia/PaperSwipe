package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func mobileCall(h http.Handler, method, path, token, origin, body string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(method, path, strings.NewReader(body))
	if token != "" {
		r.Header.Set("Authorization", "Bearer "+token)
	}
	if origin != "" {
		r.Header.Set("Origin", origin)
	}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}

func mobileLogin(t *testing.T, h http.Handler, invite string) string {
	t.Helper()
	w := mobileCall(h, "POST", "/api/mobile/login", "", "https://localhost", `{"token":"`+invite+`"}`)
	var data struct {
		Token string `json:"access_token"`
	}
	if w.Code != 200 || len(w.Result().Cookies()) != 0 || json.Unmarshal(w.Body.Bytes(), &data) != nil || len(data.Token) != 64 {
		t.Fatalf("mobile login failed: status=%d", w.Code)
	}
	return data.Token
}

func TestMobileOptInAndOriginBoundaries(t *testing.T) {
	b, h := betaFixture(t)
	if w := mobileCall(h, "POST", "/api/mobile/login", "", "https://localhost", `{"token":"alice-secret"}`); w.Code != 403 {
		t.Fatal("enabled by default")
	}
	b.mobileEnabled = true
	for _, origin := range []string{"", "null", "http://localhost", "https://evil.example", b.origin} {
		w := mobileCall(h, "POST", "/api/mobile/login", "", origin, `{"token":"alice-secret"}`)
		if w.Code != 403 || w.Header().Get("Access-Control-Allow-Origin") != "" {
			t.Fatal("untrusted origin allowed", origin)
		}
	}
	for _, origin := range []string{"https://localhost", "capacitor://localhost"} {
		r := httptest.NewRequest("OPTIONS", "/api/search", nil)
		r.Header.Set("Origin", origin)
		r.Header.Set("Access-Control-Request-Method", "GET")
		r.Header.Set("Access-Control-Request-Headers", "authorization, prefer")
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if w.Code != 204 || w.Header().Get("Access-Control-Allow-Origin") != origin || w.Header().Get("Access-Control-Allow-Credentials") != "" {
			t.Fatal("preflight failed")
		}
		r.Header.Set("Access-Control-Request-Headers", "x-untrusted")
		w = httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if w.Code != 403 {
			t.Fatal("unknown header allowed")
		}
	}
}

func TestMobileSessionsAreSeparateFromCookies(t *testing.T) {
	b, h := betaFixture(t)
	b.mobileEnabled = true
	cookie := betaLogin(t, h, "alice-secret")
	token := mobileLogin(t, h, "alice-secret")
	if mobileCall(h, "GET", "/api/me", token, "https://localhost", "").Code != 200 {
		t.Fatal("mobile session invalid")
	}
	if betaRequest(h, "GET", "/api/me", "", cookie, "").Code != 200 {
		t.Fatal("mobile login invalidated browser")
	}
	if mobileCall(h, "GET", "/api/me", cookie.Value, "https://localhost", "").Code != 401 {
		t.Fatal("cookie token used as bearer")
	}
	if betaRequest(h, "GET", "/api/me", "", &http.Cookie{Name: "paperswipe_session", Value: token}, "").Code != 401 {
		t.Fatal("bearer used as cookie")
	}
	if betaRequest(h, "POST", "/api/logout", "", cookie, "https://localhost").Code != 401 {
		t.Fatal("CORS bypassed CSRF using a cookie")
	}
	if betaRequest(h, "POST", "/api/logout", "", cookie, "").Code != 403 {
		t.Fatal("web CSRF relaxed")
	}
	if mobileCall(h, "GET", "/api/me", token, "https://evil.example", "").Code != 403 {
		t.Fatal("hostile origin accepted")
	}
	if mobileCall(h, "GET", "/app.js", token, "https://localhost", "").Code != 403 {
		t.Fatal("bearer allowed outside API")
	}
	newToken := mobileLogin(t, h, "alice-secret")
	if mobileCall(h, "GET", "/api/me", token, "https://localhost", "").Code != 401 {
		t.Fatal("old mobile session survived")
	}
	if mobileCall(h, "POST", "/api/logout", newToken, "https://localhost", "").Code != 200 {
		t.Fatal("logout failed")
	}
	if mobileCall(h, "GET", "/api/me", newToken, "https://localhost", "").Code != 401 {
		t.Fatal("logout did not revoke")
	}
	if betaRequest(h, "GET", "/api/me", "", cookie, "").Code != 200 {
		t.Fatal("mobile logout revoked browser")
	}
}

func TestMobileAccountIsolationAndExpiry(t *testing.T) {
	b, h := betaFixture(t)
	b.mobileEnabled = true
	a := mobileLogin(t, h, "alice-secret")
	z := mobileLogin(t, h, "bob-secret")
	if mobileCall(h, "POST", "/api/actions", a, "https://localhost", `{"paper":{"id":"private-paper"},"action":"save"}`).Code != 200 {
		t.Fatal("write failed")
	}
	w := mobileCall(h, "GET", "/api/library", z, "capacitor://localhost", "")
	if w.Code != 200 || strings.Contains(w.Body.String(), "private-paper") {
		t.Fatal("cross-account data leak")
	}
	b.sessions[tokenHash(a)] = betaSession{User: tokenHash("alice-secret"), Mobile: true, Expires: time.Now().Add(-time.Second)}
	if mobileCall(h, "GET", "/api/me", a, "https://localhost", "").Code != 401 {
		t.Fatal("expired token accepted")
	}
}
