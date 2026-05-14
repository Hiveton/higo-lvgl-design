package storage

import (
	"context"
	"errors"
	"io"
	"testing"
)

func TestS3StorePutGetDelete(t *testing.T) {
	client := &fakeS3Client{objects: map[string][]byte{}}
	store := NewS3Store(client, "lvgl-assets")
	key := "projects/project-1/assets/icon.png"

	if err := store.Put(context.Background(), key, []byte("png-bytes")); err != nil {
		t.Fatal(err)
	}
	if client.bucket != "lvgl-assets" || client.contentType != "application/octet-stream" {
		t.Fatalf("unexpected put metadata: %#v", client)
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
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
}

type fakeS3Client struct {
	objects     map[string][]byte
	bucket      string
	contentType string
}

func (client *fakeS3Client) PutObject(_ context.Context, bucket string, key string, reader io.Reader, size int64, contentType string) error {
	client.bucket = bucket
	client.contentType = contentType
	content, err := io.ReadAll(reader)
	if err != nil {
		return err
	}
	if int64(len(content)) != size {
		return io.ErrUnexpectedEOF
	}
	client.objects[key] = append([]byte(nil), content...)
	return nil
}

func (client *fakeS3Client) GetObject(_ context.Context, _ string, key string) ([]byte, error) {
	content, ok := client.objects[key]
	if !ok {
		return nil, ErrNotFound
	}
	return append([]byte(nil), content...), nil
}

func (client *fakeS3Client) RemoveObject(_ context.Context, _ string, key string) error {
	if _, ok := client.objects[key]; !ok {
		return ErrNotFound
	}
	delete(client.objects, key)
	return nil
}
