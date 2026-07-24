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
	mux.HandleFunc("DELETE /api/searches", a.clearSearches)
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

	searchCtx, cancelSearch := context.WithTimeout(r.Context(), 28*time.Second)
	papers, source, err := a.searcher.Search(searchCtx, query, limit)
	cancelSearch()
	warning := ""
	if err != nil {
		a.logger.Warn("paper search failed; returning demo cards", "query", query, "error", err)
		papers = demoPapers(query)
		source = "PaperSwipe Demo"
		warning = "开放论文源暂时不可用，当前展示离线示例卡。稍后重试即可获取真实论文。"
	}
	summaryCtx, cancelSummary := context.WithTimeout(r.Context(), 55*time.Second)
	papers, aiApplied := a.summarizer.Summarize(summaryCtx, query, papers)
	cancelSummary()
	if err := a.store.RecordSearch(query); err != nil {
		a.logger.Warn("record search", "error", err)
	}
	writeJSON(w, http.StatusOK, SearchResponse{
		Query: query, Source: source, GeneratedAt: time.Now().UTC(), Total: len(papers),
		Papers: papers, Warning: warning, AIEnabled: aiApplied, ImageEnabled: a.images.Enabled(),
	})
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

func (a *API) clearSearches(w http.ResponseWriter, _ *http.Request) {
	if err := a.store.ClearSearches(); err != nil {
		writeError(w, http.StatusInternalServerError, "无法清除搜索历史")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
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

func demoPapers(query string) []Paper {
	return []Paper{
		{
			ID: "demo:memory-architecture", Title: "离线示例：面向复杂任务的长期记忆架构", Year: time.Now().Year(),
			Authors: []Author{{Name: "PaperSwipe Demo"}}, Venue: "离线演示", Fields: []string{"Artificial Intelligence", "Information Retrieval"},
			Abstract:   "This offline demo card illustrates how PaperSwipe separates working memory, episodic retrieval, and consolidation for long-running intelligent systems. It proposes a layered retrieval workflow and evaluates whether memory selection improves task continuity. The demo contains no claim about a real publication.",
			MatchScore: 91, ReadMinutes: 9, Source: "PaperSwipe Demo",
		},
		{
			ID: "demo:evidence-ranking", Title: "离线示例：用证据强度排序研究候选", Year: time.Now().Year(),
			Authors: []Author{{Name: "PaperSwipe Demo"}}, Venue: "离线演示", Fields: []string{"Information Retrieval", "Human-Computer Interaction"},
			Abstract:   "This offline demo studies a ranking workflow that combines topical relevance, result specificity, and source quality. It presents a compact evidence score and shows how transparent ranking cues can reduce screening time. The demo contains no claim about a real publication.",
			MatchScore: 84, ReadMinutes: 7, Source: "PaperSwipe Demo",
		},
		{
			ID: "demo:research-interface", Title: "离线示例：适合移动端的论文筛选交互", Year: time.Now().Year(),
			Authors: []Author{{Name: "PaperSwipe Demo"}}, Venue: "离线演示", Fields: []string{"Human-Computer Interaction"},
			Abstract:   "This offline demo explores swipe-based triage for research discovery. It compares rapid reject, save, and priority decisions and recommends preserving full metadata for later verification. The demo contains no claim about a real publication.",
			MatchScore: 76, ReadMinutes: 6, Source: "PaperSwipe Demo",
		},
	}
}
