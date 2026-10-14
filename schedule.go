package main

import (
	"errors"
	"net/http"
	"time"
)

type ScheduleEntry struct {
	Date     string `json:"date,omitempty"`
	Priority string `json:"priority,omitempty"`
	Done     bool   `json:"done"`
	Removed  bool   `json:"removed"`
}

type SchedulePatch struct {
	PaperID  string  `json:"paper_id"`
	Date     *string `json:"date,omitempty"`
	Priority *string `json:"priority,omitempty"`
	Done     *bool   `json:"done,omitempty"`
	Removed  *bool   `json:"removed,omitempty"`
}

func (s *Store) Schedule() map[string]ScheduleEntry {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make(map[string]ScheduleEntry, len(s.state.Schedule))
	for id, entry := range s.state.Schedule {
		result[id] = entry
	}
	return result
}

func (s *Store) UpdateSchedule(p SchedulePatch) error {
	if p.Date != nil && *p.Date != "" {
		if _, err := time.Parse("2006-01-02", *p.Date); err != nil {
			return errors.New("日期格式无效")
		}
	}
	if p.Priority != nil && *p.Priority != "high" && *p.Priority != "medium" && *p.Priority != "low" {
		return errors.New("优先级无效")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	entry, ok := s.state.Actions[p.PaperID]
	if !ok || entry.Action == "dismiss" {
		return errors.New("请先收藏这篇论文")
	}
	if s.state.Schedule == nil {
		s.state.Schedule = map[string]ScheduleEntry{}
	}
	previous, existed := s.state.Schedule[p.PaperID]
	next := previous
	if p.Date != nil {
		next.Date = *p.Date
	}
	if p.Priority != nil {
		next.Priority = *p.Priority
	}
	if p.Done != nil {
		next.Done = *p.Done
	}
	if p.Removed != nil {
		next.Removed = *p.Removed
	}
	s.state.Schedule[p.PaperID] = next
	if err := s.saveLocked(); err != nil {
		if existed {
			s.state.Schedule[p.PaperID] = previous
		} else {
			delete(s.state.Schedule, p.PaperID)
		}
		return err
	}
	return nil
}

func (a *API) schedule(w http.ResponseWriter, r *http.Request) {
	var patch SchedulePatch
	if err := decodeJSON(w, r, &patch); err != nil {
		writeError(w, 400, "日程请求无效")
		return
	}
	if err := a.store.UpdateSchedule(patch); err != nil {
		writeError(w, 400, "日程未保存："+err.Error())
		return
	}
	writeJSON(w, 200, map[string]any{"schedule": a.store.Schedule()})
}
