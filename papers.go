package main

import (
	"context"
	"encoding/json"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

const semanticScholarEndpoint = "https://api.semanticscholar.org/graph/v1/paper/search"
const arxivEndpoint = "https://export.arxiv.org/api/query"
const openAlexEndpoint = "https://api.openalex.org/works"

type PaperSearcher struct {
	client                *http.Client
	semanticScholarAPIKey string
}

func NewPaperSearcher(client *http.Client) *PaperSearcher {
	return &PaperSearcher{
		client:                client,
		semanticScholarAPIKey: strings.TrimSpace(os.Getenv("SEMANTIC_SCHOLAR_API_KEY")),
	}
}

type s2SearchResponse struct {
	Total int       `json:"total"`
	Data  []s2Paper `json:"data"`
}

type s2Paper struct {
	PaperID                  string   `json:"paperId"`
	Title                    string   `json:"title"`
	Abstract                 string   `json:"abstract"`
	Authors                  []Author `json:"authors"`
	Year                     int      `json:"year"`
	PublicationDate          string   `json:"publicationDate"`
	Venue                    string   `json:"venue"`
	CitationCount            int      `json:"citationCount"`
	InfluentialCitationCount int      `json:"influentialCitationCount"`
	FieldsOfStudy            []string `json:"fieldsOfStudy"`
	URL                      string   `json:"url"`
	OpenAccessPDF            *struct {
		URL string `json:"url"`
	} `json:"openAccessPdf"`
	ExternalIDs map[string]any `json:"externalIds"`
}

func (s *PaperSearcher) Search(ctx context.Context, query string, limit int) ([]Paper, string, error) {
	sourceCtx, cancel := context.WithTimeout(ctx, 8*time.Second)
	papers, err := s.searchSemanticScholar(sourceCtx, query, limit)
	cancel()
	if err == nil && len(papers) > 0 {
		return papers, "Semantic Scholar", nil
	}

	sourceCtx, cancel = context.WithTimeout(ctx, 8*time.Second)
	arxivPapers, arxivErr := s.searchArxiv(sourceCtx, query, limit)
	cancel()
	if arxivErr == nil && len(arxivPapers) > 0 {
		return arxivPapers, "arXiv", nil
	}

	sourceCtx, cancel = context.WithTimeout(ctx, 10*time.Second)
	openAlexPapers, openAlexErr := s.searchOpenAlex(sourceCtx, query, limit)
	cancel()
	if openAlexErr == nil && len(openAlexPapers) > 0 {
		return openAlexPapers, "OpenAlex", nil
	}

	if err == nil {
		err = errors.New("Semantic Scholar returned no papers")
	}
	if arxivErr == nil {
		arxivErr = errors.New("arXiv returned no papers")
	}
	if openAlexErr == nil {
		openAlexErr = errors.New("OpenAlex returned no papers")
	}
	return nil, "", fmt.Errorf("paper sources unavailable: Semantic Scholar: %v; arXiv: %v; OpenAlex: %v", err, arxivErr, openAlexErr)
}

func (s *PaperSearcher) searchSemanticScholar(ctx context.Context, query string, limit int) ([]Paper, error) {
	params := url.Values{}
	params.Set("query", strings.ReplaceAll(query, "-", " "))
	params.Set("limit", strconv.Itoa(min(limit*2, 30)))
	params.Set("fields", strings.Join([]string{
		"title", "abstract", "authors", "year", "publicationDate", "venue",
		"citationCount", "influentialCitationCount", "fieldsOfStudy", "url",
		"openAccessPdf", "externalIds",
	}, ","))

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, semanticScholarEndpoint+"?"+params.Encode(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "PaperSwipe/0.1 (research discovery prototype)")
	if s.semanticScholarAPIKey != "" {
		req.Header.Set("x-api-key", s.semanticScholarAPIKey)
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return nil, fmt.Errorf("unexpected status %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	var payload s2SearchResponse
	if err := json.NewDecoder(io.LimitReader(resp.Body, 8<<20)).Decode(&payload); err != nil {
		return nil, fmt.Errorf("decode Semantic Scholar response: %w", err)
	}

	papers := make([]Paper, 0, limit)
	seen := make(map[string]bool)
	for rank, item := range payload.Data {
		title := cleanSpace(item.Title)
		abstract := cleanSpace(item.Abstract)
		if title == "" || abstract == "" || seen[normalizeTitle(title)] {
			continue
		}
		seen[normalizeTitle(title)] = true
		external := stringifyMap(item.ExternalIDs)
		id := item.PaperID
		if id == "" {
			id = stablePaperID(title, external["DOI"])
		}
		pdfURL := ""
		if item.OpenAccessPDF != nil {
			pdfURL = item.OpenAccessPDF.URL
		}
		paper := Paper{
			ID:                       id,
			Title:                    title,
			Abstract:                 abstract,
			Authors:                  item.Authors,
			Year:                     item.Year,
			PublicationDate:          item.PublicationDate,
			Venue:                    cleanSpace(item.Venue),
			CitationCount:            item.CitationCount,
			InfluentialCitationCount: item.InfluentialCitationCount,
			Fields:                   compactStrings(item.FieldsOfStudy, 3),
			URL:                      item.URL,
			PDFURL:                   pdfURL,
			ExternalIDs:              external,
			MatchScore:               calculateMatchScore(query, title, abstract, item.CitationCount, item.Year, rank),
			ReadMinutes:              estimateReadMinutes(abstract),
			Source:                   "Semantic Scholar",
		}
		papers = append(papers, paper)
		if len(papers) == limit {
			break
		}
	}
	sort.SliceStable(papers, func(i, j int) bool { return papers[i].MatchScore > papers[j].MatchScore })
	return papers, nil
}

type arxivFeed struct {
	Entries []arxivEntry `xml:"entry"`
}

type arxivEntry struct {
	ID         string        `xml:"id"`
	Title      string        `xml:"title"`
	Summary    string        `xml:"summary"`
	Published  string        `xml:"published"`
	Authors    []arxivAuthor `xml:"author"`
	Links      []arxivLink   `xml:"link"`
	Categories []struct {
		Term string `xml:"term,attr"`
	} `xml:"category"`
}

type arxivAuthor struct {
	Name string `xml:"name"`
}

type arxivLink struct {
	Href  string `xml:"href,attr"`
	Type  string `xml:"type,attr"`
	Title string `xml:"title,attr"`
}

func (s *PaperSearcher) searchArxiv(ctx context.Context, query string, limit int) ([]Paper, error) {
	params := url.Values{}
	terms := queryTerms(query)
	clauses := make([]string, 0, len(terms))
	for _, term := range terms {
		clauses = append(clauses, "all:"+term)
	}
	searchQuery := strings.Join(clauses, " OR ")
	if searchQuery == "" {
		searchQuery = "all:" + query
	}
	params.Set("search_query", searchQuery)
	params.Set("start", "0")
	params.Set("max_results", strconv.Itoa(min(limit*3, 30)))
	params.Set("sortBy", "relevance")
	params.Set("sortOrder", "descending")

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, arxivEndpoint+"?"+params.Encode(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "PaperSwipe/0.1 (research discovery prototype)")
	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status %d", resp.StatusCode)
	}

	var feed arxivFeed
	if err := xml.NewDecoder(io.LimitReader(resp.Body, 8<<20)).Decode(&feed); err != nil {
		return nil, fmt.Errorf("decode arXiv response: %w", err)
	}

	papers := make([]Paper, 0, len(feed.Entries))
	for rank, entry := range feed.Entries {
		published, _ := time.Parse(time.RFC3339, entry.Published)
		authors := make([]Author, 0, len(entry.Authors))
		for _, author := range entry.Authors {
			authors = append(authors, Author{Name: cleanSpace(author.Name)})
		}
		fields := make([]string, 0, len(entry.Categories))
		for _, category := range entry.Categories {
			fields = append(fields, category.Term)
		}
		pdfURL := ""
		for _, link := range entry.Links {
			if link.Title == "pdf" || link.Type == "application/pdf" {
				pdfURL = link.Href
				break
			}
		}
		abstract := cleanSpace(entry.Summary)
		title := cleanSpace(entry.Title)
		id := strings.TrimPrefix(strings.TrimPrefix(entry.ID, "https://arxiv.org/abs/"), "http://arxiv.org/abs/")
		papers = append(papers, Paper{
			ID:              "arxiv:" + id,
			Title:           title,
			Abstract:        abstract,
			Authors:         authors,
			Year:            published.Year(),
			PublicationDate: published.Format("2006-01-02"),
			Venue:           "arXiv",
			Fields:          compactStrings(fields, 3),
			URL:             entry.ID,
			PDFURL:          pdfURL,
			ExternalIDs:     map[string]string{"ArXiv": id},
			MatchScore:      calculateMatchScore(query, title, abstract, 0, published.Year(), rank),
			ReadMinutes:     estimateReadMinutes(abstract),
			Source:          "arXiv",
		})
	}
	sort.SliceStable(papers, func(i, j int) bool { return papers[i].MatchScore > papers[j].MatchScore })
	if len(papers) > limit {
		papers = papers[:limit]
	}
	return papers, nil
}

type openAlexSearchResponse struct {
	Results []openAlexWork `json:"results"`
}

type openAlexWork struct {
	ID                    string           `json:"id"`
	DOI                   string           `json:"doi"`
	Title                 string           `json:"title"`
	DisplayName           string           `json:"display_name"`
	PublicationYear       int              `json:"publication_year"`
	PublicationDate       string           `json:"publication_date"`
	CitedByCount          int              `json:"cited_by_count"`
	AbstractInvertedIndex map[string][]int `json:"abstract_inverted_index"`
	Authorships           []struct {
		Author struct {
			DisplayName string `json:"display_name"`
		} `json:"author"`
	} `json:"authorships"`
	PrimaryLocation *struct {
		LandingPageURL string `json:"landing_page_url"`
		PDFURL         string `json:"pdf_url"`
		Source         *struct {
			DisplayName string `json:"display_name"`
		} `json:"source"`
	} `json:"primary_location"`
	BestOALocation *struct {
		LandingPageURL string `json:"landing_page_url"`
		PDFURL         string `json:"pdf_url"`
	} `json:"best_oa_location"`
	PrimaryTopic *struct {
		DisplayName string `json:"display_name"`
		Field       struct {
			DisplayName string `json:"display_name"`
		} `json:"field"`
		Subfield struct {
			DisplayName string `json:"display_name"`
		} `json:"subfield"`
	} `json:"primary_topic"`
}

func (s *PaperSearcher) searchOpenAlex(ctx context.Context, query string, limit int) ([]Paper, error) {
	params := url.Values{}
	params.Set("filter", "title_and_abstract.search:"+query+",has_abstract:true")
	params.Set("per-page", strconv.Itoa(min(limit*3, 30)))
	params.Set("select", strings.Join([]string{
		"id", "doi", "title", "display_name", "publication_year", "publication_date",
		"cited_by_count", "abstract_inverted_index", "authorships", "primary_location",
		"best_oa_location", "primary_topic",
	}, ","))
	params.Set("mailto", "hello@paperswipe.local")

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, openAlexEndpoint+"?"+params.Encode(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "PaperSwipe/0.1 (research discovery prototype; mailto:hello@paperswipe.local)")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return nil, fmt.Errorf("unexpected status %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	var payload openAlexSearchResponse
	if err := json.NewDecoder(io.LimitReader(resp.Body, 8<<20)).Decode(&payload); err != nil {
		return nil, fmt.Errorf("decode OpenAlex response: %w", err)
	}

	papers := make([]Paper, 0, limit)
	seen := make(map[string]bool)
	for rank, item := range payload.Results {
		title := cleanSpace(item.Title)
		if title == "" {
			title = cleanSpace(item.DisplayName)
		}
		abstract := cleanSpace(abstractFromInvertedIndex(item.AbstractInvertedIndex))
		if title == "" || abstract == "" || seen[normalizeTitle(title)] {
			continue
		}
		seen[normalizeTitle(title)] = true

		authors := make([]Author, 0, min(len(item.Authorships), 8))
		for _, authorship := range item.Authorships {
			name := cleanSpace(authorship.Author.DisplayName)
			if name != "" {
				authors = append(authors, Author{Name: name})
			}
			if len(authors) == 8 {
				break
			}
		}

		venue, pageURL, pdfURL := "OpenAlex", item.ID, ""
		if item.PrimaryLocation != nil {
			if item.PrimaryLocation.Source != nil && cleanSpace(item.PrimaryLocation.Source.DisplayName) != "" {
				venue = cleanSpace(item.PrimaryLocation.Source.DisplayName)
			}
			if item.PrimaryLocation.LandingPageURL != "" {
				pageURL = item.PrimaryLocation.LandingPageURL
			}
			pdfURL = item.PrimaryLocation.PDFURL
		}
		if item.BestOALocation != nil {
			if pdfURL == "" {
				pdfURL = item.BestOALocation.PDFURL
			}
			if pageURL == "" {
				pageURL = item.BestOALocation.LandingPageURL
			}
		}

		fields := make([]string, 0, 3)
		if item.PrimaryTopic != nil {
			fields = append(fields, item.PrimaryTopic.DisplayName, item.PrimaryTopic.Subfield.DisplayName, item.PrimaryTopic.Field.DisplayName)
		}
		external := map[string]string{"OpenAlex": item.ID}
		if item.DOI != "" {
			external["DOI"] = strings.TrimPrefix(item.DOI, "https://doi.org/")
		}

		papers = append(papers, Paper{
			ID:              "openalex:" + strings.TrimPrefix(item.ID, "https://openalex.org/"),
			Title:           title,
			Abstract:        abstract,
			Authors:         authors,
			Year:            item.PublicationYear,
			PublicationDate: item.PublicationDate,
			Venue:           venue,
			CitationCount:   item.CitedByCount,
			Fields:          compactStrings(fields, 3),
			URL:             pageURL,
			PDFURL:          pdfURL,
			ExternalIDs:     external,
			MatchScore:      calculateMatchScore(query, title, abstract, item.CitedByCount, item.PublicationYear, rank),
			ReadMinutes:     estimateReadMinutes(abstract),
			Source:          "OpenAlex",
		})
		if len(papers) == limit {
			break
		}
	}
	sort.SliceStable(papers, func(i, j int) bool { return papers[i].MatchScore > papers[j].MatchScore })
	return papers, nil
}

var whitespacePattern = regexp.MustCompile(`\s+`)
var titleNoisePattern = regexp.MustCompile(`[^\p{L}\p{N}]+`)

func cleanSpace(value string) string {
	return strings.TrimSpace(whitespacePattern.ReplaceAllString(value, " "))
}

func normalizeTitle(value string) string {
	return strings.ToLower(titleNoisePattern.ReplaceAllString(cleanSpace(value), ""))
}

func stablePaperID(title, doi string) string {
	basis := normalizeTitle(title) + "|" + strings.ToLower(strings.TrimSpace(doi))
	var hash uint64 = 1469598103934665603
	for _, b := range []byte(basis) {
		hash ^= uint64(b)
		hash *= 1099511628211
	}
	return fmt.Sprintf("local:%x", hash)
}

func stringifyMap(input map[string]any) map[string]string {
	if len(input) == 0 {
		return nil
	}
	output := make(map[string]string, len(input))
	for key, value := range input {
		output[key] = fmt.Sprint(value)
	}
	return output
}

func compactStrings(values []string, max int) []string {
	output := make([]string, 0, min(len(values), max))
	seen := make(map[string]bool)
	for _, value := range values {
		value = cleanSpace(value)
		key := strings.ToLower(value)
		if value == "" || seen[key] {
			continue
		}
		seen[key] = true
		output = append(output, value)
		if len(output) == max {
			break
		}
	}
	return output
}

func calculateMatchScore(query, title, abstract string, citations, year, rank int) int {
	terms := queryTerms(query)
	if len(terms) == 0 {
		return max(55, 88-rank*3)
	}
	lowerTitle := strings.ToLower(title)
	lowerAbstract := strings.ToLower(abstract)
	titleHits, abstractHits := 0, 0
	for _, term := range terms {
		if strings.Contains(lowerTitle, term) {
			titleHits++
		}
		if strings.Contains(lowerAbstract, term) {
			abstractHits++
		}
	}
	coverage := float64(titleHits*2+abstractHits) / float64(len(terms)*3)
	base := 58.0 + coverage*30.0 - float64(rank)*1.2
	if citations > 0 {
		base += math.Min(6, math.Log10(float64(citations)+1)*2)
	}
	if year >= time.Now().Year()-2 {
		base += 3
	}
	return int(math.Max(52, math.Min(98, math.Round(base))))
}

func queryTerms(query string) []string {
	parts := regexp.MustCompile(`[^\p{L}\p{N}]+`).Split(strings.ToLower(query), -1)
	terms := make([]string, 0, len(parts))
	for _, part := range parts {
		if len([]rune(part)) >= 2 {
			terms = append(terms, part)
		}
	}
	return terms
}

func abstractFromInvertedIndex(index map[string][]int) string {
	if len(index) == 0 {
		return ""
	}
	positions := make(map[int]string)
	maxPosition := 0
	for word, indexes := range index {
		for _, position := range indexes {
			positions[position] = word
			if position > maxPosition {
				maxPosition = position
			}
		}
	}
	words := make([]string, 0, maxPosition+1)
	for i := 0; i <= maxPosition; i++ {
		if word := positions[i]; word != "" {
			words = append(words, word)
		}
	}
	return strings.Join(words, " ")
}

func estimateReadMinutes(abstract string) int {
	words := len(strings.Fields(abstract))
	return max(6, min(25, int(math.Ceil(float64(words)/22.0))))
}
