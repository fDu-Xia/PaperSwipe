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
	"strings"
	"sync"
)

const (
	summaryBatchSize      = 10
	summaryMaxConcurrency = 2
)

type Summarizer struct {
	client   *http.Client
	apiKey   string
	baseURL  string
	model    string
	thinking string
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
	return &Summarizer{
		client:   client,
		apiKey:   firstEnv("LLM_API_KEY", "ZHIPU_API_KEY"),
		baseURL:  baseURL,
		model:    model,
		thinking: strings.ToLower(strings.TrimSpace(os.Getenv("LLM_THINKING"))),
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
}

func (s *Summarizer) PlanTopic(ctx context.Context, description string) (TopicPlan, bool) {
	fallback := heuristicTopicPlan(description)
	if !s.Enabled() {
		return fallback, false
	}

	plan, err := s.planTopicWithLLM(ctx, description)
	if err != nil {
		return fallback, false
	}
	plan = normalizeTopicPlan(description, plan)
	if plan.SearchQuery == "" || len(plan.Keywords) == 0 {
		return fallback, false
	}
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
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.baseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return TopicPlan{}, err
	}
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return TopicPlan{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		message, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
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
		return TopicPlan{}, err
	}
	if len(response.Choices) == 0 {
		return TopicPlan{}, fmt.Errorf("LLM returned no choices")
	}
	var plan TopicPlan
	if err := json.Unmarshal([]byte(response.Choices[0].Message.Content), &plan); err != nil {
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
		return papers, false
	}

	digests := s.summarizeInBatches(ctx, query, papers)
	applied := false
	for i := range papers {
		if digest, ok := digests[papers[i].ID]; ok && digest.Verdict != "" {
			if digest.TLDR == "" {
				digest.TLDR = papers[i].Digest.TLDR
			}
			papers[i].Digest = digest
			applied = true
		}
	}
	return papers, applied
}

func (s *Summarizer) summarizeInBatches(ctx context.Context, query string, papers []Paper) map[string]Digest {
	type batchResult struct {
		digests map[string]Digest
	}

	batchCount := (len(papers) + summaryBatchSize - 1) / summaryBatchSize
	results := make(chan batchResult, batchCount)
	semaphore := make(chan struct{}, summaryMaxConcurrency)
	var workers sync.WaitGroup

	for start := 0; start < len(papers); start += summaryBatchSize {
		end := min(start+summaryBatchSize, len(papers))
		batch := append([]Paper(nil), papers[start:end]...)
		workers.Add(1)
		go func() {
			defer workers.Done()
			select {
			case semaphore <- struct{}{}:
				defer func() { <-semaphore }()
			case <-ctx.Done():
				results <- batchResult{}
				return
			}
			digests, err := s.summarizeWithLLM(ctx, query, batch)
			if err != nil {
				results <- batchResult{}
				return
			}
			results <- batchResult{digests: digests}
		}()
	}

	go func() {
		workers.Wait()
		close(results)
	}()

	merged := make(map[string]Digest, len(papers))
	for result := range results {
		for id, digest := range result.digests {
			merged[id] = digest
		}
	}
	return merged
}

type llmDigest struct {
	ID string `json:"id"`
	Digest
}

type llmDigestResponse struct {
	Papers []llmDigest `json:"papers"`
}

func (s *Summarizer) summarizeWithLLM(ctx context.Context, query string, papers []Paper) (map[string]Digest, error) {
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
	prompt := fmt.Sprintf(`你是严谨的论文筛选助手。用户研究方向是 %q。请只根据给出的标题和摘要，为每篇论文生成中文判断卡。不要编造摘要中没有的结果、数字或结论。tldr 字段必须是一句话（最多 45 个汉字），面向非专业读者，用最通俗的比喻或语言说清楚"这篇论文到底做了什么、为什么值得看"，要能吸引人点进来，同时忠于摘要证据、不要用"本文/我们"这样的学术腔。其他字段每个最多 55 个汉字，reading_focus 最多 35 个汉字。返回 JSON 对象，格式为 {"papers":[{"id":"...","verdict":"...","tldr":"...","problem":"...","novelty":"...","method":"...","result":"...","audience":"...","why_keep":"...","reading_focus":"..."}]}。论文：%s`, query, inputJSON)

	payload := map[string]any{
		"model": s.model,
		"messages": []map[string]string{
			{"role": "system", "content": "Return valid JSON only. Be concise and evidence-bound."},
			{"role": "user", "content": prompt},
		},
		"temperature":     0.2,
		"response_format": map[string]string{"type": "json_object"},
	}
	s.applyProviderOptions(payload)
	body, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.baseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		message, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return nil, fmt.Errorf("LLM status %d: %s", resp.StatusCode, strings.TrimSpace(string(message)))
	}
	var response struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 4<<20)).Decode(&response); err != nil {
		return nil, err
	}
	if len(response.Choices) == 0 {
		return nil, fmt.Errorf("LLM returned no choices")
	}
	var parsed llmDigestResponse
	if err := json.Unmarshal([]byte(response.Choices[0].Message.Content), &parsed); err != nil {
		return nil, err
	}
	output := make(map[string]Digest, len(parsed.Papers))
	for _, item := range parsed.Papers {
		output[item.ID] = item.Digest
	}
	return output, nil
}

