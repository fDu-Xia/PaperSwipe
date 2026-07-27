package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

const (
	summaryBatchSize      = 3
	summaryMaxConcurrency = 3
)

var llmCallSeq atomic.Uint64

func logFlow(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "[流程] "+format+"\n", args...)
}

// cardRangeLabel 把 0-based [start,end) 转成「卡片1、卡片2、卡片3」
func cardRangeLabel(start, end int) string {
	parts := make([]string, 0, end-start)
	for i := start; i < end; i++ {
		parts = append(parts, fmt.Sprintf("卡片%d", i+1))
	}
	return strings.Join(parts, "、")
}

type Summarizer struct {
	client           *http.Client
	apiKey           string
	baseURL          string
	model            string
	thinking         string
	reasoningEffort  string
	maxTokens        int
}

func NewSummarizer(client *http.Client) *Summarizer {
	baseURL := strings.TrimRight(strings.TrimSpace(os.Getenv("LLM_BASE_URL")), "/")
	if baseURL == "" {
		baseURL = "https://api.openai.com/v1"
	}
	model := strings.TrimSpace(os.Getenv("LLM_MODEL"))
	if model == "" {
		model = "gpt-4.1-mini"
	}
	maxTokens := 0
	if raw := strings.TrimSpace(os.Getenv("LLM_MAX_TOKENS")); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil && n > 0 {
			maxTokens = n
		}
	}
	return &Summarizer{
		client:          client,
		apiKey:          firstEnv("LLM_API_KEY", "ZHIPU_API_KEY"),
		baseURL:         baseURL,
		model:           model,
		thinking:        strings.ToLower(strings.TrimSpace(os.Getenv("LLM_THINKING"))),
		reasoningEffort: strings.ToLower(strings.TrimSpace(os.Getenv("LLM_REASONING_EFFORT"))),
		maxTokens:       maxTokens,
	}
}

func (s *Summarizer) Enabled() bool {
	return s.apiKey != ""
}

func (s *Summarizer) Model() string {
	return s.model
}

func (s *Summarizer) applyProviderOptions(payload map[string]any) {
	if s.thinking == "enabled" || s.thinking == "disabled" {
		payload["thinking"] = map[string]string{"type": s.thinking}
	}
	if s.reasoningEffort != "" {
		payload["reasoning_effort"] = s.reasoningEffort
	}
	if s.maxTokens > 0 {
		payload["max_tokens"] = s.maxTokens
	}
}

func (s *Summarizer) PlanTopic(ctx context.Context, description string) (TopicPlan, bool) {
	fallback := heuristicTopicPlan(description)
	if !s.Enabled() {
		logFlow("【选题】AI 未启用，改用本地启发式拆词 → 关键词=%v", fallback.Keywords)
		return fallback, false
	}

	logFlow("【选题】AI 开始：把研究兴趣拆成检索词 | 模型=%s | 描述=%q", s.model, description)
	started := time.Now()
	plan, err := s.planTopicWithLLM(ctx, description)
	if err != nil {
		logFlow("【选题】AI 失败（耗时 %s）：%v → 回退本地启发式", time.Since(started).Round(time.Millisecond), err)
		return fallback, false
	}
	plan = normalizeTopicPlan(description, plan)
	if plan.SearchQuery == "" || len(plan.Keywords) == 0 {
		logFlow("【选题】AI 返回空结果（query=%q keywords=%v）→ 回退本地启发式", plan.SearchQuery, plan.Keywords)
		return fallback, false
	}
	logFlow("【选题】AI 完成（耗时 %s）→ 检索词=%q | 关键词=%v", time.Since(started).Round(time.Millisecond), plan.SearchQuery, plan.Keywords)
	return plan, true
}

func (s *Summarizer) planTopicWithLLM(ctx context.Context, description string) (TopicPlan, error) {
	prompt := fmt.Sprintf(`你是学术检索策略助手。请把用户的自然语言研究兴趣拆成 3 到 6 个精确的英文学术关键词或短语，并生成一条不超过 120 个字符的英文论文检索词。保留用户提到的研究对象、方法、场景、数据集或评价维度；去掉“我想了解”等无检索价值的表达，不要扩展到用户没有表达的领域。返回 JSON 对象，格式为 {"search_query":"...","keywords":["...","..."]}。用户描述：%q`, description)
	payload := map[string]any{
		"model": s.model,
		"messages": []map[string]string{
			{"role": "system", "content": "Return valid JSON only. Produce concise, evidence-bound academic search terms."},
			{"role": "user", "content": prompt},
		},
		"temperature":     0.1,
		"response_format": map[string]string{"type": "json_object"},
	}
	s.applyProviderOptions(payload)
	body, _ := json.Marshal(payload)
	callID := llmCallSeq.Add(1)
	logFlow("【选题】调用 #%d 发送请求 → %s | 模型=%s | 载荷=%d 字节", callID, s.baseURL+"/chat/completions", s.model, len(body))
	logFlow("【选题】调用 #%d Prompt ↓↓↓\n%s\n↑↑↑ Prompt 结束", callID, prompt)
	sendStart := time.Now()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.baseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return TopicPlan{}, err
	}
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	req.Header.Set("Content-Type", "application/json")

	logFlow("【选题】调用 #%d 等待 AI 返回选题结果中…", callID)
	resp, err := s.client.Do(req)
	if err != nil {
		logFlow("【选题】调用 #%d 网络错误（耗时 %s）：%v", callID, time.Since(sendStart).Round(time.Millisecond), err)
		return TopicPlan{}, err
	}
	defer resp.Body.Close()
	logFlow("【选题】调用 #%d 已收到响应头 status=%d（耗时 %s），正在读取正文…", callID, resp.StatusCode, time.Since(sendStart).Round(time.Millisecond))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		message, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		logFlow("【选题】调用 #%d HTTP 错误正文：%s", callID, strings.TrimSpace(string(message)))
		return TopicPlan{}, fmt.Errorf("LLM status %d: %s", resp.StatusCode, strings.TrimSpace(string(message)))
	}
	var response struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&response); err != nil {
		logFlow("【选题】调用 #%d 解析响应失败（耗时 %s）：%v", callID, time.Since(sendStart).Round(time.Millisecond), err)
		return TopicPlan{}, err
	}
	if len(response.Choices) == 0 {
		logFlow("【选题】调用 #%d AI 返回空 choices（耗时 %s）", callID, time.Since(sendStart).Round(time.Millisecond))
		return TopicPlan{}, fmt.Errorf("LLM returned no choices")
	}
	rawContent := response.Choices[0].Message.Content
	logFlow("【选题】调用 #%d AI 已返回（耗时 %s，%d 字节）", callID, time.Since(sendStart).Round(time.Millisecond), len(rawContent))
	logFlow("【选题】调用 #%d AI 返回内容 ↓↓↓\n%s\n↑↑↑ AI 内容结束", callID, rawContent)
	var plan TopicPlan
	if err := json.Unmarshal([]byte(rawContent), &plan); err != nil {
		logFlow("【选题】调用 #%d JSON 解析失败：%v", callID, err)
		return TopicPlan{}, err
	}
	return plan, nil
}

