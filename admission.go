package main

import (
	"net/http"
	"time"
)

// Keep two active jobs; opted-in clients may wait at most 20 seconds.
// Old clients still get an immediate 429. Waiting never consumes quota.
func (b *Beta) waitForSlot(w http.ResponseWriter, r *http.Request) bool {
	busy := func() bool {
		w.Header().Set("Retry-After", "10")
		writeError(w, 429, "检索繁忙，等待名额已满或等待超时，请稍后重试")
		return false
	}
	if r.Header.Get("Prefer") != "wait=20" {
		return busy()
	}
	select {
	case b.waiting <- struct{}{}:
		defer func() { <-b.waiting }()
	default:
		return busy()
	}
	timer := time.NewTimer(20 * time.Second)
	defer timer.Stop()
	select {
	case b.slots <- struct{}{}:
		if r.Context().Err() != nil {
			<-b.slots
			return false
		}
		return true
	case <-r.Context().Done():
		return false
	case <-timer.C:
		return busy()
	}
}
