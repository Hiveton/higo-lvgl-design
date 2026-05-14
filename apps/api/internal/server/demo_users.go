package server

import (
	"time"

	"github.com/hiveton/lvgl-online-editor/apps/api/internal/auth"
	"github.com/hiveton/lvgl-online-editor/apps/api/internal/users"
)

func demoUserRepository() users.Repository {
	passwordHash, err := auth.HashPassword("password")
	if err != nil {
		panic(err)
	}
	now := time.Now().UTC()
	return users.NewStaticRepository([]users.User{
		{
			ID:           DemoUserID,
			Email:        "demo@hiveton.dev",
			PasswordHash: passwordHash,
			DisplayName:  "Hiveton Demo",
			CreatedAt:    now,
			UpdatedAt:    now,
		},
		{
			ID:           OtherUserID,
			Email:        "other@hiveton.dev",
			PasswordHash: passwordHash,
			DisplayName:  "Other User",
			CreatedAt:    now,
			UpdatedAt:    now,
		},
	})
}