type topicConcept struct {
	keyword  string
	triggers []string
}

var topicConcepts = []topicConcept{
	{keyword: "large language model agents", triggers: []string{"llm agent", "language model agent", "大语言模型智能体", "语言模型智能体"}},
	{keyword: "large language models", triggers: []string{"large language model", " llm", "大语言模型", "语言模型"}},
	{keyword: "long-term memory", triggers: []string{"long-term memory", "long term memory", "长期记忆"}},
	{keyword: "memory retrieval", triggers: []string{"memory retrieval", "记忆检索", "检索并更新", "形成、检索"}},
	{keyword: "memory consolidation", triggers: []string{"memory consolidation", "记忆巩固", "记忆更新", "更新长期记忆"}},
	{keyword: "retrieval-augmented generation", triggers: []string{"retrieval-augmented", "retrieval augmented", " rag", "检索增强"}},
	{keyword: "vision foundation models", triggers: []string{"vision foundation model", "视觉基础模型"}},
	{keyword: "medical image segmentation", triggers: []string{"medical image segmentation", "医学影像分割", "医学图像分割"}},
	{keyword: "few-shot learning", triggers: []string{"few-shot", "few shot", "小样本"}},
	{keyword: "domain generalization", triggers: []string{"domain generalization", "泛化能力", "领域泛化"}},
	{keyword: "data efficiency", triggers: []string{"data efficiency", "数据效率"}},
	{keyword: "graph neural networks", triggers: []string{"graph neural network", "图神经网络"}},
	{keyword: "climate prediction", triggers: []string{"climate prediction", "climate change prediction", "气候变化预测", "气候预测"}},
	{keyword: "explainable AI", triggers: []string{"explainable", "interpretable", "可解释"}},
	{keyword: "spatiotemporal modeling", triggers: []string{"spatiotemporal", "spatio-temporal", "时空建模"}},
	{keyword: "uncertainty estimation", triggers: []string{"uncertainty estimation", "不确定性估计"}},
	{keyword: "diffusion models", triggers: []string{"diffusion model", "扩散模型"}},
	{keyword: "multimodal learning", triggers: []string{"multimodal", "多模态"}},
	{keyword: "human-computer interaction", triggers: []string{"human-computer interaction", "human computer interaction", "人机交互"}},
	{keyword: "recommendation systems", triggers: []string{"recommendation system", "recommender system", "推荐系统"}},
}

var englishTopicWordPattern = regexp.MustCompile(`[A-Za-z][A-Za-z0-9+.-]*`)

var topicStopWords = map[string]bool{
	"about": true, "and": true, "application": true, "applications": true, "are": true,
	"find": true, "for": true, "how": true, "into": true, "learn": true, "looking": true,
	"method": true, "methods": true, "research": true, "study": true, "that": true, "the": true,
	"these": true, "this": true, "understand": true, "using": true, "want": true, "with": true,
}

func heuristicTopicPlan(description string) TopicPlan {
	description = cleanSpace(description)
	lower := strings.ToLower(" " + description)
	keywords := make([]string, 0, 6)
	for _, concept := range topicConcepts {
		for _, trigger := range concept.triggers {
			if strings.Contains(lower, trigger) {
				keywords = append(keywords, concept.keyword)
				break
			}
		}
		if len(keywords) == 6 {
			break
		}
	}

	if len(keywords) < 3 {
		for _, word := range englishTopicWordPattern.FindAllString(description, -1) {
			key := strings.ToLower(word)
			if len(key) < 3 || topicStopWords[key] {
				continue
			}
			keywords = append(keywords, word)
			if len(compactStrings(keywords, 6)) == 6 {
				break
			}
		}
	}
	keywords = compactStrings(keywords, 6)
	if len(keywords) == 0 {
		keywords = []string{truncateRunes(description, 72)}
	}
	plan := TopicPlan{Intent: description, Keywords: keywords, SearchQuery: strings.Join(keywords, " ")}
	return normalizeTopicPlan(description, plan)
}

