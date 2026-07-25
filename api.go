package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type API struct {
	searcher   *PaperSearcher
	summarizer *Summarizer
	images     *ImageGenerator
	store      *Store
	logger     *slog.Logger
}

func NewAPI(searcher *PaperSearcher, summarizer *Summarizer, images *ImageGenerator, store *Store, logger *slog.Logger) *API {
	return &API{searcher: searcher, summarizer: summarizer, images: images, store: store, logger: logger}
}

func (a *API) Routes(static http.Handler) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", a.health)
	mux.HandleFunc("POST /api/topic-plan", a.topicPlan)
	mux.HandleFunc("POST /api/paper-image", a.paperImage)
	mux.HandleFunc("GET /api/search", a.search)
	mux.HandleFunc("POST /api/actions", a.actions)
	mux.HandleFunc("GET /api/library", a.library)
	mux.HandleFunc("GET /api/stats", a.stats)
	mux.HandleFunc("GET /api/searches", a.searches)
	mux.Handle("/", static)
	return requestLogger(a.logger, securityHeaders(mux))
}

func (a *API) topicPlan(w http.ResponseWriter, r *http.Request) {
	var request TopicPlanRequest
	if err := decodeJSON(w, r, &request); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	description := cleanSpace(request.Description)
	length := len([]rune(description))
	if length < 6 || length > 360 {
		writeError(w, http.StatusBadRequest, "请用 6 到 360 个字符描述研究兴趣")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 12*time.Second)
	defer cancel()
	plan, usedAI := a.summarizer.PlanTopic(ctx, description)
	plan.AIEnabled = usedAI
	writeJSON(w, http.StatusOK, plan)
}

func (a *API) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":            true,
		"ai_enabled":    a.summarizer.Enabled(),
		"ai_model":      a.summarizer.Model(),
		"image_enabled": a.images.Enabled(),
		"image_model":   a.images.Model(),
		"time":          time.Now().UTC(),
	})
}

