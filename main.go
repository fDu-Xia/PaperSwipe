package main

import (
	"embed"
	"fmt"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

//go:embed web
var webFiles embed.FS

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	if err := loadLocalEnv(".env.local"); err != nil {
		logger.Warn("load local environment", "error", err)
	}
	dataDir := envOr("DATA_DIR", "data")
	store, err := NewStore(filepath.Join(dataDir, "state.json"))
	if err != nil {
		logger.Error("open state store", "error", err)
		os.Exit(1)
	}

	searchClient := &http.Client{Timeout: 18 * time.Second}
	searcher := NewPaperSearcher(searchClient)
	llmClient := &http.Client{Timeout: 300 * time.Second}
	summarizer := NewSummarizer(llmClient)
	imageClient := &http.Client{Timeout: 120 * time.Second}
	images := NewImageGenerator(imageClient)
	api := NewAPI(searcher, summarizer, images, store, logger)

	var staticFS fs.FS
	if os.Getenv("DEV") == "1" {
		staticFS = os.DirFS("web")
		logger.Info("serving web assets from disk (DEV mode)")
	} else {
		staticFS, err = fs.Sub(webFiles, "web")
		if err != nil {
			logger.Error("load embedded web files", "error", err)
			os.Exit(1)
		}
	}
	static := spaFileServer(staticFS)
	server := &http.Server{
		Addr:              envOr("ADDR", ":8080"),
		Handler:           api.Routes(static),
		ReadHeaderTimeout: 5 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	logger.Info("PaperSwipe is ready", "url", "http://localhost"+server.Addr, "ai_enabled", summarizer.Enabled(), "ai_model", summarizer.Model(), "image_enabled", images.Enabled(), "image_model", images.Model())
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		logger.Error("server stopped", "error", err)
		os.Exit(1)
	}
}

func envOr(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func spaFileServer(content fs.FS) http.Handler {
	fileServer := http.FileServer(http.FS(content))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" {
			fileServer.ServeHTTP(w, r)
			return
		}
		path := r.URL.Path[1:]
		if _, err := fs.Stat(content, path); err != nil {
			r.URL.Path = "/"
		}
		fileServer.ServeHTTP(w, r)
	})
}

func serverURL(addr string) string {
	return fmt.Sprintf("http://localhost%s", addr)
}
