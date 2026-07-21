package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
)

type ImageGenerator struct {
	client  *http.Client
	apiKey  string
	baseURL string
	model   string
	size    string
	mu      sync.RWMutex
	cache   map[string]string
}

type ImageProviderError struct {
	StatusCode int
	Message    string
}

func (e *ImageProviderError) Error() string {
	return fmt.Sprintf("图片模型状态码 %d: %s", e.StatusCode, e.Message)
}

func NewImageGenerator(client *http.Client) *ImageGenerator {
	baseURL := strings.TrimRight(firstEnv("IMAGE_BASE_URL", "LLM_BASE_URL"), "/")
	if baseURL == "" {
		baseURL = "https://api.openai.com/v1"
	}
	return &ImageGenerator{
		client:  client,
		apiKey:  firstEnv("IMAGE_API_KEY", "ZHIPU_API_KEY", "LLM_API_KEY"),
		baseURL: baseURL,
		model:   strings.TrimSpace(os.Getenv("IMAGE_MODEL")),
		size:    envOr("IMAGE_SIZE", "1280x1280"),
		cache:   make(map[string]string),
	}
}

func (g *ImageGenerator) Enabled() bool {
	return g.apiKey != "" && g.model != ""
}

func (g *ImageGenerator) Model() string {
	return g.model
}

func (g *ImageGenerator) GeneratePaperVisual(ctx context.Context, request PaperImageRequest) (PaperImageResponse, error) {
	if !g.Enabled() {
		return PaperImageResponse{}, fmt.Errorf("图片生成模型尚未配置")
	}
	cacheKey := cleanSpace(request.PaperID)
	if cacheKey == "" {
		cacheKey = normalizeTitle(request.Title)
	}
	g.mu.RLock()
	if cachedURL := g.cache[cacheKey]; cachedURL != "" {
		g.mu.RUnlock()
		return PaperImageResponse{URL: cachedURL, Model: g.model, Cached: true}, nil
	}
	g.mu.RUnlock()

	prompt := buildPaperImagePrompt(request.Title, request.Abstract)
	payload := map[string]any{
		"model":             g.model,
		"prompt":            prompt,
		"size":              g.size,
		"watermark_enabled": true,
	}
	body, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, g.baseURL+"/images/generations", bytes.NewReader(body))
	if err != nil {
		return PaperImageResponse{}, err
	}
	req.Header.Set("Authorization", "Bearer "+g.apiKey)
	req.Header.Set("Content-Type", "application/json")

	response, err := g.client.Do(req)
	if err != nil {
		return PaperImageResponse{}, err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		message, _ := io.ReadAll(io.LimitReader(response.Body, 2048))
		return PaperImageResponse{}, &ImageProviderError{StatusCode: response.StatusCode, Message: strings.TrimSpace(string(message))}
	}
	var result struct {
		Data []struct {
			URL string `json:"url"`
		} `json:"data"`
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, 2<<20)).Decode(&result); err != nil {
		return PaperImageResponse{}, err
	}
	if len(result.Data) == 0 || !safeRemoteImageURL(result.Data[0].URL) {
		return PaperImageResponse{}, fmt.Errorf("图片模型未返回有效图片地址")
	}
	imageURL := result.Data[0].URL
	g.mu.Lock()
	g.cache[cacheKey] = imageURL
	g.mu.Unlock()
	return PaperImageResponse{URL: imageURL, Model: g.model}, nil
}

func buildPaperImagePrompt(title, abstract string) string {
	return fmt.Sprintf(`为一篇学术论文创作方形编辑插画。论文标题：%s。摘要信息：%s。请把核心研究对象、方法机制和应用场景转化为清晰的视觉隐喻；采用现代科学杂志封面风格，构图简洁，细节准确，紫色、青绿色与暖黄色点缀，和 PaperSwipe 的研究产品视觉一致。不要出现标题、文字、公式、Logo、水印或人物肖像。`, truncateRunes(cleanSpace(title), 180), truncateRunes(cleanSpace(abstract), 520))
}

func safeRemoteImageURL(value string) bool {
	parsed, err := url.Parse(strings.TrimSpace(value))
	return err == nil && parsed.Scheme == "https" && parsed.Host != ""
}
