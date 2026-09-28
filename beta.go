package main

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/url"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
)

// Beta is deliberately single-process. Invite hashes are provisioned out of band.
type Beta struct {
	mu            sync.Mutex
	users         map[string]*API
	sessions      map[string]betaSession
	attempts      int
	attemptWindow time.Time
	slots         chan struct{}
	origin        string
	secure        bool
}
type betaSession struct {
	User    string
	Expires time.Time
}

func newBeta(base *API, dir, origin, invites string) (*Beta, error) {
	u, err := url.Parse(origin)
	if err != nil || u.Host == "" || u.Path != "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" || (u.Scheme != "https" && !(u.Scheme == "http" && (u.Hostname() == "localhost" || u.Hostname() == "127.0.0.1"))) {
		return nil, fmt.Errorf("PUBLIC_ORIGIN must be an HTTPS origin (HTTP allowed only on localhost), without trailing slash")
	}
	b := &Beta{users: map[string]*API{}, sessions: map[string]betaSession{}, slots: make(chan struct{}, 2), origin: origin, secure: u.Scheme == "https"}
	ids := map[string]bool{}
	for _, entry := range strings.Split(invites, ",") {
		id, hash, ok := strings.Cut(strings.TrimSpace(entry), ":")
		id = strings.ToLower(id)
		hash = strings.ToLower(hash)
		decoded, e := hex.DecodeString(hash)
		if !ok || !regexp.MustCompile(`^[a-zA-Z0-9_-]{1,40}$`).MatchString(id) || e != nil || len(decoded) != 32 || ids[id] || b.users[hash] != nil {
			return nil, fmt.Errorf("BETA_INVITES requires unique user:sha256 pairs")
		}
		s, e := NewStore(filepath.Join(dir, "users", id+".json"))
		if e != nil {
			return nil, e
		}
		a := *base
		a.cache = newSearchCache()
		a.store = s
		a.images = &ImageGenerator{}
		b.users[hash] = &a
		ids[id] = true
	}
	return b, nil
}

func randomToken() string {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		panic(err)
	}
	return hex.EncodeToString(buf)
}
func tokenHash(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func (b *Beta) Handler(static http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "same-origin")
		r.Body = http.MaxBytesReader(w, r.Body, 64<<10)
		if r.Method != "GET" && r.Method != "HEAD" && r.Header.Get("Origin") != b.origin {
			writeError(w, 403, "请求来源无效")
			return
		}
		if r.URL.Path == "/api/health" {
			writeJSON(w, 200, map[string]bool{"ok": true})
			return
		}
		if r.URL.Path == "/api/login" {
			if r.Method != "POST" {
				writeError(w, 405, "请使用 POST")
				return
			}
			b.mu.Lock()
			if time.Since(b.attemptWindow) > time.Minute {
				b.attempts = 0
				b.attemptWindow = time.Now()
			}
			b.attempts++
			allowed := b.attempts <= 30
			b.mu.Unlock()
			if !allowed {
				writeError(w, 429, "登录尝试过多，请一分钟后重试")
				return
			}
			var input struct {
				Token string `json:"token"`
			}
			if decodeJSON(w, r, &input) != nil {
				writeError(w, 400, "请输入邀请凭证")
				return
			}
			hash := tokenHash(strings.TrimSpace(input.Token))
			if b.users[hash] == nil {
				writeError(w, 401, "邀请凭证无效或已撤销")
				return
			}
			token := randomToken()
			b.mu.Lock()
			// One active session per invite bounds memory and invalidates previous logins.
			for key, s := range b.sessions {
				if s.User == hash || time.Now().After(s.Expires) {
					delete(b.sessions, key)
				}
			}
			b.sessions[tokenHash(token)] = betaSession{hash, time.Now().Add(7 * 24 * time.Hour)}
			b.mu.Unlock()
			http.SetCookie(w, &http.Cookie{Name: "paperswipe_session", Value: token, Path: "/", HttpOnly: true, Secure: b.secure, SameSite: http.SameSiteStrictMode, MaxAge: 604800})
			writeJSON(w, 200, map[string]bool{"ok": true})
			return
		}
		cookie, err := r.Cookie("paperswipe_session")
		var s betaSession
		b.mu.Lock()
		if err == nil {
			s = b.sessions[tokenHash(cookie.Value)]
		}
		b.mu.Unlock()
		a := b.users[s.User]
		authenticated := a != nil && time.Now().Before(s.Expires)
		if r.URL.Path == "/login" {
			data, _ := webFiles.ReadFile("web/login.html")
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Write(data)
			return
		}
		// Only this public brand asset is accessible without an invitation.
		if r.URL.Path == "/assets/paperswipe-logo.png" && (r.Method == "GET" || r.Method == "HEAD") {
			data, err := webFiles.ReadFile("web/assets/paperswipe-logo.png")
			if err != nil {
				http.NotFound(w, r)
				return
			}
			w.Header().Set("Content-Type", "image/png")
			if r.Method == "GET" {
				w.Write(data)
			}
			return
		}
		if !authenticated {
			if strings.HasPrefix(r.URL.Path, "/api/") {
				writeError(w, 401, "请重新登录内测账户")
			} else {
				http.Redirect(w, r, "/login", http.StatusSeeOther)
			}
			return
		}
		if r.URL.Path == "/api/logout" {
			if r.Method != "POST" {
				writeError(w, 405, "请使用 POST")
				return
			}
			b.mu.Lock()
			delete(b.sessions, tokenHash(cookie.Value))
			b.mu.Unlock()
			http.SetCookie(w, &http.Cookie{Name: "paperswipe_session", Path: "/", MaxAge: -1, HttpOnly: true, Secure: b.secure, SameSite: http.SameSiteStrictMode})
			writeJSON(w, 200, map[string]bool{"ok": true})
			return
		}
		if r.URL.Path == "/api/me" {
			writeJSON(w, 200, map[string]any{"beta": true, "user": strings.TrimSuffix(filepath.Base(a.store.path), ".json")})
			return
		}
		if r.URL.Path == "/api/paper-image" {
			writeError(w, 403, "内测暂未开放生图")
			return
		}
		costly := r.URL.Path == "/api/search" || r.URL.Path == "/api/topic-plan" || r.URL.Path == "/api/summary-retry"
		// Authenticated cache hits need neither a provider slot nor daily generation quota.
		if a.tryCachedSearch(w, r) {
			return
		}
		if costly {
			select {
			case b.slots <- struct{}{}:
				defer func() { <-b.slots }()
			default:
				writeError(w, 429, "当前使用人数较多，请稍后重试")
				return
			}
			if err := a.store.ConsumeQuota(); err != nil {
				writeError(w, 429, err.Error())
				return
			}
		}
		a.Routes(static).ServeHTTP(w, r)
	})
}

// Persist usage with user data so restarting does not reset the daily allowance.
func (s *Store) ConsumeQuota() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	day := time.Now().In(time.FixedZone("CST", 8*3600)).Format("2006-01-02")
	oldDay, oldCount := s.state.QuotaDay, s.state.QuotaCount
	if s.state.QuotaDay != day {
		s.state.QuotaDay = day
		s.state.QuotaCount = 0
	}
	if s.state.QuotaCount >= 20 {
		return fmt.Errorf("今日检索与主题分析额度已用完（20 次），北京时间零点重置")
	}
	s.state.QuotaCount++
	if err := s.saveLocked(); err != nil {
		s.state.QuotaDay = oldDay
		s.state.QuotaCount = oldCount
		return fmt.Errorf("额度保存失败，请稍后重试")
	}
	return nil
}
