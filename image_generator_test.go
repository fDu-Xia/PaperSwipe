package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
)

func TestImageGeneratorCallsConfiguredEndpointAndCaches(t *testing.T) {
	var requests atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		if r.URL.Path != "/images/generations" {
			t.Fatalf("path = %q", r.URL.Path)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer test-key" {
			t.Fatalf("authorization = %q", got)
		}
		var payload map[string]any
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload["model"] != "glm-image" || payload["size"] != "1280x1280" {
			t.Fatalf("unexpected payload: %#v", payload)
		}
		writeJSON(w, http.StatusOK, map[string]any{"data": []map[string]string{{"url": "https://images.example/paper.png"}}})
	}))
	defer server.Close()

	t.Setenv("IMAGE_API_KEY", "test-key")
	t.Setenv("IMAGE_BASE_URL", server.URL)
	t.Setenv("IMAGE_MODEL", "glm-image")
	t.Setenv("IMAGE_SIZE", "1280x1280")
	generator := NewImageGenerator(server.Client())
	request := PaperImageRequest{PaperID: "paper-1", Title: "Memory Agents", Abstract: "Memory retrieval and consolidation."}

	first, err := generator.GeneratePaperVisual(context.Background(), request)
	if err != nil {
		t.Fatal(err)
	}
	second, err := generator.GeneratePaperVisual(context.Background(), request)
	if err != nil {
		t.Fatal(err)
	}
	if first.URL == "" || first.Cached || !second.Cached || requests.Load() != 1 {
		t.Fatalf("first=%#v second=%#v requests=%d", first, second, requests.Load())
	}
}
