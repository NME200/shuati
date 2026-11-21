package main

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

// ---------- 密码哈希：PBKDF2-HMAC-SHA256（标准库实现，无需外部依赖） ----------

const pbkdf2Iterations = 60000

func hashPassword(password string) (string, error) {
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	key := pbkdf2Key([]byte(password), salt, 32, pbkdf2Iterations)
	return fmt.Sprintf("pbkdf2$%d$%s$%s", pbkdf2Iterations,
		base64.RawStdEncoding.EncodeToString(salt),
		base64.RawStdEncoding.EncodeToString(key)), nil
}

func verifyPassword(stored, password string) bool {
	parts := strings.Split(stored, "$")
	if len(parts) != 4 || parts[0] != "pbkdf2" {
		return false
	}
	var iterations int
	if _, err := fmt.Sscanf(parts[1], "%d", &iterations); err != nil || iterations <= 0 {
		return false
	}
	salt, err := base64.RawStdEncoding.DecodeString(parts[2])
	if err != nil {
		return false
	}
	want, err := base64.RawStdEncoding.DecodeString(parts[3])
	if err != nil {
		return false
	}
	got := pbkdf2Key([]byte(password), salt, len(want), iterations)
	return hmac.Equal(got, want)
}

// pbkdf2Key 实现 PBKDF2（只取第一个 block，输出长度 <= 32）
func pbkdf2Key(password, salt []byte, keyLen, iterations int) []byte {
	prf := hmac.New(sha256.New, password)
	prf.Write(salt)
	prf.Write([]byte{0, 0, 0, 1})
	u := prf.Sum(nil)
	dk := make([]byte, len(u))
	copy(dk, u)
	for i := 1; i < iterations; i++ {
		prf = hmac.New(sha256.New, password)
		prf.Write(u)
		u = prf.Sum(nil)
		for j := range dk {
			dk[j] ^= u[j]
		}
	}
	if keyLen < len(dk) {
		return dk[:keyLen]
	}
	return dk
}

// ---------- JWT：HMAC-SHA256（标准库实现） ----------

type jwtClaims struct {
	Username string `json:"usr"`
	Exp      int64  `json:"exp"`
	Iat      int64  `json:"iat"`
}

func signToken(secret, username string, ttl time.Duration) (string, error) {
	now := time.Now()
	claims := jwtClaims{
		Username: username,
		Iat:      now.Unix(),
		Exp:      now.Add(ttl).Unix(),
	}
	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"HS256","typ":"JWT"}`))
	payloadBytes, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}
	payload := base64.RawURLEncoding.EncodeToString(payloadBytes)
	signingInput := header + "." + payload
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(signingInput))
	sig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return signingInput + "." + sig, nil
}

func parseToken(secret, token string) (*jwtClaims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, errors.New("token 格式错误")
	}
	signingInput := parts[0] + "." + parts[1]
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(signingInput))
	expected := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(expected), []byte(parts[2])) {
		return nil, errors.New("签名无效")
	}
	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, errors.New("payload 解码失败")
	}
	var claims jwtClaims
	if err := json.Unmarshal(payloadBytes, &claims); err != nil {
		return nil, err
	}
	if claims.Exp < time.Now().Unix() {
		return nil, errors.New("token 已过期")
	}
	return &claims, nil
}

// 生成随机口令（用于启动时若无配置密码，打印一次性密码到日志）
func randomAlphaNum(n int) string {
	const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, n)
	raw := make([]byte, n)
	if _, err := rand.Read(raw); err != nil {
		return hex.EncodeToString(raw)
	}
	for i := range b {
		b[i] = chars[int(raw[i])%len(chars)]
	}
	return string(b)
}
