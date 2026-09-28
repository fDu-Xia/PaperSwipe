package main

import "testing"

func TestFallbackHookPreservesPaperTopic(t *testing.T) {
	title := "Game History: A Review of Social and Technical Changes in Video Games"
	got := buildChineseHook("memory", "agent", "retrieval", Paper{Title: title})
	if want := "研究主题（原题）：" + title; got != want {
		t.Fatalf("fallback invented or truncated content: %q", got)
	}
	if got := buildChineseHook("", "", "", Paper{}); got != "暂无足够的论文信息，暂不能生成可靠概括。" {
		t.Fatalf("missing evidence must be explicit: %q", got)
	}
}
