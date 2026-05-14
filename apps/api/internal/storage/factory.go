package storage

type Settings struct {
	Endpoint  string
	AccessKey string
	SecretKey string
	Bucket    string
	UseSSL    bool
}

func NewStore(settings Settings) (Store, error) {
	if settings.Endpoint != "" {
		return NewMinioStore(settings.Endpoint, settings.AccessKey, settings.SecretKey, settings.Bucket, settings.UseSSL)
	}
	if settings.Bucket != "" {
		return NewLocalStore(settings.Bucket), nil
	}
	return NewMemoryStore(), nil
}
