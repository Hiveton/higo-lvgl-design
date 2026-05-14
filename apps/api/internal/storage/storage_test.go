package storage

import (
	"bytes"
	"context"
	"errors"
	"testing"
)

func TestMemoryStoreCopiesContent(t *testing.T) {
	store := NewMemoryStore()
	content := []byte("lvgl-export")
	if err := store.Put(context.Background(), "jobs/job-1/lvgl-export.zip", content); err != nil {
		t.Fatal(err)
	}
	content[0] = 'X'

	stored, err := store.Get(context.Background(), "jobs/job-1/lvgl-export.zip")
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(stored, []byte("lvgl-export")) {
		t.Fatalf("stored content was mutated: %q", string(stored))
	}
	stored[0] = 'X'
	storedAgain, err := store.Get(context.Background(), "jobs/job-1/lvgl-export.zip")
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(storedAgain, []byte("lvgl-export")) {
		t.Fatalf("returned content was not copied: %q", string(storedAgain))
	}
}

func TestLocalStorePutGetDelete(t *testing.T) {
	store := NewLocalStore(t.TempDir())
	key := "projects/project-1/assets/icon.png"
	if err := store.Put(context.Background(), key, []byte("png-bytes")); err != nil {
		t.Fatal(err)
	}
	content, err := store.Get(context.Background(), key)
	if err != nil {
		t.Fatal(err)
	}
	if string(content) != "png-bytes" {
		t.Fatalf("unexpected content: %q", string(content))
	}
	if err := store.Delete(context.Background(), key); err != nil {
		t.Fatal(err)
	}
	if _, err := store.Get(context.Background(), key); !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected ErrNotFound after delete, got %v", err)
	}
}

func TestLocalStoreRejectsUnsafeKeys(t *testing.T) {
	store := NewLocalStore(t.TempDir())
	for _, key := range []string{"", "../escape", "/absolute/path", "projects/../../escape"} {
		if err := store.Put(context.Background(), key, []byte("content")); err == nil {
			t.Fatalf("expected key %q to be rejected", key)
		}
	}
}
