package main

import (
	"net/http"
	"strings"
)

// Opt-in CORS is restricted to bundled Capacitor origins. An origin is NOT
// proof of an installed app: every private request still requires a bearer
// session. Cookies never authenticate this channel, including read requests.
func (b *Beta) mobileRequest(w http.ResponseWriter, r *http.Request) (mobile, handled bool) {
	origin := r.Header.Get("Origin")
	appOrigin := origin == "https://localhost" || origin == "capacitor://localhost"
	api := strings.HasPrefix(r.URL.Path, "/api/")
	preflight := r.Method == http.MethodOptions && api
	login := r.URL.Path == "/api/mobile/login"
	bearer := r.Header.Get("Authorization") != ""
	if !preflight && !login && !bearer && !appOrigin {
		return false, false
	}
	if !b.mobileEnabled || !api || !appOrigin {
		writeError(w, http.StatusForbidden, "App 接口未启用或请求来源无效")
		return false, true
	}
	w.Header().Add("Vary", "Origin")
	w.Header().Set("Access-Control-Allow-Origin", origin)
	w.Header().Set("Access-Control-Expose-Headers", "Retry-After")
	if preflight {
		method := r.Header.Get("Access-Control-Request-Method")
		if method != "GET" && method != "POST" {
			writeError(w, 403, "请求方法无效")
			return false, true
		}
		for _, header := range strings.Split(r.Header.Get("Access-Control-Request-Headers"), ",") {
			switch strings.ToLower(strings.TrimSpace(header)) {
			case "", "authorization", "content-type", "prefer":
			default:
				writeError(w, 403, "请求头无效")
				return false, true
			}
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, Prefer")
		w.WriteHeader(http.StatusNoContent)
		return false, true
	}
	if !login && (!strings.HasPrefix(r.Header.Get("Authorization"), "Bearer ") || r.URL.Path == "/api/login") {
		writeError(w, http.StatusUnauthorized, "请重新登录 App 内测账户")
		return false, true
	}
	return true, false
}
