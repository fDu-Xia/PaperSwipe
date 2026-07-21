package main

import "time"

type Author struct {
	Name string `json:"name"`
}

type Digest struct {
	Verdict      string `json:"verdict"`
	Problem      string `json:"problem"`
	Novelty      string `json:"novelty"`
	Method       string `json:"method"`
	Result       string `json:"result"`
	Audience     string `json:"audience"`
	WhyKeep      string `json:"why_keep"`
	ReadingFocus string `json:"reading_focus"`
}

type Paper struct {
	ID                       string            `json:"id"`
	Title                    string            `json:"title"`
	Abstract                 string            `json:"abstract,omitempty"`
	Authors                  []Author          `json:"authors"`
	Year                     int               `json:"year,omitempty"`
	PublicationDate          string            `json:"publication_date,omitempty"`
	Venue                    string            `json:"venue,omitempty"`
	CitationCount            int               `json:"citation_count"`
	InfluentialCitationCount int               `json:"influential_citation_count"`
	Fields                   []string          `json:"fields"`
	URL                      string            `json:"url,omitempty"`
	PDFURL                   string            `json:"pdf_url,omitempty"`
	ExternalIDs              map[string]string `json:"external_ids,omitempty"`
	MatchScore               int               `json:"match_score"`
	ReadMinutes              int               `json:"read_minutes"`
	Source                   string            `json:"source"`
	Digest                   Digest            `json:"digest"`
}

type SearchResponse struct {
	Query        string    `json:"query"`
	Source       string    `json:"source"`
	GeneratedAt  time.Time `json:"generated_at"`
	Total        int       `json:"total"`
	Papers       []Paper   `json:"papers"`
	Warning      string    `json:"warning,omitempty"`
	AIEnabled    bool      `json:"ai_enabled"`
	ImageEnabled bool      `json:"image_enabled"`
}

type PaperImageRequest struct {
	PaperID  string `json:"paper_id"`
	Title    string `json:"title"`
	Abstract string `json:"abstract"`
}

type PaperImageResponse struct {
	URL    string `json:"url"`
	Model  string `json:"model"`
	Cached bool   `json:"cached"`
}

type TopicPlanRequest struct {
	Description string `json:"description"`
}

type TopicPlan struct {
	Intent      string   `json:"intent"`
	SearchQuery string   `json:"search_query"`
	Keywords    []string `json:"keywords"`
	AIEnabled   bool     `json:"ai_enabled"`
}

type ActionRequest struct {
	Paper  Paper  `json:"paper"`
	Action string `json:"action"`
}

type ActionEntry struct {
	Paper     Paper     `json:"paper"`
	Action    string    `json:"action"`
	UpdatedAt time.Time `json:"updated_at"`
}

type SearchRecord struct {
	Query     string    `json:"query"`
	CreatedAt time.Time `json:"created_at"`
}

type AppState struct {
	Version        int                    `json:"version"`
	Actions        map[string]ActionEntry `json:"actions"`
	RecentSearches []SearchRecord         `json:"recent_searches"`
}

type Stats struct {
	Saved     int `json:"saved"`
	Priority  int `json:"priority"`
	Read      int `json:"read"`
	Dismissed int `json:"dismissed"`
}
