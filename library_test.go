package main

import (
	"path/filepath"
	"testing"
)

func TestDeleteLibraryPersistsAndRollsBack(t *testing.T) {
	path := filepath.Join(t.TempDir(), "state.json")
	s, err := NewStore(path)
	if err != nil {
		t.Fatal(err)
	}
	for _, id := range []string{"one", "two"} {
		if err := s.RecordAction(Paper{ID: id}, "save"); err != nil {
			t.Fatal(err)
		}
		done := true
		if err := s.UpdateSchedule(SchedulePatch{PaperID: id, Done: &done}); err != nil {
			t.Fatal(err)
		}
	}
	s.path = t.TempDir()
	if s.DeleteLibrary([]string{"one"}) == nil || len(s.Library()) != 2 || !s.Schedule()["one"].Done {
		t.Fatal("failed write changed library/schedule")
	}
	s.path = path
	if s.DeleteLibrary([]string{"one", ""}) == nil || len(s.Library()) != 2 {
		t.Fatal("invalid batch changed records")
	}
	if err := s.DeleteLibrary([]string{"one", "one", "unknown"}); err != nil {
		t.Fatal(err)
	}
	reloaded, err := NewStore(path)
	if err != nil {
		t.Fatal(err)
	}
	if len(reloaded.Library()) != 1 || reloaded.Library()[0].Paper.ID != "two" || len(reloaded.Schedule()) != 1 {
		t.Fatal("deletion did not persist or deleted unselected record")
	}
}

func TestDeleteLibraryAccountIsolation(t *testing.T) {
	b, handler := betaFixture(t)
	for _, secret := range []string{"alice-secret", "bob-secret"} {
		if err := b.users[tokenHash(secret)].store.RecordAction(Paper{ID: "shared-id"}, "save"); err != nil {
			t.Fatal(err)
		}
	}
	cookie := betaLogin(t, handler, "alice-secret")
	body := `{"ids":["shared-id"]}`
	if w := betaRequest(handler, "POST", "/api/library/delete", body, nil, "https://beta.example.com"); w.Code != 401 {
		t.Fatalf("anonymous delete: %d", w.Code)
	}
	if w := betaRequest(handler, "POST", "/api/library/delete", body, cookie, "https://other.example.com"); w.Code != 403 {
		t.Fatalf("cross-origin delete: %d", w.Code)
	}
	if w := betaRequest(handler, "POST", "/api/library/delete", `{"ids":[]}`, cookie, "https://beta.example.com"); w.Code != 400 {
		t.Fatalf("invalid delete: %d", w.Code)
	}
	if w := betaRequest(handler, "POST", "/api/library/delete", body, cookie, "https://beta.example.com"); w.Code != 200 {
		t.Fatalf("delete: %d %s", w.Code, w.Body)
	}
	if len(b.users[tokenHash("alice-secret")].store.Library()) != 0 || len(b.users[tokenHash("bob-secret")].store.Library()) != 1 {
		t.Fatal("account isolation broken")
	}
}
