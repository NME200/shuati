// API 封装：统一携带 JWT、处理响应与登录态
const TOKEN_KEY = 'shuati_admin_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

// 后端基地址。默认同源（部署时前端静态托管 + 后端云托管需用绝对地址或代理）
// 可通过 VITE_API_BASE 环境变量配置，例如 https://xxx.ap-shanghai.app.tcloudbase.com
const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  }
  const token = getToken()
  if (token) headers.Authorization = 'Bearer ' + token

  let res
  try {
    res = await fetch(API_BASE + path, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    })
  } catch (e) {
    throw new Error('网络请求失败：' + e.message)
  }

  let json
  try {
    json = await res.json()
  } catch (e) {
    throw new Error('响应解析失败（HTTP ' + res.status + '）')
  }

  if (res.status === 401) {
    setToken('')
    if (window.location.hash !== '#/login') {
      window.location.hash = '#/login'
    }
    throw new Error(json.message || '登录已失效，请重新登录')
  }
  if (res.status < 200 || res.status >= 300 || json.code !== 0) {
    throw new Error(json.message || '请求失败')
  }
  return json.data
}

export const api = {
  login(username, password) {
    return request('/api/login', { method: 'POST', body: { username, password } })
  },
  me() {
    return request('/api/me')
  },
  overview() {
    return request('/api/overview')
  },
  banks(params = {}) {
    return request('/api/banks?' + new URLSearchParams(params))
  },
  questions(params = {}) {
    return request('/api/questions?' + new URLSearchParams(params))
  },
  categories() {
    return request('/api/categories')
  },
  records(params = {}) {
    return request('/api/records?' + new URLSearchParams(params))
  },
  recentRecords(n = 10) {
    return request('/api/recent-record?n=' + n)
  },
  users(params = {}) {
    return request('/api/users?' + new URLSearchParams(params))
  },
  remove(kind, id) {
    return request('/api/' + kind + '/delete?id=' + encodeURIComponent(id), { method: 'DELETE' })
  }
}