func normalizeTopicPlan(description string, plan TopicPlan) TopicPlan {
	plan.Intent = cleanSpace(description)
	cleanedKeywords := make([]string, 0, len(plan.Keywords))
	for _, keyword := range plan.Keywords {
		keyword = truncateRunes(cleanSpace(keyword), 48)
		if keyword != "" {
			cleanedKeywords = append(cleanedKeywords, keyword)
		}
	}
	plan.Keywords = compactStrings(cleanedKeywords, 6)
	plan.SearchQuery = truncateRunes(cleanSpace(plan.SearchQuery), 120)
	if plan.SearchQuery == "" {
		plan.SearchQuery = strings.Join(plan.Keywords, " ")
	}
	return plan
}

func truncateRunes(value string, maxRunes int) string {
	runes := []rune(value)
	if len(runes) <= maxRunes {
		return value
	}
	return strings.TrimSpace(string(runes[:maxRunes]))
}

func (s *Summarizer) Summarize(ctx context.Context, query string, papers []Paper) ([]Paper, bool) {
	for i := range papers {
		papers[i].Digest = heuristicDigest(query, papers[i])
	}
	if !s.Enabled() || len(papers) == 0 {
		logFlow("【卡片】AI 未启用或无论文（ai=%v papers=%d）→ 使用本地启发式摘要", s.Enabled(), len(papers))
		return papers, false
	}

	batchCount := (len(papers) + summaryBatchSize - 1) / summaryBatchSize
	logFlow("【卡片】AI 开始生成摘要 | 检索词=%q | 共 %d 篇 → %d 批（每批最多 %d 篇，并发 %d）| 模型=%s",
		query, len(papers), batchCount, summaryBatchSize, summaryMaxConcurrency, s.model)
	started := time.Now()
	digests := s.summarizeInBatches(ctx, query, papers)
	applied := false
	for i := range papers {
		if item, ok := digests[papers[i].ID]; ok && item.Verdict != "" {
			papers[i].Digest = item.Digest
			if item.ReadMinutes > 0 {
				papers[i].ReadMinutes = clampReadMinutes(item.ReadMinutes)
			}
			applied = true
		}
	}
	logFlow("【卡片】AI 摘要全部完成（耗时 %s）| 成功 %d/%d 篇 applied=%v",
		time.Since(started).Round(time.Millisecond), len(digests), len(papers), applied)
	return papers, applied
}

func clampReadMinutes(v int) int {
	if v < 10 {
		return 10
	}
	if v > 240 {
		return 240
	}
	return v
}

// SummarizeStream runs the same summarization pipeline as Summarize but emits
// each batch to the caller as soon as it completes, in original order. The emit
// callback is invoked from a single coordinator goroutine, so it does not need
// to be thread-safe on the caller side.
//
// Returns true if at least one AI digest was applied (same semantics as Summarize).
func (s *Summarizer) SummarizeStream(ctx context.Context, query string, papers []Paper, emit func([]Paper)) bool {
	for i := range papers {
		papers[i].Digest = heuristicDigest(query, papers[i])
	}
	if !s.Enabled() || len(papers) == 0 {
		logFlow("【卡片】AI 未启用或无论文（ai=%v papers=%d）→ 直接下发本地启发式摘要", s.Enabled(), len(papers))
		if len(papers) > 0 {
			emit(papers)
		}
		return false
	}

	batchCount := (len(papers) + summaryBatchSize - 1) / summaryBatchSize
	logFlow("【卡片】AI 开始流式生成摘要 | 检索词=%q | 共 %d 篇 → %d 批（每批最多 %d 篇，并发 %d）| 模型=%s",
		query, len(papers), batchCount, summaryBatchSize, summaryMaxConcurrency, s.model)
	started := time.Now()

	// One 1-buffered channel per batch; the batch worker writes exactly once,
	// the coordinator reads in order so later batches wait for earlier ones.
	slots := make([]chan map[string]llmDigest, batchCount)
	for i := range slots {
		slots[i] = make(chan map[string]llmDigest, 1)
	}
	semaphore := make(chan struct{}, summaryMaxConcurrency)

	for start := 0; start < len(papers); start += summaryBatchSize {
		end := min(start+summaryBatchSize, len(papers))
		batchIdx := start / summaryBatchSize
		batch := append([]Paper(nil), papers[start:end]...)
		go func(idx, cardStart, cardEnd int, batch []Paper) {
			select {
			case semaphore <- struct{}{}:
				defer func() { <-semaphore }()
			case <-ctx.Done():
				logFlow("【卡片】第 %d/%d 批（%s）已取消，跳过", idx+1, batchCount, cardRangeLabel(cardStart, cardEnd))
				slots[idx] <- nil
				return
			}
			batchStart := time.Now()
			logFlow("【卡片】第 %d/%d 批：正在为 %s 生成 AI 摘要…", idx+1, batchCount, cardRangeLabel(cardStart, cardEnd))
			for i := range batch {
				logFlow("【卡片】等待 %s 返回中…（标题：%s）", fmt.Sprintf("卡片%d", cardStart+i+1), truncateRunes(batch[i].Title, 72))
			}
			digests, err := s.summarizeWithLLM(ctx, query, batch, cardStart)
			if err != nil {
				logFlow("【卡片】第 %d/%d 批（%s）失败（耗时 %s）：%v", idx+1, batchCount, cardRangeLabel(cardStart, cardEnd), time.Since(batchStart).Round(time.Millisecond), err)
				slots[idx] <- nil
				return
			}
			logFlow("【卡片】第 %d/%d 批（%s）完成（耗时 %s）| 成功 %d/%d", idx+1, batchCount, cardRangeLabel(cardStart, cardEnd), time.Since(batchStart).Round(time.Millisecond), len(digests), len(batch))
			slots[idx] <- digests
		}(batchIdx, start, end, batch)
	}

	applied := false
	totalDigests := 0
	for idx := 0; idx < batchCount; idx++ {
		start := idx * summaryBatchSize
		end := min(start+summaryBatchSize, len(papers))
		select {
		case digests := <-slots[idx]:
			for i := start; i < end; i++ {
				if item, ok := digests[papers[i].ID]; ok && item.Verdict != "" {
					papers[i].Digest = item.Digest
					if item.ReadMinutes > 0 {
						papers[i].ReadMinutes = clampReadMinutes(item.ReadMinutes)
					}
					applied = true
					totalDigests++
					logFlow("【卡片】%s 摘要已就绪 → %s", fmt.Sprintf("卡片%d", i+1), truncateRunes(papers[i].Title, 72))
				} else {
					logFlow("【卡片】%s 未拿到 AI 摘要，保留本地启发式 → %s", fmt.Sprintf("卡片%d", i+1), truncateRunes(papers[i].Title, 72))
				}
			}
		case <-ctx.Done():
			logFlow("【卡片】流式摘要在第 %d/%d 批中止：%v", idx+1, batchCount, ctx.Err())
			// Emit remaining heuristic-only slices so the caller still sees the deck.
			for j := idx; j < batchCount; j++ {
				s2 := j * summaryBatchSize
				e2 := min(s2+summaryBatchSize, len(papers))
				emit(papers[s2:e2])
			}
			return applied
		}
		emit(papers[start:end])
	}

	logFlow("【卡片】AI 摘要全部完成（耗时 %s）| 成功 %d/%d 篇 applied=%v",
		time.Since(started).Round(time.Millisecond), totalDigests, len(papers), applied)
	return applied
}

