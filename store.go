package main

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

var validActions = map[string]bool{
	"dismiss":  true,
	"save":     true,
	"priority": true,
	"read":     true,
}

type Store struct {
	mu    sync.RWMutex
	path  string
	state AppState
}

func NewStore(path string) (*Store, error) {
	store := &Store{
		path: path,
		state: AppState{
			Version: 1,
			Actions: make(map[string]ActionEntry),
		},
	}
	if err := store.load(); err != nil {
		return nil, err
	}
	return store, nil
}

func (s *Store) load() error {
	data, err := os.ReadFile(s.path)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	if err := json.Unmarshal(data, &s.state); err != nil {
		return err
	}
	if s.state.Actions == nil {
		s.state.Actions = make(map[string]ActionEntry)
	}
	return nil
}

func (s *Store) RecordAction(paper Paper, action string) error {
	if !validActions[action] {
		return errors.New("invalid action")
	}
	if strings.TrimSpace(paper.ID) == "" {
		return errors.New("paper id is required")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.state.Actions[paper.ID] = ActionEntry{Paper: paper, Action: action, UpdatedAt: time.Now().UTC()}
	return s.saveLocked()
}

func (s *Store) RecordSearch(query string) error {
	query = cleanSpace(query)
	if query == "" {
		return nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	filtered := make([]SearchRecord, 0, 8)
	for _, item := range s.state.RecentSearches {
		if !strings.EqualFold(item.Query, query) {
			filtered = append(filtered, item)
		}
	}
	s.state.RecentSearches = append([]SearchRecord{{Query: query, CreatedAt: time.Now().UTC()}}, filtered...)
	if len(s.state.RecentSearches) > 8 {
		s.state.RecentSearches = s.state.RecentSearches[:8]
	}
	return s.saveLocked()
}

func (s *Store) Library() []ActionEntry {
	s.mu.RLock()
	defer s.mu.RUnlock()
	entries := make([]ActionEntry, 0)
	for _, entry := range s.state.Actions {
		if entry.Action == "save" || entry.Action == "priority" || entry.Action == "read" {
			entries = append(entries, entry)
		}
	}
	sort.Slice(entries, func(i, j int) bool { return entries[i].UpdatedAt.After(entries[j].UpdatedAt) })
	return entries
}

func (s *Store) RecentSearches() []SearchRecord {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return append([]SearchRecord(nil), s.state.RecentSearches...)
}

func (s *Store) Stats() Stats {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var stats Stats
	for _, entry := range s.state.Actions {
		switch entry.Action {
		case "save":
			stats.Saved++
		case "priority":
			stats.Priority++
		case "read":
			stats.Read++
		case "dismiss":
			stats.Dismissed++
		}
	}
	return stats
}

func (s *Store) saveLocked() error {
	if err := os.MkdirAll(filepath.Dir(s.path), 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(s.state, "", "  ")
	if err != nil {
		return err
	}
	temp, err := os.CreateTemp(filepath.Dir(s.path), ".paperswipe-state-*.json")
	if err != nil {
		return err
	}
	tempName := temp.Name()
	defer os.Remove(tempName)
	if _, err := temp.Write(append(data, '\n')); err != nil {
		temp.Close()
		return err
	}
	if err := temp.Sync(); err != nil {
		temp.Close()
		return err
	}
	if err := temp.Close(); err != nil {
		return err
	}
	return os.Rename(tempName, s.path)
}
