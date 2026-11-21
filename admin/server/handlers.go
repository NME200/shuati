package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"
)

type Server struct {
	cfg       Config
	cloud     *CloudClient
	passHash  string
	adminUser string
}

func NewServer(cfg Config) *Server {
	s := &Server{
		cfg:       cfg,
		cloud:     NewCloudClient(cfg.EnvID, cfg.APIKey),
		adminUser: cfg.AdminUser,
	}
	// 优先使用预生成的 hash，否则用明文密码现场生成
	if cfg.AdminPassHash != "" {
		s.passHash = cfg.AdminPassHash
	} else {
		hash, err := hashPassword(cfg.AdminPassword)
		if err != nil {
			panic("生成管理员密码哈希失败: " + err.Error())
		}
		s.passHash = hash
	}
	return s
}

// ---------- 通用响应 ----------

type apiResponse struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

func writeJSON(w http.ResponseWriter, status int, code int, msg string, data interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(apiResponse{Code: code, Message: msg, Data: data})
}

func ok(w http.ResponseWriter, data interface{}) {
	writeJSON(w, http.StatusOK, 0, "ok", data)
}

func fail(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, status, msg, nil)
}

// ---------- 中间件 ----------

func (s *Server) withCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		allowed := s.cfg.CORSOrigins
		if allowed == "*" {
			w.Header().Set("Access-Control-Allow-Origin", "*")
		} else if origin != "" && strings.Contains(allowed, origin) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Max-Age", "86400")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next(w, r)
	}
}

func (s *Server) requireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if !strings.HasPrefix(authHeader, "Bearer ") {
			fail(w, http.StatusUnauthorized, "缺少访问令牌")
			return
		}
		token := strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer "))
		claims, err := parseToken(s.cfg.JWTSecret, token)
		if err != nil {
			fail(w, http.StatusUnauthorized, "令牌无效: "+err.Error())
			return
		}
		_ = claims
		next(w, r)
	}
}

// ---------- 路由 ----------

func (s *Server) routes() http.Handler {
	mux := http.NewServeMux()

	// 健康检查（无需鉴权）
	mux.HandleFunc("/api/health", s.withCORS(func(w http.ResponseWriter, r *http.Request) {
		ok(w, map[string]interface{}{"status": "ok", "time": time.Now().Format(time.RFC3339)})
	}))

	// 登录（无需鉴权）
	mux.HandleFunc("/api/login", s.withCORS(s.handleLogin))

	// 以下均需鉴权
	authed := map[string]http.HandlerFunc{
		"/api/me":           s.handleMe,
		"/api/overview":     s.handleOverview,
		"/api/banks":        s.handleBanks,
		"/api/questions":    s.handleQuestions,
		"/api/categories":   s.handleCategories,
		"/api/records":      s.handleRecords,
		"/api/users":        s.handleUsers,
		"/api/recent-record": s.handleRecentRecords,
	}
	for path, handler := range authed {
		wrapped := s.requireAuth(handler)
		mux.HandleFunc(path, s.withCORS(wrapped))
	}

	// 删除操作（基础管理）
	mux.HandleFunc("/api/banks/delete", s.withCORS(s.requireAuth(s.handleDeleteBank)))
	mux.HandleFunc("/api/questions/delete", s.withCORS(s.requireAuth(s.handleDeleteQuestion)))
	mux.HandleFunc("/api/categories/delete", s.withCORS(s.requireAuth(s.handleDeleteCategory)))
	mux.HandleFunc("/api/records/delete", s.withCORS(s.requireAuth(s.handleDeleteRecord)))

	return mux
}

// ---------- Handler 实现 ----------

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		fail(w, http.StatusMethodNotAllowed, "仅支持 POST")
		return
	}
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		fail(w, http.StatusBadRequest, "请求格式错误")
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	if req.Username != s.adminUser || !verifyPassword(s.passHash, req.Password) {
		fail(w, http.StatusUnauthorized, "用户名或密码错误")
		return
	}
	token, err := signToken(s.cfg.JWTSecret, req.Username, s.cfg.TokenTTL)
	if err != nil {
		fail(w, http.StatusInternalServerError, "签发令牌失败")
		return
	}
	ok(w, map[string]interface{}{
		"token":    token,
		"username": req.Username,
		"expiresIn": int(s.cfg.TokenTTL.Seconds()),
	})
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	ok(w, map[string]interface{}{"username": s.adminUser, "role": "admin"})
}

