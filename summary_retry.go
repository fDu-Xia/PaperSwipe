package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"
)

type summaryHTTPError struct{ Code int }

func (e summaryHTTPError) Error() string { return fmt.Sprintf("summary provider HTTP %d", e.Code) }
func summaryFailure(err error) string {
	var h summaryHTTPError
	if errors.As(err, &h) {
		switch h.Code {
		case 401, 403:
			return "AI 认证失败，请联系管理员检查密钥和权限"
		case 402:
			return "AI 账户额度不足，请联系管理员"
		case 429:
			return "AI 请求过于频繁，请稍后重试"
		case 400, 404:
			return "AI 模型或请求配置不正确，请联系管理员"
		}
	}
	if errors.Is(err, context.DeadlineExceeded) || errors.Is(err, context.Canceled) {
		return "AI 生成超时或中断，可单独重试"
	}
	return "AI 暂未返回有效摘要，可稍后单独重试"
}

func (a *API) retrySummary(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Paper       Paper             `json:"paper"`
		Preferences ReaderPreferences `json:"preferences"`
	}
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, 400, "无法读取论文信息")
		return
	}
	p := req.Paper
	if strings.TrimSpace(p.ID) == "" || strings.TrimSpace(p.Title) == "" || len(p.ID) > 512 || len([]rune(p.Title)) > 1000 || len([]rune(p.Abstract)) > 20000 {
		writeError(w, 400, "论文 ID、标题或摘要无效或过长")
		return
	}
	if !a.summarizer.Enabled() {
		writeError(w, 503, "AI 未配置，请联系管理员后重试")
		return
	}
	ctx, cancel := context.WithTimeout(withPreferences(r.Context(), req.Preferences), 35*time.Second)
	defer cancel()
	result, err := a.summarizer.summarizeWithLLM(ctx, "", []Paper{p}, 0)
	if err != nil {
		writeError(w, 502, summaryFailure(err))
		return
	}
	digest, ok := result[p.ID]
	if !ok || strings.TrimSpace(digest.Hook) == "" || strings.TrimSpace(digest.Verdict) == "" {
		writeError(w, 502, "AI 返回的摘要不完整，请重试")
		return
	}
	p.Digest = digest.Digest
	p.SummaryStatus = "success"
	p.SummaryMessage = "基于标题和摘要生成，未读取全文"
	p.SummaryModel = a.summarizer.Model()
	prefs := preferencesFrom(ctx)
	p.SummaryPreferences = &prefs
	// Update only this account's existing entry; never create a collection entry or change its action.
	if err := a.store.UpdateSummary(p); err != nil {
		writeError(w, 500, "摘要已生成，但收藏保存失败，请重试")
		return
	}
	writeJSON(w, 200, p)
}

func (s *Store) UpdateSummary(p Paper) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	entry, exists := s.state.Actions[p.ID]
	if !exists {
		return nil
	}
	previous := entry
	entry.Paper.Digest = p.Digest
	entry.Paper.SummaryStatus = p.SummaryStatus
	entry.Paper.SummaryMessage = p.SummaryMessage
	entry.Paper.SummaryModel = p.SummaryModel
	entry.Paper.SummaryPreferences = p.SummaryPreferences
	s.state.Actions[p.ID] = entry
	if err := s.saveLocked(); err != nil {
		s.state.Actions[p.ID] = previous
		return err
	}
	return nil
}
