package storage

import (
	"bytes"
	"context"
	"errors"
	"io"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

type S3ObjectClient interface {
	PutObject(ctx context.Context, bucket string, key string, reader io.Reader, size int64, contentType string) error
	GetObject(ctx context.Context, bucket string, key string) ([]byte, error)
	RemoveObject(ctx context.Context, bucket string, key string) error
}

type S3Store struct {
	client S3ObjectClient
	bucket string
}

func NewS3Store(client S3ObjectClient, bucket string) *S3Store {
	return &S3Store{client: client, bucket: bucket}
}

func NewMinioStore(endpoint string, accessKey string, secretKey string, bucket string, useSSL bool) (*S3Store, error) {
	client, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: useSSL,
	})
	if err != nil {
		return nil, err
	}
	return NewS3Store(minioObjectClient{client: client}, bucket), nil
}

func (store *S3Store) Put(ctx context.Context, key string, content []byte) error {
	if err := validateObjectKey(key); err != nil {
		return err
	}
	return store.client.PutObject(ctx, store.bucket, key, bytes.NewReader(content), int64(len(content)), "application/octet-stream")
}

func (store *S3Store) Get(ctx context.Context, key string) ([]byte, error) {
	if err := validateObjectKey(key); err != nil {
		return nil, err
	}
	return store.client.GetObject(ctx, store.bucket, key)
}

func (store *S3Store) Delete(ctx context.Context, key string) error {
	if err := validateObjectKey(key); err != nil {
		return err
	}
	return store.client.RemoveObject(ctx, store.bucket, key)
}

type minioObjectClient struct {
	client *minio.Client
}

func (client minioObjectClient) PutObject(ctx context.Context, bucket string, key string, reader io.Reader, size int64, contentType string) error {
	_, err := client.client.PutObject(ctx, bucket, key, reader, size, minio.PutObjectOptions{ContentType: contentType})
	return err
}

func (client minioObjectClient) GetObject(ctx context.Context, bucket string, key string) ([]byte, error) {
	object, err := client.client.GetObject(ctx, bucket, key, minio.GetObjectOptions{})
	if err != nil {
		return nil, mapS3Error(err)
	}
	defer object.Close()
	content, err := io.ReadAll(object)
	if err != nil {
		return nil, mapS3Error(err)
	}
	return content, nil
}

func (client minioObjectClient) RemoveObject(ctx context.Context, bucket string, key string) error {
	return mapS3Error(client.client.RemoveObject(ctx, bucket, key, minio.RemoveObjectOptions{}))
}

func mapS3Error(err error) error {
	if err == nil {
		return nil
	}
	var response minio.ErrorResponse
	if errors.As(err, &response) && response.Code == "NoSuchKey" {
		return ErrNotFound
	}
	return err
}

func validateObjectKey(key string) error {
	_, err := NewLocalStore(".").pathFor(key)
	return err
}