func (a *API) paperImage(w http.ResponseWriter, r *http.Request) {
	var request PaperImageRequest
	if err := decodeJSON(w, r, &request); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	request.PaperID = cleanSpace(request.PaperID)
	request.Title = cleanSpace(request.Title)
	request.Abstract = cleanSpace(request.Abstract)
	if length := len([]rune(request.Title)); length < 2 || length > 300 {
		writeError(w, http.StatusBadRequest, "论文标题长度必须在 2 到 300 个字符之间")
		return
	}
	if len([]rune(request.Abstract)) > 4000 {
		writeError(w, http.StatusBadRequest, "论文摘要不能超过 4000 个字符")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 120*time.Second)
	defer cancel()
	result, err := a.images.GeneratePaperVisual(ctx, request)
	if err != nil {
		a.logger.Warn("paper image generation failed", "paper_id", request.PaperID, "error", err)
		var providerError *ImageProviderError
		if errors.As(err, &providerError) && providerError.StatusCode == http.StatusTooManyRequests {
			writeError(w, http.StatusTooManyRequests, "生图请求过于频繁，请稍后约 1 分钟再试")
			return
		}
		writeError(w, http.StatusBadGateway, "生成论文视觉图失败，请稍后重试")
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (a *API) search(w http.ResponseWriter, r *http.Request) {
	query := cleanSpace(r.URL.Query().Get("q"))
	if len([]rune(query)) < 2 || len([]rune(query)) > 120 {
		writeError(w, http.StatusBadRequest, "请输入 2 到 120 个字符的研究方向")
		return
	}
	limit := 20
	if raw := r.URL.Query().Get("limit"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed < 3 || parsed > 30 {
			writeError(w, http.StatusBadRequest, "limit 必须在 3 到 30 之间")
			return
		}
		limit = parsed
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, http.StatusInternalServerError, "streaming unsupported")
		return
	}

	searchCtx, cancelSearch := context.WithTimeout(r.Context(), 28*time.Second)
	logFlow("========== 新检索开始 ==========")
	logFlow("【总览】检索词=%q | limit=%d | AI 摘要=%v | 模型=%s", query, limit, a.summarizer.Enabled(), a.summarizer.Model())
	a.logger.Info("search start", "query", query, "limit", limit)
	searchStart := time.Now()
	papers, source, err := a.searcher.Search(searchCtx, query, limit)
	cancelSearch()
	a.logger.Info("search fetched", "query", query, "duration", time.Since(searchStart).Round(time.Millisecond), "papers", len(papers), "source", source, "err", err)
	warning := ""
	if err != nil {
		a.logger.Warn("paper search failed", "query", query, "error", err)
		logFlow("【总览】检索失败：%v", err)
		warning = "开放论文源暂时不可用，请稍后重试。"
		papers = nil
	} else {
		logFlow("【总览】检索完成（耗时 %s）→ 来源=%s | 共 %d 篇，接下来交给 AI 生成卡片摘要", time.Since(searchStart).Round(time.Millisecond), source, len(papers))
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)

	writeEvent := func(event string, payload any) bool {
		data, err := json.Marshal(payload)
		if err != nil {
			a.logger.Warn("sse marshal", "event", event, "error", err)
			return false
		}
		if _, err := fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event, data); err != nil {
			return false
		}
		flusher.Flush()
		return true
	}

	writeEvent("meta", map[string]any{
		"query":         query,
		"source":        source,
		"total":         len(papers),
		"warning":       warning,
		"ai_enabled":    a.summarizer.Enabled(),
		"image_enabled": a.images.Enabled(),
		"generated_at":  time.Now().UTC(),
	})

	if err := a.store.RecordSearch(query); err != nil {
		a.logger.Warn("record search", "error", err)
	}

	if len(papers) == 0 {
		logFlow("【总览】无论文可摘要，结束")
		logFlow("========== 检索结束 ==========")
		writeEvent("done", map[string]any{"ai_applied": false})
		return
	}

	summaryCtx, cancelSummary := context.WithTimeout(r.Context(), 300*time.Second)
	defer cancelSummary()
	summaryStart := time.Now()
	a.logger.Info("summary start", "query", query, "papers", len(papers))
	aiApplied := a.summarizer.SummarizeStream(summaryCtx, query, papers, func(batch []Paper) {
		writeEvent("batch", map[string]any{"papers": batch})
	})
	a.logger.Info("summary done", "query", query, "duration", time.Since(summaryStart).Round(time.Millisecond), "ai_applied", aiApplied)
	logFlow("【总览】全流程完成 | AI 摘要 applied=%v | 摘要耗时 %s", aiApplied, time.Since(summaryStart).Round(time.Millisecond))
	logFlow("========== 检索结束 ==========")

	writeEvent("done", map[string]any{"ai_applied": aiApplied})
}

func (a *API) actions(w http.ResponseWriter, r *http.Request) {
	var request ActionRequest
	if err := decodeJSON(w, r, &request); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := a.store.RecordAction(request.Paper, request.Action); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "stats": a.store.Stats()})
}

func (a *API) library(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"papers": a.store.Library()})
}

func (a *API) stats(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, a.store.Stats())
}

func (a *API) searches(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"searches": a.store.RecentSearches()})
}

func decodeJSON(w http.ResponseWriter, r *http.Request, destination any) error {
	defer r.Body.Close()
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 2<<20))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(destination); err != nil {
		return fmt.Errorf("请求数据无效: %w", err)
	}
	return nil
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		next.ServeHTTP(w, r)
	})
}

func requestLogger(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		started := time.Now()
		next.ServeHTTP(w, r)
		if strings.HasPrefix(r.URL.Path, "/api/") {
			logger.Info("request", "method", r.Method, "path", r.URL.Path, "duration", time.Since(started).Round(time.Millisecond))
		}
	})
}