var sentencePattern = regexp.MustCompile(`[^.!?。！？]+[.!?。！？]?`)

func heuristicDigest(query string, paper Paper) Digest {
	sentences := splitSentences(paper.Abstract)
	problem := pickSentence(sentences, []string{"challenge", "problem", "we study", "we investigate", "we examine", "we address", "aims to"}, 0)
	method := pickSentence(sentences, []string{"we propose", "we present", "we introduce", "framework", "method", "approach", "model"}, 1)
	result := pickSentence(sentences, []string{"results", "experiments", "outperform", "achieve", "demonstrate", "show that", "evaluation"}, len(sentences)-1)
	novelty := pickSentence(sentences, []string{"novel", "first", "new", "contribution", "unlike", "enables"}, 1)

	if problem == "" {
		problem = "摘要未明确给出问题定义，建议先检查引言与任务设定。"
	}
	if method == "" {
		method = "摘要仅提供高层方法描述，核心模块需要进入正文确认。"
	}
	if result == "" {
		result = "摘要未报告可核验的结果描述，实验强度需要进一步确认。"
	}
	if novelty == "" {
		novelty = method
	}

	audience := "适合关注「" + shorten(query, 34) + "」的研究者"
	if len(paper.Fields) > 0 {
		audience += "，尤其是 " + strings.Join(compactStrings(paper.Fields, 2), " / ") + " 方向"
	}
	whyKeep := "与检索方向匹配度较高"
	if paper.CitationCount >= 100 {
		whyKeep += fmt.Sprintf("，已有 %d 次引用，可作为成熟参考", paper.CitationCount)
	} else if paper.PDFURL != "" {
		whyKeep += "，且有开放全文，适合快速核验"
	} else {
		whyKeep += "，建议先看方法图和实验表再决定是否精读"
	}
	verdict := "值得快速浏览方法与实验"
	if paper.MatchScore >= 88 {
		verdict = "高度相关，建议保留并优先核验"
	} else if paper.MatchScore < 70 {
		verdict = "主题有交集，但需要先确认任务设定"
	}

	return Digest{
		Verdict:      verdict,
		TLDR:         heuristicTLDR(query, paper, problem, method, result),
		Problem:      shorten(problem, 150),
		Novelty:      shorten(novelty, 150),
		Method:       shorten(method, 150),
		Result:       shorten(result, 150),
		Audience:     shorten(audience, 100),
		WhyKeep:      shorten(whyKeep, 120),
		ReadingFocus: "先看方法框架、主实验与局限性",
	}
}

func heuristicTLDR(query string, paper Paper, problem, method, result string) string {
	pieces := make([]string, 0, 3)
	if method != "" {
		pieces = append(pieces, shorten(method, 55))
	} else if problem != "" {
		pieces = append(pieces, shorten(problem, 55))
	}
	if result != "" && result != method {
		pieces = append(pieces, shorten(result, 55))
	}
	joined := strings.TrimSpace(strings.Join(pieces, "；"))
	if joined == "" {
		if title := strings.TrimSpace(paper.Title); title != "" {
			return shorten("围绕「"+title+"」展开的研究，摘要信息有限，需回到原文核验。", 90)
		}
		return "这篇论文与「" + shorten(query, 30) + "」相关，摘要信息不足，建议打开原文快速浏览。"
	}
	return shorten(joined, 90)
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
