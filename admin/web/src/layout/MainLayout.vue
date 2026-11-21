<template>
  <div class="layout">
    <aside class="sidebar">
      <div class="brand">
        <div class="logo">佛</div>
        <div class="brand-text">
          <div class="title">佛脚刷题</div>
          <div class="sub">管理后台</div>
        </div>
      </div>
      <nav class="nav">
        <router-link v-for="item in navItems" :key="item.path" :to="item.path" class="nav-item"
          :class="{ active: isActive(item.path) }">
          <span class="nav-icon">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </router-link>
      </nav>
      <div class="sidebar-foot">
        <button class="logout" @click="logout">退出登录</button>
      </div>
    </aside>

    <div class="main">
      <header class="topbar">
        <div class="crumb">管理后台 / {{ currentTitle }}</div>
        <div class="admin">
          <span class="avatar">A</span>
          <span>{{ adminName }}</span>
        </div>
      </header>
      <main class="content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api, setToken } from '../api'

const route = useRoute()
const router = useRouter()
const adminName = ref('admin')

const navItems = [
  { path: '/overview', label: '数据概览', icon: '▦' },
  { path: '/banks', label: '题库管理', icon: '▤' },
  { path: '/questions', label: '题目管理', icon: '☰' },
  { path: '/records', label: '答题记录', icon: '◷' },
  { path: '/users', label: '用户管理', icon: '♙' }
]

const currentTitle = computed(() => {
  const item = navItems.find(i => route.path.startsWith(i.path))
  return item ? item.label : '管理后台'
})

function isActive(path) {
  return route.path.startsWith(path)
}

function logout() {
  setToken('')
  router.push('/login')
}

onMounted(async () => {
  try {
    const me = await api.me()
    adminName.value = me.username || 'admin'
  } catch (e) {
    // 401 已由 api 层处理跳转
  }
})
</script>

<style scoped>
.layout {
  display: flex;
  height: 100%;
}

.sidebar {
  width: 220px;
  flex-shrink: 0;
  background: #161b22;
  color: #c9d1d9;
  display: flex;
  flex-direction: column;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px;
  border-bottom: 1px solid #30363d;
}

.logo {
  width: 38px;
  height: 38px;
  border-radius: 8px;
  background: var(--brand);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 600;
}

.brand-text .title {
  font-size: 15px;
  font-weight: 600;
  color: #fff;
}

.brand-text .sub {
  font-size: 12px;
  color: #8b949e;
  margin-top: 2px;
}

.nav {
  flex: 1;
  padding: 16px 12px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 14px;
  border-radius: 6px;
  margin-bottom: 4px;
  color: #c9d1d9;
}

.nav-item:hover {
  background: #21262d;
}

.nav-item.active {
  background: var(--brand);
  color: #fff;
}

.nav-icon {
  width: 20px;
  text-align: center;
  font-size: 15px;
}

.sidebar-foot {
  padding: 16px;
  border-top: 1px solid #30363d;
}

.logout {
  width: 100%;
  height: 36px;
  background: transparent;
  border: 1px solid #30363d;
  color: #c9d1d9;
  border-radius: 6px;
  cursor: pointer;
}

.logout:hover {
  border-color: var(--danger);
  color: var(--danger);
}

.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.topbar {
  height: 60px;
  flex-shrink: 0;
  background: #fff;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
}

.crumb {
  color: var(--muted);
}

.admin {
  display: flex;
  align-items: center;
  gap: 8px;
}

.avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: #e8b94a;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
}

.content {
  flex: 1;
  padding: 24px;
  overflow: auto;
}
</style>
