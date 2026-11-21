# shuati

佛脚刷题 —— 微信小程序（云开发）+ Go 云托管管理后台 + Vue 静态托管前端。

## 目录

- `app.js` / `pages/` / `components/` / `utils/` —— 微信小程序主体（云开发）
- `cloudfunctions/parseQuestions/` —— 题目解析云函数
- `admin/server/` —— Go 后端（云托管 CloudRun，含 Dockerfile）
- `admin/web/` —— Vue3 管理前端（静态托管）
- `admin/README.md` —— 管理后台部署说明

## 云托管部署要点

Git 仓库连接后，云托管控制台填写：

- 目标目录：`admin/server`（与 Dockerfile 同级）
- Dockerfile 文件：有，名称 `Dockerfile`
- 端口映射：访问端口 80 / 服务端口 80（Go 服务监听 `PORT`）
- 环境变量：`TCB_API_KEY`、`JWT_SECRET`、`ADMIN_USER`、`ADMIN_PASSWORD`、`TCB_ENV_ID` 等，详见 `admin/README.md`

## 本地运行

```bash
# Go 后端
cd admin/server && go run .

# Vue 前端
cd admin/web && npm install && npm run dev
```
