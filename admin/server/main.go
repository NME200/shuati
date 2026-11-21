package main

import (
	"log"
	"net/http"
	"os"
)

func main() {
	cfg := loadConfig()

	server := NewServer(cfg)

	// 若使用明文密码且是开发环境，提示生产应配置 hash 或环境变量
	if cfg.AdminPassHash == "" {
		log.Printf("[auth] 使用 ADMIN_PASSWORD 明文初始化（生产建议配置 ADMIN_PASSWORD_HASH）")
	}
	if cfg.APIKey == "" {
		log.Printf("[warn] TCB_API_KEY 未配置，数据库接口将返回鉴权错误")
	}

	handler := server.routes()
	log.Printf("[server] shuati-admin-server listening on :%s, env=%s", cfg.Port, cfg.EnvID)
	if err := http.ListenAndServe(":"+cfg.Port, handler); err != nil {
		log.Printf("[fatal] server stopped: %v", err)
		os.Exit(1)
	}
}
