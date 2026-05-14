package storage

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

var ErrNotFound = errors.New("object not found")

type Store interface {
	Put(ctx context.Context, key string, content []byte) error
	Get(ctx context.Context, key string) ([]byte, error)
	Delete(ctx context.Context, key string) error
}

type MemoryStore struct {
	mu      sync.RWMutex
	objects map[string][]byte
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{objects: map[string][]byte{}}
}

func (store *MemoryStore) Put(_ context.Context, key string, content []byte) error {
	store.mu.Lock()
	defer store.mu.Unlock()
	store.objects[key] = append([]byte(nil), content...)
	return nil
}

func (store *MemoryStore) Get(_ context.Context, key string) ([]byte, error) {
	store.mu.RLock()
	defer store.mu.RUnlock()
	content, ok := store.objects[key]
	if !ok {
		return nil, ErrNotFound
	}
	return append([]byte(nil), content...), nil
}

func (store *MemoryStore) Delete(_ context.Context, key string) error {
	store.mu.Lock()
	defer store.mu.Unlock()
	if _, ok := store.objects[key]; !ok {
		return ErrNotFound
	}
	delete(store.objects, key)
	return nil
}

type LocalStore struct {
	root string
}

func NewLocalStore(root string) *LocalStore {
	return &LocalStore{root: root}
}

func (store *LocalStore) Put(_ context.Context, key string, content []byte) error {
	path, err := store.pathFor(key)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	return os.WriteFile(path, content, 0o644)
}

func (store *LocalStore) Get(_ context.Context, key string) ([]byte, error) {
	path, err := store.pathFor(key)
	if err != nil {
		return nil, err
	}
	content, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return content, nil
}

func (store *LocalStore) Delete(_ context.Context, key string) error {
	path, err := store.pathFor(key)
	if err != nil {
		return err
	}
	if err := os.Remove(path); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return ErrNotFound
		}
		return err
	}
	return nil
}

func (store *LocalStore) pathFor(key string) (string, error) {
	if strings.TrimSpace(key) == "" || filepath.IsAbs(key) || strings.Contains(key, "..") {
		return "", errors.New("invalid object key")
	}
	cleanKey := filepath.Clean(filepath.FromSlash(key))
	if cleanKey == "." || strings.HasPrefix(cleanKey, ".."+string(filepath.Separator)) {
		return "", errors.New("invalid object key")
	}
	return filepath.Join(store.root, cleanKey), nil
}
