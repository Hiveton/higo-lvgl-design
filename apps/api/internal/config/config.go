package config

type Config struct {
	Addr                   string
	DatabaseURL            string
	RedisURL               string
	ObjectStorageBucket    string
	ObjectStorageEndpoint  string
	ObjectStorageAccessKey string
	ObjectStorageSecretKey string
	ObjectStorageUseSSL    bool
	AuthTokenSecret        string
}

func Load(env map[string]string) Config {
	port := env["PORT"]
	if port == "" {
		port = "8080"
	}
	return Config{
		Addr:                   ":" + port,
		DatabaseURL:            env["DATABASE_URL"],
		RedisURL:               env["REDIS_URL"],
		ObjectStorageBucket:    env["OBJECT_STORAGE_BUCKET"],
		ObjectStorageEndpoint:  env["OBJECT_STORAGE_ENDPOINT"],
		ObjectStorageAccessKey: env["OBJECT_STORAGE_ACCESS_KEY"],
		ObjectStorageSecretKey: env["OBJECT_STORAGE_SECRET_KEY"],
		ObjectStorageUseSSL:    env["OBJECT_STORAGE_USE_SSL"] == "true",
		AuthTokenSecret:        env["AUTH_TOKEN_SECRET"],
	}
}
