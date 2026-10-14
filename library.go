package main

import (
	"errors"
	"maps"
	"net/http"
	"strings"
)

// DeleteLibrary removes only this account's selected records and their schedules.
// Persist the batch atomically; a failed write must leave memory unchanged too.
func (s *Store) DeleteLibrary(ids []string) error {
	if len(ids) == 0 || len(ids) > 2000 {
		return errors.New("select between 1 and 2000 papers")
	}
	for _, id := range ids {
		if strings.TrimSpace(id) == "" {
			return errors.New("paper id is required")
		}
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	actions, schedule := maps.Clone(s.state.Actions), maps.Clone(s.state.Schedule)
	for _, id := range ids {
		delete(s.state.Actions, id)
		delete(s.state.Schedule, id)
	}
	if err := s.saveLocked(); err != nil {
		s.state.Actions, s.state.Schedule = actions, schedule
		return err
	}
	return nil
}

func (a *API) deleteLibrary(w http.ResponseWriter, r *http.Request) {
	var request struct {
		IDs []string `json:"ids"`
	}
	if err := decodeJSON(w, r, &request); err != nil || len(request.IDs) == 0 || len(request.IDs) > 2000 {
		writeError(w, 400, "Invalid paper selection")
		return
	}
	for _, id := range request.IDs {
		if strings.TrimSpace(id) == "" {
			writeError(w, 400, "Invalid paper selection")
			return
		}
	}
	if err := a.store.DeleteLibrary(request.IDs); err != nil {
		a.logger.Error("delete library", "error", err)
		writeError(w, 500, "Could not delete papers. Your selection is unchanged.")
		return
	}
	writeJSON(w, 200, map[string]any{"papers": a.store.Library(), "schedule": a.store.Schedule(), "stats": a.store.Stats()})
}