func (s *Summarizer) summarizeInBatches(ctx context.Context, query string, papers []Paper) map[string]llmDigest {
	type batchResult struct {
		digests map[string]llmDigest
	}

	batchCount := (len(papers) + summaryBatchSize - 1) / summaryBatchSize
	results := make(chan batchResult, batchCount)
	semaphore := make(chan struct{}, summaryMaxConcurrency)
	var workers sync.WaitGroup

	for start := 0; start < len(papers); start += summaryBatchSize {
		end := min(start+summaryBatchSize, len(papers))
		batch := append([]Paper(nil), papers[start:end]...)
		batchIdx := start/summaryBatchSize + 1
		cardStart := start
		cardEnd := end
		workers.Add(1)
		go func() {
			defer workers.Done()
			select {
			case semaphore <- struct{}{}:
				defer func() { <-semaphore }()
			case <-ctx.Done():
				logFlow("【卡片】第 %d/%d 批（%s）已取消，跳过", batchIdx, batchCount, cardRangeLabel(cardStart, cardEnd))
				results <- batchResult{}
				return
			}
			batchStart := time.Now()
			logFlow("【卡片】第 %d/%d 批：正在为 %s 生成 AI 摘要…", batchIdx, batchCount, cardRangeLabel(cardStart, cardEnd))
			for i := range batch {
				logFlow("【卡片】等待 %s 返回中…（标题：%s）", fmt.Sprintf("卡片%d", cardStart+i+1), truncateRunes(batch[i].Title, 72))
			}
			digests, err := s.summarizeWithLLM(ctx, query, batch, cardStart)
			if err != nil {
				logFlow("【卡片】第 %d/%d 批（%s）失败（耗时 %s）：%v", batchIdx, batchCount, cardRangeLabel(cardStart, cardEnd), time.Since(batchStart).Round(time.Millisecond), err)
				results <- batchResult{}
				return
			}
			logFlow("【卡片】第 %d/%d 批（%s）完成（耗时 %s）| 成功 %d/%d", batchIdx, batchCount, cardRangeLabel(cardStart, cardEnd), time.Since(batchStart).Round(time.Millisecond), len(digests), len(batch))
			results <- batchResult{digests: digests}
		}()
	}

	go func() {
		workers.Wait()
		close(results)
	}()

	merged := make(map[string]llmDigest, len(papers))
	for result := range results {
		for id, digest := range result.digests {
			merged[id] = digest
		}
	}
	return merged
}

type llmDigest struct {
	ID          string `json:"id"`
	ReadMinutes int    `json:"read_minutes"`
	Digest
}

type llmDigestResponse struct {
	Papers []llmDigest `json:"papers"`
}

