package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
)

func TestSummarizeBatchesLargeDeck(t *testing.T) {
	var requests atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		var request struct {
			Messages []struct {
				Content string `json:"content"`
			} `json:"messages"`
		}
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil || len(request.Messages) < 2 {
			http.Error(w, "invalid request", http.StatusBadRequest)
			return
		}
		prompt := request.Messages[len(request.Messages)-1].Content
		marker := strings.LastIndex(prompt, "Papers: ")
		if marker < 0 {
			http.Error(w, "missing papers", http.StatusBadRequest)
			return
		}
		var batch []struct {
			ID string `json:"id"`
		}
		if err := json.Unmarshal([]byte(prompt[marker+len("Papers: "):]), &batch); err != nil || len(batch) != summaryBatchSize {
			http.Error(w, "unexpected batch", http.StatusBadRequest)
			return
		}
		items := make([]llmDigest, 0, len(batch))
		for _, paper := range batch {
			items = append(items, llmDigest{ID: paper.ID, Digest: Digest{Verdict: "AI summary", Problem: "Research question"}})
		}
		content, _ := json.Marshal(llmDigestResponse{Papers: items})
		_ = json.NewEncoder(w).Encode(map[string]any{
			"choices": []any{map[string]any{"message": map[string]string{"content": string(content)}}},
		})
	}))
	defer server.Close()

	t.Setenv("LLM_API_KEY", "test-key")
	t.Setenv("LLM_BASE_URL", server.URL)
	t.Setenv("LLM_MODEL", "test-model")
	summarizer := NewSummarizer(server.Client())
	papers := make([]Paper, 20)
	for index := range papers {
		papers[index] = Paper{ID: fmt.Sprintf("paper-%d", index), Title: "Paper", Abstract: "Abstract"}
	}

	result, applied := summarizer.Summarize(context.Background(), "memory", papers)
	if !applied || requests.Load() != 2 {
		t.Fatalf("applied=%v requests=%d", applied, requests.Load())
	}
	for _, paper := range result {
		if paper.Digest.Verdict != "AI summary" {
			t.Fatalf("paper %s did not receive its AI digest", paper.ID)
		}
	}
}
