package main

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"
)

type sourceRetryTransport func(*http.Request) (*http.Response, error)

func (f sourceRetryTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestSourceRetryPolicy(t *testing.T) {
	for _, code := range []int{200, 400, 401, 403, 429, 503} {
		t.Run(http.StatusText(code), func(t *testing.T) {
			calls := 0
			s := NewPaperSearcher(&http.Client{Transport: sourceRetryTransport(func(r *http.Request) (*http.Response, error) {
				calls++
				status := code
				if calls > 1 {
					status = 200
				}
				return &http.Response{StatusCode: status, Header: make(http.Header), Body: io.NopCloser(strings.NewReader("{}"))}, nil
			})})
			ctx, cancel := context.WithTimeout(context.Background(), time.Second)
			defer cancel()
			req, _ := http.NewRequestWithContext(ctx, "GET", "https://example.test", nil)
			resp, err := s.requestSource(req)
			if err != nil {
				t.Fatal(err)
			}
			resp.Body.Close()
			want := 1
			if code == 429 || code == 503 {
				want = 2
			}
			if calls != want {
				t.Fatalf("calls=%d want=%d", calls, want)
			}
		})
	}
}
func TestSourceHonorsLongRetryAfter(t *testing.T) {
	calls := 0
	s := NewPaperSearcher(&http.Client{Transport: sourceRetryTransport(func(r *http.Request) (*http.Response, error) {
		calls++
		return &http.Response{StatusCode: 429, Header: http.Header{"Retry-After": []string{"60"}}, Body: io.NopCloser(strings.NewReader(""))}, nil
	})})
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, "GET", "https://example.test", nil)
	resp, err := s.requestSource(req)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if calls != 1 {
		t.Fatal("retried before Retry-After")
	}
}
func TestEmptySourcesAreNotAnOutage(t *testing.T) {
	calls := 0
	s := NewPaperSearcher(&http.Client{Transport: sourceRetryTransport(func(r *http.Request) (*http.Response, error) {
		calls++
		body := "{}"
		if strings.Contains(r.URL.Host, "arxiv") {
			body = "<feed></feed>"
		}
		return &http.Response{StatusCode: 200, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(body))}, nil
	})})
	papers, _, err := s.Search(context.Background(), "test topic", 3)
	if err != nil || len(papers) != 0 || calls != 3 {
		t.Fatalf("papers=%d calls=%d err=%v", len(papers), calls, err)
	}
}
