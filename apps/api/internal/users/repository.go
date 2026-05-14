package users

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"
)

var ErrNotFound = errors.New("user not found")

type User struct {
	ID           string
	Email        string
	PasswordHash string
	DisplayName  string
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

type Repository interface {
	FindByEmail(ctx context.Context, email string) (User, error)
}

type SQLRepository struct {
	db *sql.DB
}

func NewSQLRepository(db *sql.DB) *SQLRepository {
	return &SQLRepository{db: db}
}

func (repo *SQLRepository) FindByEmail(ctx context.Context, email string) (User, error) {
	var user User
	err := repo.db.QueryRowContext(ctx, `
SELECT id::text, email, password_hash, display_name, created_at, updated_at
FROM users
WHERE lower(email) = lower($1)
`, strings.TrimSpace(email)).Scan(
		&user.ID,
		&user.Email,
		&user.PasswordHash,
		&user.DisplayName,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return User{}, ErrNotFound
	}
	if err != nil {
		return User{}, err
	}
	return user, nil
}

type StaticRepository struct {
	usersByEmail map[string]User
}

func NewStaticRepository(users []User) *StaticRepository {
	usersByEmail := map[string]User{}
	for _, user := range users {
		usersByEmail[strings.ToLower(strings.TrimSpace(user.Email))] = user
	}
	return &StaticRepository{usersByEmail: usersByEmail}
}

func (repo *StaticRepository) FindByEmail(_ context.Context, email string) (User, error) {
	user, ok := repo.usersByEmail[strings.ToLower(strings.TrimSpace(email))]
	if !ok {
		return User{}, ErrNotFound
	}
	return user, nil
}