// handleOverview 概览统计：各集合总数 + 累计答题/正确率（基于记录）
func (s *Server) handleOverview(w http.ResponseWriter, r *http.Request) {
	collections := []string{"quiz_banks", "quiz_questions", "quiz_categories", "quiz_records", "quiz_users"}
	counts := make(map[string]int)
	for _, name := range collections {
		n, err := s.cloud.Count(name, map[string]interface{}{})
		if err != nil {
			// 集合可能尚未创建（如 quiz_users），按 0 处理，避免整个概览页失败
			log.Printf("[warn] count %s failed: %v", name, err)
			counts[name] = 0
			continue
		}
		counts[name] = n
	}

	// 拉取全部记录计算正确率（记录量通常不大；上限 1000）
	records, err := s.cloud.Query("quiz_records", map[string]interface{}{}, 0, 1000, "")
	if err != nil {
		fail(w, http.StatusBadGateway, "读取答题记录失败: "+err.Error())
		return
	}
	totalQuestions, totalCorrect := 0, 0
	scoreSum, scoreCount := 0.0, 0
	for _, rec := range records {
		totalQuestions += toInt(rec["total"])
		totalCorrect += toInt(rec["correct"])
		scoreSum += toFloat(rec["score"])
		scoreCount++
	}
	accuracy := 0.0
	if totalQuestions > 0 {
		accuracy = float64(totalCorrect) / float64(totalQuestions) * 100
	}
	avgScore := 0.0
	if scoreCount > 0 {
		avgScore = scoreSum / float64(scoreCount)
	}

	ok(w, map[string]interface{}{
		"counts": map[string]int{
			"banks":      counts["quiz_banks"],
			"questions":  counts["quiz_questions"],
			"categories": counts["quiz_categories"],
			"records":    counts["quiz_records"],
			"users":      counts["quiz_users"],
		},
		"totalQuestions": totalQuestions,
		"totalCorrect":   totalCorrect,
		"accuracy":       round2(accuracy),
		"avgScore":       round2(avgScore),
	})
}

func (s *Server) handleBanks(w http.ResponseWriter, r *http.Request) {
	offset, limit := parsePage(r)
	where := map[string]interface{}{}
	if bankID := r.URL.Query().Get("id"); bankID != "" {
		where["id"] = bankID
	}
	list, err := s.cloud.Query("quiz_banks", where, offset, limit, `[{"field":"createdAt","direction":"desc"}]`)
	if err != nil {
		fail(w, http.StatusBadGateway, "读取题库失败: "+err.Error())
		return
	}
	total, err := s.cloud.Count("quiz_banks", where)
	if err != nil {
		fail(w, http.StatusBadGateway, "统计题库失败: "+err.Error())
		return
	}
	ok(w, map[string]interface{}{"list": list, "total": total, "offset": offset, "limit": limit})
}

func (s *Server) handleQuestions(w http.ResponseWriter, r *http.Request) {
	offset, limit := parsePage(r)
	where := map[string]interface{}{}
	if bankID := r.URL.Query().Get("bankId"); bankID != "" {
		where["bankId"] = bankID
	}
	list, err := s.cloud.Query("quiz_questions", where, offset, limit, "")
	if err != nil {
		fail(w, http.StatusBadGateway, "读取题目失败: "+err.Error())
		return
	}
	total, err := s.cloud.Count("quiz_questions", where)
	if err != nil {
		fail(w, http.StatusBadGateway, "统计题目失败: "+err.Error())
		return
	}
	ok(w, map[string]interface{}{"list": list, "total": total, "offset": offset, "limit": limit})
}

func (s *Server) handleCategories(w http.ResponseWriter, r *http.Request) {
	list, err := s.cloud.Query("quiz_categories", map[string]interface{}{}, 0, 1000, `[{"field":"createdAt","direction":"desc"}]`)
	if err != nil {
		fail(w, http.StatusBadGateway, "读取分类失败: "+err.Error())
		return
	}
	ok(w, map[string]interface{}{"list": list, "total": len(list)})
}

func (s *Server) handleRecords(w http.ResponseWriter, r *http.Request) {
	offset, limit := parsePage(r)
	where := map[string]interface{}{}
	if category := r.URL.Query().Get("category"); category != "" {
		where["category"] = category
	}
	if uid := r.URL.Query().Get("openid"); uid != "" {
		where["_openid"] = uid
	}
	list, err := s.cloud.Query("quiz_records", where, offset, limit, `[{"field":"date","direction":"desc"}]`)
	if err != nil {
		fail(w, http.StatusBadGateway, "读取记录失败: "+err.Error())
		return
	}
	total, err := s.cloud.Count("quiz_records", where)
	if err != nil {
		fail(w, http.StatusBadGateway, "统计记录失败: "+err.Error())
		return
	}
	ok(w, map[string]interface{}{"list": list, "total": total, "offset": offset, "limit": limit})
}

