package main

import (
	"encoding/json"
	"strings"
	"time"
)

type Author struct {
	Name string `json:"name"`
}

// Bullets is a list of short lines that also accepts a single string for
// backward compatibility with older LLM responses and persisted state.
type Bullets []string

func (b *Bullets) UnmarshalJSON(data []byte) error {
	trimmed := strings.TrimSpace(string(data))
	if trimmed == "" || trimmed == "null" {
		*b = nil
		return nil
	}
	if trimmed[0] == '[' {
		var list []string
		if err := json.Unmarshal(data, &list); err != nil {
			return err
		}
		cleaned := make([]string, 0, len(list))
		for _, item := range list {
			if s := strings.TrimSpace(item); s != "" {
				cleaned = append(cleaned, s)
			}
		}
		*b = cleaned
		return nil
	}
	var single string
	if err := json.Unmarshal(data, &single); err != nil {
		return err
	}
	single = strings.TrimSpace(single)
	if single == "" {
		*b = nil
		return nil
	}
	*b = Bullets{single}
	return nil
}

type Digest struct {
	Verdict      string  `json:"verdict"`
	Hook         string  `json:"hook"`
	Problem      string  `json:"problem"`
	Novelty      Bullets `json:"novelty"`
	Method       string  `json:"method"`
	Result       string  `json:"result"`
	Audience     string  `json:"audience"`
	WhyKeep      string  `json:"why_keep"`
	ReadingFocus string  `json:"reading_focus"`
}

type Paper struct {
	SummaryStatus            string             `json:"summary_status,omitempty"`
	SummaryMessage           string             `json:"summary_message,omitempty"`
	SummaryModel             string             `json:"summary_model,omitempty"`
	SummaryPreferences       *ReaderPreferences `json:"summary_preferences,omitempty"`
	ID                       string             `json:"id"`
	Title                    string             `json:"title"`
	Abstract                 string             `json:"abstract,omitempty"`
	Authors                  []Author           `json:"authors"`
	Year                     int                `json:"year,omitempty"`
	PublicationDate          string             `json:"publication_date,omitempty"`
	Venue                    string             `json:"venue,omitempty"`
	CitationCount            int                `json:"citation_count"`
	InfluentialCitationCount int                `json:"influential_citation_count"`
	Fields                   []string           `json:"fields"`
	URL                      string             `json:"url,omitempty"`
	PDFURL                   string             `json:"pdf_url,omitempty"`
	ExternalIDs              map[string]string  `json:"external_ids,omitempty"`
	MatchScore               int                `json:"match_score"`
	ReadMinutes              int                `json:"read_minutes"`
	Source                   string             `json:"source"`
	Digest                   Digest             `json:"digest"`
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
	QuotaDay       string                 `json:"quota_day,omitempty"`
	QuotaCount     int                    `json:"quota_count,omitempty"`
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
