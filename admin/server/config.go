package main

import (
	"os"
	"strconv"
	"strings"
	"time"
)

// Config 从云托管环境变量读取配置
type Config struct {
	Port          string
	EnvID         string
	APIKey        string // 云开发管理端 API Key（Bearer），仅服务端使用
	JWTSecret     string
	AdminUser     string
	AdminPassword string // 明文仅用于首次生成 hash，生产建议只配 hash
	AdminPassHash string // bcrypt hash，优先级高于明文
	TokenTTL      time.Duration
	CORSOrigins   string
}

func env(key, def string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return def
}

func loadConfig() Config {
	ttlHours, _ := strconv.Atoi(env("JWT_TTL_HOURS", "12"))
	return Config{
		Port:          env("PORT", "80"),
		EnvID:         env("TCB_ENV_ID", "unfair-rook-d3gum8kdyd3761bc5"),
		APIKey:        env("TCB_API_KEY", ""),
		JWTSecret:     env("JWT_SECRET", "change-me-in-production"),
		AdminUser:     env("ADMIN_USER", "admin"),
		AdminPassword: env("ADMIN_PASSWORD", "admin123456"),
		AdminPassHash: env("ADMIN_PASSWORD_HASH", ""),
		TokenTTL:      time.Duration(ttlHours) * time.Hour,
		CORSOrigins:   env("CORS_ORIGINS", "*"),
	}
}