// handleRecentRecords 最近答题记录（取前 N 条）
func (s *Server) handleRecentRecords(w http.ResponseWriter, r *http.Request) {
	n, _ := strconv.Atoi(r.URL.Query().Get("n"))
	if n <= 0 || n > 100 {
		n = 10
	}
	list, err := s.cloud.Query("quiz_records", map[string]interface{}{}, 0, n, `[{"field":"date","direction":"desc"}]`)
	if err != nil {
		fail(w, http.StatusBadGateway, "读取记录失败: "+err.Error())
		return
	}
	ok(w, map[string]interface{}{"list": list})
}

// handleUsers 用户列表：以 quiz_users 为主，按 _id(openid) 分组
func (s *Server) handleUsers(w http.ResponseWriter, r *http.Request) {
	offset, limit := parsePage(r)
	list, err := s.cloud.Query("quiz_users", map[string]interface{}{}, offset, limit, `[{"field":"lastLoginAt","direction":"desc"}]`)
	if err != nil {
		// 集合未创建时返回空列表，不报错
		log.Printf("[warn] query quiz_users failed: %v", err)
		ok(w, map[string]interface{}{"list": []interface{}{}, "total": 0, "offset": offset, "limit": limit})
		return
	}
	total, err := s.cloud.Count("quiz_users", map[string]interface{}{})
	if err != nil {
		total = len(list)
	}

	// 为每个用户补充答题次数
	for _, u := range list {
		uid := strVal(u["_id"])
		if uid == "" {
			continue
		}
		cnt, err := s.cloud.Count("quiz_records", map[string]interface{}{"_openid": uid})
		if err == nil {
			u["quizCount"] = cnt
		}
	}
	ok(w, map[string]interface{}{"list": list, "total": total, "offset": offset, "limit": limit})
}

// ---------- 删除 ----------

func (s *Server) deleteByID(w http.ResponseWriter, r *http.Request, collection string) {
	if r.Method != http.MethodDelete && r.Method != http.MethodPost {
		fail(w, http.StatusMethodNotAllowed, "仅支持 DELETE/POST")
		return
	}
	id := r.URL.Query().Get("id")
	if id == "" {
		fail(w, http.StatusBadRequest, "缺少 id 参数")
		return
	}
	// 兼容 EJSON 的 _id（{$oid:...}）与普通字符串
	docID := normalizeDocID(id)
	if err := s.cloud.Delete(collection, docID); err != nil {
		fail(w, http.StatusBadGateway, "删除失败: "+err.Error())
		return
	}
	ok(w, map[string]interface{}{"deleted": id})
}

func normalizeDocID(id string) string {
	if strings.HasPrefix(id, "{") {
		var m map[string]interface{}
		if json.Unmarshal([]byte(id), &m) == nil {
			if oid, ok := m["$oid"].(string); ok {
				return oid
			}
		}
	}
	return id
}

func (s *Server) handleDeleteBank(w http.ResponseWriter, r *http.Request) {
	s.deleteByID(w, r, "quiz_banks")
}

func (s *Server) handleDeleteQuestion(w http.ResponseWriter, r *http.Request) {
	s.deleteByID(w, r, "quiz_questions")
}

func (s *Server) handleDeleteCategory(w http.ResponseWriter, r *http.Request) {
	s.deleteByID(w, r, "quiz_categories")
}

func (s *Server) handleDeleteRecord(w http.ResponseWriter, r *http.Request) {
	s.deleteByID(w, r, "quiz_records")
}

// ---------- 工具 ----------

func parsePage(r *http.Request) (int, int) {
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if offset < 0 {
		offset = 0
	}
	if limit <= 0 || limit > 1000 {
		limit = 20
	}
	return offset, limit
}

func toInt(v interface{}) int {
	switch val := v.(type) {
	case float64:
		return int(val)
	case int:
		return val
	case string:
		n, _ := strconv.Atoi(val)
		return n
	case map[string]interface{}:
		if s, ok := val["$numberInt"].(string); ok {
			n, _ := strconv.Atoi(s)
			return n
		}
	}
	return 0
}

func toFloat(v interface{}) float64 {
	switch val := v.(type) {
	case float64:
		return val
	case int:
		return float64(val)
	case string:
		f, _ := strconv.ParseFloat(val, 64)
		return f
	case map[string]interface{}:
		if s, ok := val["$numberDouble"].(string); ok {
			f, _ := strconv.ParseFloat(s, 64)
			return f
		}
	}
	return 0
}

func strVal(v interface{}) string {
	switch val := v.(type) {
	case string:
		return val
	case map[string]interface{}:
		if oid, ok := val["$oid"].(string); ok {
			return oid
		}
	}
	return ""
}

func round2(f float64) float64 {
	return float64(int(f*100+0.5)) / 100
}

// 保留 sort 包引用，后续扩展排序时使用
var _ = sort.Ints
var _ = fmt.Sprintf
