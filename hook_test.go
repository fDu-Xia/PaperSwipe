package main

import "testing"

func TestFallbackHookPreservesPaperTopic(t *testing.T) {
	title := "Game History: A Review of Social and Technical Changes in Video Games"
	got := buildChineseHook("memory", "agent", "retrieval", Paper{Title: title})
	if want := "暂无足够的论文信息，暂不能生成可靠概括。"; got != want {
		t.Fatalf("fallback invented or truncated content: %q", got)
	}
	if got := buildChineseHook("", "", "", Paper{}); got != "暂无足够的论文信息，暂不能生成可靠概括。" {
		t.Fatalf("missing evidence must be explicit: %q", got)
	}
}

func TestFallbackHookQuotesEvidenceNotTitle(t *testing.T) {
	const abstract = "Memory is an important problem. We review external memory, learned skills and interaction protocols in language agents."
	got := buildChineseHook("", "", "", Paper{Title: "Externalization in LLM Agents", Abstract: abstract})
	if got != "We review external memory, learned skills and interaction protocols in language agents." {
		t.Fatalf("expected an intact evidence sentence, got %q", got)
	}
	for _, bad := range []string{"", "A paper title", "研究主题（原题）：A paper title"} {
		if validPaperHook(bad, "A paper title") {
			t.Fatalf("accepted placeholder %q", bad)
		}
	}
	if !validPaperHook("先查资料再回答，可以减少编造。", "A paper title") {
		t.Fatal("rejected a concrete hook")
	}
}
