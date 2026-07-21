package main

import (
	"path/filepath"
	"strings"
	"testing"
)

func TestHeuristicDigestUsesEvidence(t *testing.T) {
	paper := Paper{
		ID: "p1", Title: "Memory for Agents", MatchScore: 92, CitationCount: 120,
		Abstract: "Long-running agents struggle to retain useful context. We propose a layered memory framework with episodic retrieval and consolidation. Experiments show that the framework improves task completion over retrieval-only baselines.",
		Fields:   []string{"Artificial Intelligence"},
	}
	digest := heuristicDigest("AI agent memory", paper)
	if !strings.Contains(strings.ToLower(digest.Method), "propose") {
		t.Fatalf("expected method evidence, got %q", digest.Method)
	}
	if !strings.Contains(digest.WhyKeep, "120") {
		t.Fatalf("expected citation evidence, got %q", digest.WhyKeep)
	}
	if digest.Verdict == "" || digest.Problem == "" || digest.Result == "" {
		t.Fatal("digest fields must be populated")
	}
}

func TestStorePersistsActionsAndSearches(t *testing.T) {
	path := filepath.Join(t.TempDir(), "state.json")
	store, err := NewStore(path)
	if err != nil {
		t.Fatal(err)
	}
	paper := Paper{ID: "p1", Title: "A Paper"}
	if err := store.RecordAction(paper, "priority"); err != nil {
		t.Fatal(err)
	}
	readPaper := Paper{ID: "p2", Title: "A Read Paper"}
	if err := store.RecordAction(readPaper, "read"); err != nil {
		t.Fatal(err)
	}
	if err := store.RecordSearch("agent memory"); err != nil {
		t.Fatal(err)
	}

	reloaded, err := NewStore(path)
	if err != nil {
		t.Fatal(err)
	}
	if got := reloaded.Stats().Priority; got != 1 {
		t.Fatalf("priority count = %d, want 1", got)
	}
	if got := reloaded.Stats().Read; got != 1 {
		t.Fatalf("read count = %d, want 1", got)
	}
	if got := len(reloaded.Library()); got != 2 {
		t.Fatalf("library size = %d, want 2", got)
	}
	if got := reloaded.RecentSearches()[0].Query; got != "agent memory" {
		t.Fatalf("recent query = %q", got)
	}
}

func TestCalculateMatchScoreRewardsTitleCoverage(t *testing.T) {
	matched := calculateMatchScore("protein diffusion", "Protein diffusion models", "A method for generation", 0, 2025, 0)
	unmatched := calculateMatchScore("protein diffusion", "Graph optimization", "A method for routing", 0, 2025, 0)
	if matched <= unmatched {
		t.Fatalf("matched score %d should exceed unmatched score %d", matched, unmatched)
	}
}

func TestHeuristicTopicPlanExtractsSearchableConcepts(t *testing.T) {
	plan := heuristicTopicPlan("我想研究 LLM Agent 如何形成、检索并更新长期记忆，以及这些机制对复杂任务表现的影响。")
	joined := strings.Join(plan.Keywords, "|")
	for _, expected := range []string{"large language model agents", "long-term memory", "memory retrieval"} {
		if !strings.Contains(joined, expected) {
			t.Fatalf("keywords %q do not contain %q", joined, expected)
		}
	}
	if plan.SearchQuery == "" || len([]rune(plan.SearchQuery)) > 120 {
		t.Fatalf("invalid search query %q", plan.SearchQuery)
	}
}
