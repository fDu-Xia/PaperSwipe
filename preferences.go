package main

import (
	"context"
	"fmt"
	"sort"
	"strings"
)

type ReaderPreferences struct {
	Identity       string `json:"identity"`
	DiscoveryStyle string `json:"discoveryStyle"`
	Complexity     int    `json:"complexity"`
}
type readerPreferenceKey struct{}

func normalizePreferences(p ReaderPreferences) ReaderPreferences {
	if p.Identity != "researcher" && p.Identity != "enthusiast" {
		p.Identity = "graduate"
	}
	if p.DiscoveryStyle != "broaden" {
		p.DiscoveryStyle = "focus"
	}
	if p.Complexity < 1 || p.Complexity > 5 {
		p.Complexity = 3
	}
	return p
}
func withPreferences(ctx context.Context, p ReaderPreferences) context.Context {
	return context.WithValue(ctx, readerPreferenceKey{}, normalizePreferences(p))
}
func preferencesFrom(ctx context.Context) ReaderPreferences {
	p, _ := ctx.Value(readerPreferenceKey{}).(ReaderPreferences)
	return normalizePreferences(p)
}
func readerInstructions(ctx context.Context) string {
	p := preferencesFrom(ctx)
	role := map[string]string{
		"graduate":   "面向研究生：解释研究问题、可学习的方法和阅读论文时应核对的证据。",
		"researcher": "面向研究人员：突出与已有方法的差异、评估条件、局限及可复现性；摘要未提供的内容明确说明未知。",
		"enthusiast": "面向非专业爱好者：先解释研究对象与实际意义，不假定读者有本领域知识。",
	}[p.Identity]
	levels := []string{
		"日常语言，不使用未解释的专业术语；每个字段用一个短句。",
		"易读解释，必要术语紧接通俗说明；每个字段最多两句。",
		"平衡表达，解释核心方法与发现，首次出现的关键术语要解释。",
		"较深入，保留核心术语、实验条件和证据限制，但避免术语堆叠。",
		"专业阅读，保留摘要中的技术名称、定量结果、比较条件及局限，不推断摘要外的实验细节。",
	}
	return fmt.Sprintf("\nReader preferences (apply to every digest, especially audience and reading_focus):\n%s\n阅读难度 %d/5：%s\n除必要专有名词外，所有解释字段使用简体中文。正面 hook 始终保持一句通俗核心概括，不因专家身份变成术语堆砌。身份和难度只能改变解释方式，不能改变事实。\n", role, p.Complexity, levels[p.Complexity-1])
}

// Focus preserves topical relevance; Broaden samples more distinct fields/authors
// from a larger, same-query pool. It never invents adjacent search interests.
func selectForReader(papers []Paper, query string, limit int, prefs ReaderPreferences) []Paper {
	pool := append([]Paper(nil), papers...)
	terms := strings.Fields(strings.ToLower(query))
	score := func(p Paper) int {
		n := 0
		title, abstract := strings.ToLower(p.Title), strings.ToLower(p.Abstract)
		for _, term := range terms {
			if strings.Contains(title, term) {
				n += 3
			}
			if strings.Contains(abstract, term) {
				n++
			}
		}
		return n
	}
	sort.SliceStable(pool, func(i, j int) bool { return score(pool[i]) > score(pool[j]) })
	out := make([]Paper, 0, min(limit, len(pool)))
	seen := map[string]bool{}
	groups := map[string]int{}
	for len(pool) > 0 && len(out) < limit {
		chosen := 0
		group := func(p Paper) string {
			if len(p.Fields) > 0 {
				return p.Fields[0]
			}
			if len(p.Authors) > 0 {
				return p.Authors[0].Name
			}
			return p.Source
		}
		if prefs.DiscoveryStyle == "broaden" && len(out) > 0 {
			for i := 1; i < len(pool); i++ {
				if groups[group(pool[i])] < groups[group(pool[chosen])] {
					chosen = i
				}
			}
		}
		p := pool[chosen]
		pool = append(pool[:chosen], pool[chosen+1:]...)
		key := strings.ToLower(strings.TrimSpace(p.Title))
		if key == "" {
			key = p.ID
		}
		if seen[key] {
			continue
		}
		seen[key] = true
		groups[group(p)]++
		out = append(out, p)
	}
	return out
}
