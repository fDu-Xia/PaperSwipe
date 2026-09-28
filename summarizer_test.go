package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
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
		if err := json.Unmarshal([]byte(prompt[marker+len("Papers: "):]), &batch); err != nil || len(batch) == 0 || len(batch) > summaryBatchSize {
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
	expectedBatches := int32((len(papers) + summaryBatchSize - 1) / summaryBatchSize)
	if !applied || requests.Load() != expectedBatches {
		t.Fatalf("applied=%v requests=%d expected=%d", applied, requests.Load(), expectedBatches)
	}
	for _, paper := range result {
		if paper.Digest.Verdict != "AI summary" {
			t.Fatalf("paper %s did not receive its AI digest", paper.ID)
		}
	}
}

// TestSummarizeStreamOrder verifies that SummarizeStream emits batches in the
// original paper order even when later batches finish first at the LLM.
func TestSummarizeStreamOrder(t *testing.T) {
	// Fake LLM server that delays batch responses so that earlier batches
	// arrive LATER than later batches — this stresses the in-order coordinator.
	var callSeq atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
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
		var batch []struct {
			ID string `json:"id"`
		}
		if err := json.Unmarshal([]byte(prompt[marker+len("Papers: "):]), &batch); err != nil {
			http.Error(w, "unexpected batch", http.StatusBadRequest)
			return
		}
		// Give later batches shorter delays so they finish first.
		seq := callSeq.Add(1)
		delay := time.Duration(200-int(seq)*20) * time.Millisecond
		if delay < 0 {
			delay = 0
		}
		time.Sleep(delay)
		items := make([]llmDigest, 0, len(batch))
		for _, paper := range batch {
			items = append(items, llmDigest{ID: paper.ID, Digest: Digest{Verdict: "AI summary", Hook: "A specific research finding"}})
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

	total := 9
	papers := make([]Paper, total)
	for i := range papers {
		papers[i] = Paper{ID: fmt.Sprintf("paper-%d", i), Title: "T", Abstract: "A"}
	}

	var mu sync.Mutex
	var emitted []string
	applied := summarizer.SummarizeStream(context.Background(), "memory", papers, func(batch []Paper) {
		mu.Lock()
		defer mu.Unlock()
		for _, p := range batch {
			emitted = append(emitted, p.ID)
		}
	})
	if !applied {
		t.Fatalf("expected applied=true")
	}
	if len(emitted) != total {
		t.Fatalf("expected %d emitted papers, got %d", total, len(emitted))
	}
	for i, id := range emitted {
		want := fmt.Sprintf("paper-%d", i)
		if id != want {
			t.Fatalf("emit order broken at %d: got %s want %s", i, id, want)
		}
	}
}
