package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadLocalEnvDoesNotOverrideExistingValues(t *testing.T) {
	path := filepath.Join(t.TempDir(), ".env.local")
	if err := os.WriteFile(path, []byte("PAPERSWIPE_TEST_ONE=from-file\nPAPERSWIPE_TEST_TWO='quoted value'\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	t.Setenv("PAPERSWIPE_TEST_ONE", "from-process")
	previous, existed := os.LookupEnv("PAPERSWIPE_TEST_TWO")
	_ = os.Unsetenv("PAPERSWIPE_TEST_TWO")
	t.Cleanup(func() {
		if existed {
			_ = os.Setenv("PAPERSWIPE_TEST_TWO", previous)
		} else {
			_ = os.Unsetenv("PAPERSWIPE_TEST_TWO")
		}
	})

	if err := loadLocalEnv(path); err != nil {
		t.Fatal(err)
	}
	if got := os.Getenv("PAPERSWIPE_TEST_ONE"); got != "from-process" {
		t.Fatalf("existing environment was overwritten: %q", got)
	}
	if got := os.Getenv("PAPERSWIPE_TEST_TWO"); got != "quoted value" {
		t.Fatalf("quoted value = %q", got)
	}
}
