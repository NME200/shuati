<template>
  <div class="login-page">
    <div class="login-card">
      <div class="logo">佛</div>
      <h2>佛脚刷题 · 管理后台</h2>
      <p class="sub">请使用管理员账号登录</p>

      <form @submit.prevent="submit">
        <label>用户名</label>
        <input v-model="username" class="input" placeholder="admin" autocomplete="username" />

        <label>密码</label>
        <input v-model="password" class="input" type="password" placeholder="请输入密码" autocomplete="current-password" />

        <div v-if="error" class="error">{{ error }}</div>

        <button class="btn btn-primary submit" type="submit" :disabled="loading">
          {{ loading ? '登录中...' : '登录' }}
        </button>
      </form>
      <p class="tip">账号密码由云托管环境变量 ADMIN_USER / ADMIN_PASSWORD 配置</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { api, setToken } from '../api'

const router = useRouter()
const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  if (!username.value || !password.value) {
    error.value = '请输入用户名和密码'
    return
  }
  loading.value = true
  try {
    const data = await api.login(username.value, password.value)
    setToken(data.token)
    router.push('/overview')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #eef4ff 0%, #dbe8ff 100%);
}

.login-card {
  width: 380px;
  background: #fff;
  border-radius: 14px;
  padding: 36px;
  box-shadow: 0 12px 40px rgba(30, 123, 238, 0.12);
}

.logo {
  width: 52px;
  height: 52px;
  border-radius: 12px;
  background: var(--brand);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  font-weight: 600;
  margin-bottom: 18px;
}

h2 {
  margin: 0;
  font-size: 20px;
}

.sub {
  color: var(--muted);
  margin: 8px 0 28px;
}

form label {
  display: block;
  margin: 16px 0 8px;
  font-size: 13px;
  color: var(--text);
}

form .input {
  width: 100%;
  height: 40px;
}

.error {
  color: var(--danger);
  font-size: 13px;
  margin-top: 14px;
}

.submit {
  width: 100%;
  height: 42px;
  margin-top: 24px;
}

.tip {
  color: var(--muted);
  font-size: 12px;
  text-align: center;
  margin: 20px 0 0;
  line-height: 1.6;
}
</style>
