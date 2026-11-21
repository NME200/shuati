# 佛脚刷题 · 管理后台

A 方案实现：Go 云托管后端 + Vue 静态托管前端，数据落在同一云开发环境。

## 目录结构

```
admin/
├── server/                # Go 后端（部署到云托管 CloudRun）
│   ├── main.go            # 入口、监听 PORT
│   ├── config.go          # 环境变量配置
│   ├── cloudbase.go       # 云开发 HTTP API 客户端（文档型数据库）
│   ├── auth.go            # 密码哈希(PBKDF2) + JWT（纯标准库）
│   ├── handlers.go        # REST API 路由与处理
│   ├── go.mod
│   ├── Dockerfile         # 多阶段构建（golang:1.24 → alpine）
│   └── .dockerignore
└── web/                   # Vue3 + Vite 管理前端（部署到静态托管）
    ├── src/
    │   ├── api.js         # 请求封装（携带 JWT）
    │   ├── router.js      # 路由与登录守卫
    │   ├── views/         # 登录/概览/题库/题目/记录/用户
    │   └── layout/        # 后台布局
    ├── vite.config.js
    └── dist/              # 构建产物（部署目录）
```

## 环境变量（云托管服务端配置）

| 变量 | 说明 | 示例 |
|---|---|---|
| `PORT` | 服务监听端口，云托管注入 | `80` |
| `TCB_ENV_ID` | 云开发环境 ID | `cloud1-dqgtbohwe97f1bc9` |
| `TCB_API_KEY` | 管理端 API Key（Bearer），**严禁放前端** | 控制台 ApiKey 管理页获取 |
| `JWT_SECRET` | JWT 签名密钥，随机长字符串 | 自行生成 |
| `ADMIN_USER` | 管理员用户名 | `admin` |
| `ADMIN_PASSWORD` | 管理员明文密码（首次用） | 自行设置 |
| `ADMIN_PASSWORD_HASH` | 管理员密码 hash（生产推荐，优先于明文） | 见下方生成方法 |
| `JWT_TTL_HOURS` | token 有效期小时 | `12` |
| `CORS_ORIGINS` | 允许的来源，`*` 或逗号分隔域名 | `*` |

生成密码 hash（本地运行一次 Go 程序或沿用明文均可）：
- 明文密码在启动时自动 hash；生产建议改用预生成 hash，避免明文出现在环境变量。

## 管理端 API Key 获取
1. 云开发控制台 → 环境 → API Key 管理（或访问 `https://tcb.cloud.tencent.com/dev?envId=<envId>#/env/apikey`）
2. 创建/复制 **管理端** ApiKey（拥有服务端权限），填入 `TCB_API_KEY`
3. 不要把该 Key 写进前端代码或提交到仓库

## 部署步骤

### 1. 部署 Go 后端到云托管
```bash
cd admin/server
tcb login                        # 首次需要登录
tcb cloudrun deploy \
  --env-id cloud1-dqgtbohwe97f1bc9 \
  --service-name shuati-admin-api \
  --source ./ \
  --port 80 \
  --open-access-types PUBLIC \
  --min-num 0 --max-num 3
# 环境变量在控制台"云托管 → 服务 → 配置"里配置，或用 --env-params 传入
```
部署完成后拿到公网访问地址，例如 `https://shuati-admin-xxx.ap-shanghai.app.tcloudbase.com`。

### 2. 前端配置后端地址
编辑 `admin/web/.env.production`：
```
VITE_API_BASE=https://上一步拿到的云托管地址
```
同时把云托管地址加到 Go 服务的 `CORS_ORIGINS`（多个用逗号分隔）。

### 3. 构建并部署前端到静态托管
```bash
cd admin/web
npm install
npm run build
tcb hosting deploy ./dist -e cloud1-dqgtbohwe97f1bc9
```
静态托管域名从控制台获取，形如 `https://cloud1-xxx-xxx.tcloudbaseapp.com`。

### 4. 安全与权限
- 数据库四张业务集合 + `quiz_users` 保持"仅创建者可读写"（小程序侧隔离不变）
- 管理端通过管理端 API Key 以服务端身份读取全量数据，与小程序权限体系互不干扰
- 管理端账号独立于小程序 openid
- 生产环境务必修改 `JWT_SECRET`、`ADMIN_PASSWORD`，并配置 HTTPS 域名与 CORS 白名单

## 本地开发
```bash
# 后端（本地 8080）
cd admin/server
PORT=8080 TCB_API_KEY=<你的key> go run .

# 前端（代理 /api 到 localhost:8080）
cd admin/web
VITE_API_TARGET=http://localhost:8080 npm run dev
```

## 已实现的 API
- `GET  /api/health` 健康检查
- `POST /api/login` 登录，返回 JWT
- `GET  /api/me` 当前管理员
- `GET  /api/overview` 概览统计（各集合数量、正确率、平均分）
- `GET  /api/banks` 题库分页列表
- `GET  /api/questions` 题目分页列表（可按 bankId 过滤）
- `GET  /api/categories` 分类列表
- `GET  /api/records` 答题记录分页列表
- `GET  /api/recent-record?n=` 最近记录
- `GET  /api/users` 用户列表（含答题次数）
- `DELETE /api/{banks|questions|categories|records}/delete?id=` 基础删除

## 验证状态
- Go：`go build` / `go vet` 通过；health、login、JWT 鉴权冒烟测试通过
- Vue：`npm run build` 构建通过
- 未执行云端部署（需要你的 tcb 登录态与管理端 API Key）