func (s *Summarizer) summarizeWithLLM(ctx context.Context, query string, papers []Paper, cardStart int) (map[string]llmDigest, error) {
	type compactPaper struct {
		ID       string `json:"id"`
		Title    string `json:"title"`
		Abstract string `json:"abstract"`
	}
	input := make([]compactPaper, 0, len(papers))
	for _, paper := range papers {
		input = append(input, compactPaper{ID: paper.ID, Title: paper.Title, Abstract: paper.Abstract})
	}
	inputJSON, _ := json.Marshal(input)
	prompt := fmt.Sprintf(`You are a science journalist writing for an academic card-swiping app (like Tinder for papers). The user's research direction is %q.

For each paper, generate a concise digest card based ONLY on the title and abstract. Do not invent results, numbers, or conclusions.

CRITICAL — the "hook" field is the front-of-card one-liner and MUST be in Simplified Chinese:
- 一句中文，口语化、通俗易懂，让非专业读者也一眼看懂这篇论文在讲什么、核心贡献是什么
- 要抓眼球：突出最劲爆/最关键的一点（核心贡献或关键影响），像短视频标题或科普推文，不要学术腔
- 字数：强制必须超过20字，低于40字。
- 专有名词可保留英文（如 Transformer、RAG），但整句必须是中文
- 开头禁止使用"AI"两个字（句中可以出现，但不能是前两个字）；每句换一种开头方式（论文主题词、数字/数据、场景、反问、动作动词等），不要养成固定句式
- 风格示例（仅示意语气与长度，注意下面三条开头方式互不相同，且都不是"AI"开头）：
  "长视频生成最怕"越写越乱"——这篇论文让生成过程学会自己纠错。"
  "给大模型装上分层记忆，让每次犯过的错都变成下次决策的经验。"
  "这篇论文，开启了 Diffusion 时代——不靠对抗训练，也能生成堪比 GAN 的逼真图像。"

Other fields stay in English (each under 280 chars unless noted):
- verdict: 1-line screening recommendation
- problem: what problem they tackle
- novelty: 2-4 short bullet points listing what is new / the key insights (JSON array of strings, each under 160 chars, no leading dashes)
- method: how they solved it
- result: key quantitative outcome (include numbers if available)
- audience: why this matters to the you
- why_keep: why this matters to the field
- reading_focus: what to pay attention to when reading (max 100 chars)

EMPHASIS — inside "problem", "method", "result", and every "novelty" bullet, wrap the 1-3 most important phrases (e.g. the concrete number, the new mechanism name, the surprising finding) in **double asterisks** so a reader can skim the bold parts and still get the gist. Never bold whole sentences; bold the load-bearing noun phrase only. Example: "Achieves **89.4%% accuracy** on ImageNet using a **single-stage detector**."

Return valid JSON: {"papers":[{"id":"...","hook":"...","verdict":"...","problem":"...","novelty":["...","..."],"method":"...","result":"...","audience":"...","why_keep":"...","reading_focus":"..."}]}

Papers: %s`, query, inputJSON)

	payload := map[string]any{
		"model": s.model,
		"messages": []map[string]string{
			{"role": "system", "content": "Return valid JSON only. The hook field MUST be one punchy Simplified Chinese sentence, 25-40 Chinese characters (including punctuation), never fewer than 20 and never more than 40; other digest fields stay in English."},
			{"role": "user", "content": prompt},
		},
		"temperature":     0.2,
		"response_format": map[string]string{"type": "json_object"},
	}
	s.applyProviderOptions(payload)
	body, _ := json.Marshal(payload)
	callID := llmCallSeq.Add(1)
	cards := cardRangeLabel(cardStart, cardStart+len(papers))
	logFlow("【卡片】调用 #%d 发送 AI 请求（%s）→ %s | 模型=%s | 载荷=%d 字节", callID, cards, s.baseURL+"/chat/completions", s.model, len(body))
	logFlow("【卡片】调用 #%d Prompt ↓↓↓（%s）\n%s\n↑↑↑ Prompt 结束", callID, cards, prompt)
	sendStart := time.Now()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.baseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	req.Header.Set("Content-Type", "application/json")

	logFlow("【卡片】调用 #%d 等待 %s 的 AI 返回中…", callID, cards)
	resp, err := s.client.Do(req)
	if err != nil {
		logFlow("【卡片】调用 #%d 网络错误（%s，耗时 %s）：%v", callID, cards, time.Since(sendStart).Round(time.Millisecond), err)
		return nil, err
	}
	defer resp.Body.Close()
	logFlow("【卡片】调用 #%d 已收到响应头 status=%d（%s，耗时 %s），正在读取正文…", callID, resp.StatusCode, cards, time.Since(sendStart).Round(time.Millisecond))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		message, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		logFlow("【卡片】调用 #%d HTTP 错误正文：%s", callID, strings.TrimSpace(string(message)))
		return nil, fmt.Errorf("LLM status %d: %s", resp.StatusCode, strings.TrimSpace(string(message)))
	}
	var response struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
		Usage struct {
			PromptTokens     int `json:"prompt_tokens"`
			CompletionTokens int `json:"completion_tokens"`
			TotalTokens      int `json:"total_tokens"`
		} `json:"usage"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 4<<20)).Decode(&response); err != nil {
		logFlow("【卡片】调用 #%d 解析响应失败（%s，耗时 %s）：%v", callID, cards, time.Since(sendStart).Round(time.Millisecond), err)
		return nil, err
	}
	if len(response.Choices) == 0 {
		logFlow("【卡片】调用 #%d AI 返回空 choices（%s，耗时 %s）", callID, cards, time.Since(sendStart).Round(time.Millisecond))
		return nil, fmt.Errorf("LLM returned no choices")
	}
	rawContent := response.Choices[0].Message.Content
	logFlow("【卡片】调用 #%d AI 已返回（%s，耗时 %s）| prompt_tok=%d comp_tok=%d total_tok=%d | %d 字节",
		callID, cards, time.Since(sendStart).Round(time.Millisecond), response.Usage.PromptTokens, response.Usage.CompletionTokens, response.Usage.TotalTokens, len(rawContent))
	logFlow("【卡片】调用 #%d AI 返回内容 ↓↓↓（%s）\n%s\n↑↑↑ AI 内容结束", callID, cards, rawContent)
	var parsed llmDigestResponse
	if err := json.Unmarshal([]byte(rawContent), &parsed); err != nil {
		logFlow("【卡片】调用 #%d JSON 解析失败：%v | 前 400 字：%q", callID, err, truncateRunes(rawContent, 400))
		return nil, err
	}
	requestedIDs := make(map[string]string, len(papers))
	for _, paper := range papers {
		requestedIDs[paper.ID] = paper.ID
		if idx := strings.LastIndex(paper.ID, ":"); idx >= 0 {
			requestedIDs[paper.ID[idx+1:]] = paper.ID
		}
		if strings.HasPrefix(paper.ID, "arxiv:") {
			trimmed := strings.TrimPrefix(paper.ID, "arxiv:")
			requestedIDs[trimmed] = paper.ID
			if v := strings.SplitN(trimmed, "v", 2); len(v) > 0 {
				requestedIDs[v[0]] = paper.ID
			}
		}
	}
	output := make(map[string]llmDigest, len(parsed.Papers))
	unmatched := make([]string, 0)
	for _, item := range parsed.Papers {
		key := item.ID
		if canonical, ok := requestedIDs[item.ID]; ok {
			key = canonical
		} else {
			unmatched = append(unmatched, item.ID)
		}
		output[key] = item
	}
	if len(unmatched) > 0 {
		logFlow("【卡片】调用 #%d ID 对不上：返回 %d 条，匹配 %d/%d；未匹配=%v", callID, len(parsed.Papers), len(output)-len(unmatched), len(papers), unmatched)
	}
	logFlow("【卡片】调用 #%d 解析出 %d 条摘要（匹配 %d/%d）| %s", callID, len(parsed.Papers), len(output)-len(unmatched), len(papers), cards)
	return output, nil
}

var sentencePattern = regexp.MustCompile(`[^.!?。！？]+[.!?。！？]?`)

func heuristicDigest(query string, paper Paper) Digest {
	sentences := splitSentences(paper.Abstract)
	problem := pickSentence(sentences, []string{"challenge", "problem", "we study", "we investigate", "we examine", "we address", "aims to"}, 0)
	method := pickSentence(sentences, []string{"we propose", "we present", "we introduce", "framework", "method", "approach", "model"}, 1)
	result := pickSentence(sentences, []string{"results", "experiments", "outperform", "achieve", "demonstrate", "show that", "evaluation"}, len(sentences)-1)
	noveltyBullets := pickNoveltyBullets(sentences, method)

	if problem == "" {
		problem = "The abstract does not clearly state the research problem — check the introduction."
	}
	if method == "" {
		method = "The abstract only provides a high-level method description; core details need verification from the full text."
	}
	if result == "" {
		result = "The abstract does not report verifiable quantitative results."
	}
	if len(noveltyBullets) == 0 {
		noveltyBullets = []string{method}
	}
	noveltyLead := noveltyBullets[0]

	audience := "Researchers interested in " + shorten(query, 48)
	if len(paper.Fields) > 0 {
		audience += ", especially in " + strings.Join(compactStrings(paper.Fields, 2), " / ")
	}
	whyKeep := "Matches the search direction well"
	if paper.CitationCount >= 100 {
		whyKeep += fmt.Sprintf(" — already cited %d times, serves as a mature reference", paper.CitationCount)
	} else if paper.PDFURL != "" {
		whyKeep += " — open access PDF available for quick verification"
	} else {
		whyKeep += " — skim the method figures and experiments before deciding to deep-read"
	}
	verdict := "Worth a quick skim of methods and experiments"
	if paper.MatchScore >= 88 {
		verdict = "Strong match — save and verify with priority"
	} else if paper.MatchScore < 70 {
		verdict = "Peripheral match — confirm relevance before investing time"
	}

	// Build a synthesized Chinese hook for the card front (AI will overwrite when available)
	hook := buildChineseHook(noveltyLead, method, result, paper)

	trimmedBullets := make(Bullets, 0, len(noveltyBullets))
	for _, item := range noveltyBullets {
		trimmedBullets = append(trimmedBullets, shorten(item, 200))
	}

	return Digest{
		Verdict:      verdict,
		Hook:         hook,
		Problem:      shorten(problem, 280),
		Novelty:      trimmedBullets,
		Method:       shorten(method, 280),
		Result:       shorten(result, 280),
		Audience:     shorten(audience, 200),
		WhyKeep:      shorten(whyKeep, 240),
		ReadingFocus: "Focus on the method framework, main experiments, and limitations.",
	}
}

// pickNoveltyBullets returns 1-3 short novelty-oriented sentences from the
// abstract. It prefers sentences whose lead words signal contribution / novelty
// ("novel", "first", "new"), then falls back to sentences with method verbs.
func pickNoveltyBullets(sentences []string, method string) Bullets {
	keywords := []string{"novel", "first ", "new ", "contribution", "unlike", "enables", "we propose", "we present", "we introduce"}
	seen := make(map[string]struct{}, len(sentences))
	bullets := make(Bullets, 0, 3)
	add := func(s string) {
		s = strings.TrimSpace(s)
		if s == "" {
			return
		}
		if _, dup := seen[s]; dup {
			return
		}
		seen[s] = struct{}{}
		bullets = append(bullets, s)
	}
	for _, sentence := range sentences {
		if len(bullets) >= 3 {
			break
		}
		lower := strings.ToLower(sentence)
		for _, kw := range keywords {
			if strings.Contains(lower, kw) {
				add(sentence)
				break
			}
		}
	}
	if len(bullets) == 0 && method != "" {
		add(method)
	}
	return bullets
}

// buildChineseHook makes a short Simplified-Chinese front-card line for
// heuristic digests (used before / when AI is unavailable). Keep under ~36 runes.
func buildChineseHook(novelty, method, result string, paper Paper) string {
	concept := strings.TrimSpace(paper.Title)
	if idx := strings.IndexAny(concept, ":：-—–"); idx > 8 {
		concept = strings.TrimSpace(concept[:idx])
	}
	for _, p := range []string{"On the ", "Towards ", "Toward ", "A ", "An ", "The "} {
		if strings.HasPrefix(strings.ToLower(concept), strings.ToLower(p)) {
			concept = strings.TrimSpace(concept[len(p):])
			break
		}
	}
	concept = truncateRunes(concept, 28)
	if concept == "" {
		return "这篇论文提出了一个值得关注的新思路。"
	}
	lower := strings.ToLower(novelty + " " + method + " " + result)
	switch {
	case strings.Contains(lower, "memory") || strings.Contains(lower, "记忆"):
		return truncateRunes(fmt.Sprintf("给 AI 装上更好的记忆机制：%s。", concept), 36)
	case strings.Contains(lower, "retriev") || strings.Contains(lower, "检索"):
		return truncateRunes(fmt.Sprintf("让检索更准一步：%s。", concept), 36)
	case strings.Contains(lower, "agent"):
		return truncateRunes(fmt.Sprintf("让智能体更会办事：%s。", concept), 36)
	default:
		return truncateRunes(fmt.Sprintf("一文读懂：%s 想解决什么。", concept), 36)
	}
}

// buildHook synthesizes a card-swipe-demo-style punchy one-liner.
// Target pattern: "A [adjective] [concept] that [dramatic impact]."
// Examples:
//   "A simple method that dramatically improves LLM reasoning by showing intermediate steps."
//   "The transformer architecture that reshaped modern deep learning entirely."
//   "A new generative paradigm that matches GANs in image quality without adversarial training."
func buildHook(novelty, method, result string, paper Paper) string {
	// ── Helper: strip academic boilerplate and clean up ──
	distill := func(s string) string {
		s = strings.TrimSpace(s)
		if s == "" { return "" }
		prefixes := []string{
			"We propose ","We present ","We introduce ","We investigate ",
			"We demonstrate ","We show ","We study ","We explore ",
			"We address ","We develop ","We describe ","We examine ",
			"In this paper, ","In this work, ","This paper ","This work ",
		}
		lower := strings.ToLower(s)
		for _, p := range prefixes {
			if strings.HasPrefix(lower, strings.ToLower(p)) {
				s = s[len(p):]; break
			}
		}
		if len(s) > 0 { s = strings.ToUpper(s[:1]) + s[1:] }
		return strings.TrimSpace(s)
	}

	// ── Helper: extract a clean short concept name from the title ──
	// e.g. "Attention Is All You Need" → "attention mechanism"
	//      "Chain-of-Thought Prompting Elicits Reasoning..." → "chain-of-thought prompting"
	//      "Denoising Diffusion Probabilistic Models" → "denoising diffusion"
	extractConcept := func() string {
		t := paper.Title

		// Strategy 1: If title has a colon, the part before it is usually the concept name
		if idx := strings.IndexAny(t, ":-—–"); idx > 10 {
			t = strings.TrimSpace(t[:idx])
		}

		// Strategy 2: Remove common leading phrases
		for _, p := range []string{"On the ","Towards ","Toward ","A ","The "} {
			if strings.HasPrefix(strings.ToLower(t), strings.ToLower(p)) {
				t = strings.TrimSpace(t[len(p):])
				break
			}
		}

		// Strategy 3: For verb-heavy titles ("X Elicits Y", "X Improves Y"), extract the subject
		titleLower := strings.ToLower(t)
		verbIndicators := []string{" elicits ", " improves ", " enables ", " reshapes ", " transforms ",
			" matches ", " achieves ", " unlocks ", " redefines "}
		for _, v := range verbIndicators {
			if idx := strings.Index(titleLower, v); idx > 5 {
				t = strings.TrimSpace(t[:idx])
				break
			}
		}

		// Strategy 4: For titles ending with "... in Large Language Models" or similar
		suffixes := []string{" in Large Language Models", " in Deep Learning", " for Image Generation",
			" in Natural Language Processing", " in Computer Vision", " for Machine Learning"}
		for _, suf := range suffixes {
			if strings.HasSuffix(strings.ToLower(t), strings.ToLower(suf)) {
				t = strings.TrimSpace(t[:len(t)-len(suf)])
				break
			}
		}

		// Limit to ~60 chars at word boundary
		if len(t) > 60 {
			if idx := strings.LastIndex(t[:60], " "); idx > 20 {
				t = t[:idx]
			} else {
				t = t[:60]
			}
		}
		return t
	}

	// ── Helper: extract a punchy benefit/impact phrase ──
	extractBenefit := func() string {
		raw := result
		if raw == "" { raw = method }
		if raw == "" { raw = novelty }
		if raw == "" { return "" }
		raw = distill(raw)

		// Pattern 1: Achievement with numbers — "improves GSM8K accuracy from 18% to 58%"
		patterns := []string{
			`(?i)((?:achieve|improve|outperform|reach|boost|increase|reduce|surpass|rival|match|exceed|enable|unlock|transform|reshape)(?:s|d|ing)?\s+[^.!?]{10,100})`,
			`(?i)([^.!?]{10,80}?\d+[%％]\s*(?:on|in|at|across|from)?\s*[^.!?]{0,60})`,
			`(?i)([^.!?]{10,80}?(?:outperform|state-of-the-art|SOTA|better than|superior|first to|first time)[^.!?]{0,60})`,
		}
		for _, pat := range patterns {
			re := regexp.MustCompile(pat)
			if m := re.FindStringSubmatch(raw); m != nil {
				b := strings.TrimSpace(m[1])
				b = strings.TrimRight(b, ",; ")
				if !strings.HasSuffix(b, ".") { b += "." }
				b = strings.ToUpper(b[:1]) + b[1:]
				if len(b) <= 120 { return b }
				// Truncate at word boundary
				if idx := strings.LastIndex(b[:117], " "); idx > 20 {
					return b[:idx] + "."
				}
				return b[:117] + "."
			}
		}

		// Pattern 2: Just truncate to a reasonable length
		if len(raw) > 100 {
			if idx := strings.LastIndex(raw[:97], " "); idx > 20 {
				raw = raw[:idx] + "."
			} else {
				raw = raw[:97] + "."
			}
		}
		if len(raw) > 15 { return raw }
		return ""
	}

	// ── Helper: pick the best adjective based on context ──
	pickAdjective := func() string {
		lower := strings.ToLower(novelty + " " + method)
		if strings.Contains(lower, "simple") || strings.Contains(lower, "straightforward") { return "simple" }
		if strings.Contains(lower, "first") || strings.Contains(lower, "pioneering") { return "pioneering" }
		if strings.Contains(lower, "efficient") || strings.Contains(lower, "scalable") { return "efficient" }
		if strings.Contains(lower, "novel") || strings.Contains(lower, "new paradigm") || strings.Contains(lower, "new framework") { return "novel" }
		if strings.Contains(lower, "powerful") || strings.Contains(lower, "robust") { return "powerful" }
		if strings.Contains(lower, "unified") || strings.Contains(lower, "universal") { return "unified" }
		return "novel"
	}

	concept := extractConcept()
	benefit := extractBenefit()
	adj := pickAdjective()

	// ── Template A: "A [adj] [concept] that [benefit]." (strongest pattern) ──
	if concept != "" && benefit != "" {
		hook := fmt.Sprintf("A %s %s that %s", adj, strings.ToLower(concept), strings.ToLower(benefit))
		// Fix capitalization after "that"
		for _, w := range []string{"achieves", "improves", "outperforms", "enables", "reduces",
			"matches", "rivals", "reaches", "boosts", "transforms", "reshapes", "unlocks",
			"surpasses", "exceeds", "delivers", "provides", "offers", "allows"} {
			hook = strings.Replace(hook, "that "+w, "that "+w, 1)
		}
		// Fix "that a" / "that the" etc — should NOT be capitalized after "that"
		firstAfterThat := strings.Index(hook, "that ")
		if firstAfterThat >= 0 {
			rest := hook[firstAfterThat+5:]
			if len(rest) > 0 {
				hook = hook[:firstAfterThat+5] + strings.ToLower(rest[:1]) + rest[1:]
			}
		}
		if len(hook) <= 140 { return hook }
	}

	// ── Template B: "The [concept] that [benefit]." (when concept is a known entity) ──
	if concept != "" && benefit != "" {
		hook := fmt.Sprintf("The %s that %s", strings.ToLower(concept), strings.ToLower(benefit))
		firstAfterThat := strings.Index(hook, "that ")
		if firstAfterThat >= 0 {
			rest := hook[firstAfterThat+5:]
			if len(rest) > 0 {
				hook = hook[:firstAfterThat+5] + strings.ToLower(rest[:1]) + rest[1:]
			}
		}
		if len(hook) <= 140 { return hook }
	}

	// ── Template C: Just the benefit/impact statement ──
	if benefit != "" && len(benefit) > 25 { return benefit }

	// ── Template D: "[Concept] — a [adj] [description]." ──
	noveltyClean := distill(novelty)
	if concept != "" && noveltyClean != "" && len(noveltyClean) < 120 {
		hook := concept + " — a " + adj + " " + strings.ToLower(noveltyClean[:1]) + noveltyClean[1:]
		if len(hook) <= 140 { return hook }
	}

	// ── Template E: "A [adj] [concept] that changes how we think about [field]." ──
	if concept != "" && len(paper.Fields) > 0 {
		field := paper.Fields[0]
		if strings.EqualFold(field, "Computer Science") && len(paper.Fields) > 1 {
			field = paper.Fields[1]
		}
		hook := fmt.Sprintf("A %s %s that changes how we think about %s.", adj, strings.ToLower(concept), strings.ToLower(field))
		if len(hook) <= 140 { return hook }
	}

	// ── Fallback chain ──
	if len(noveltyClean) > 20 { return noveltyClean }
	if m := distill(method); len(m) > 20 { return m }
	if len(benefit) > 15 { return benefit }

	// ── Last resort: synthesize from title ──
	if len(paper.Title) > 15 {
		t := paper.Title
		// If title has description after colon, use that
		if idx := strings.IndexAny(t, ":-—–"); idx > 0 {
			desc := strings.TrimSpace(t[idx+1:])
			if len(desc) > 15 && len(desc) < 130 {
				return desc + "."
			}
		}
		// Truncate
		if len(t) > 130 {
			if idx := strings.LastIndex(t[:127], " "); idx > 30 {
				return t[:idx] + "…"
			}
		}
		if len(t) <= 130 { return t }
	}

	return "A noteworthy paper worth your attention."
}

func splitSentences(text string) []string {
	raw := sentencePattern.FindAllString(cleanSpace(text), -1)
	output := make([]string, 0, len(raw))
	for _, sentence := range raw {
		sentence = cleanSpace(sentence)
		if len([]rune(sentence)) >= 24 {
			output = append(output, sentence)
		}
	}
	return output
}

func pickSentence(sentences, keywords []string, fallback int) string {
	for _, sentence := range sentences {
		lower := strings.ToLower(sentence)
		for _, keyword := range keywords {
			if strings.Contains(lower, keyword) {
				return sentence
			}
		}
	}
	if len(sentences) == 0 {
		return ""
	}
	if fallback < 0 || fallback >= len(sentences) {
		fallback = 0
	}
	return sentences[fallback]
}

func shorten(text string, maxRunes int) string {
	runes := []rune(cleanSpace(text))
	if len(runes) <= maxRunes {
		return string(runes)
	}
	return strings.TrimSpace(string(runes[:maxRunes-1])) + "…"
}
