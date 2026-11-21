<template>
  <div>
    <h3 class="section-title">用户管理</h3>
    <div class="panel">
      <div class="toolbar">
        <span class="muted">共 {{ total }} 位用户（以 quiz_users 集合为准）</span>
        <button class="btn" @click="load" style="margin-left:auto">刷新</button>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>用户标识</th>
            <th>昵称</th>
            <th>答题次数</th>
            <th>首次登录</th>
            <th>最近登录</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in list" :key="u._id">
            <td class="muted">{{ shortId(u._id) }}</td>
            <td>{{ u.nickname || '微信用户' }}</td>
            <td>{{ u.quizCount ?? '-' }}</td>
            <td>{{ formatTime(u.createdAt) }}</td>
            <td>{{ formatTime(u.lastLoginAt) }}</td>
          </tr>
          <tr v-if="!list.length">
            <td colspan="5" class="muted">暂无用户数据</td>
          </tr>
        </tbody>
      </table>
      <div class="pager">
        <button class="btn" :disabled="offset === 0" @click="prev">上一页</button>
        <span>第 {{ page }} 页</span>
        <button class="btn" :disabled="offset + limit >= total" @click="next">下一页</button>
      </div>
    </div>
    <p class="note">说明：出于隐私保护，此处仅展示用户标识前缀，不显示完整 openid。</p>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { api } from '../api'

const list = ref([])
const total = ref(0)
const offset = ref(0)
const limit = 20

const page = computed(() => Math.floor(offset.value / limit) + 1)

function shortId(id) {
  if (!id) return '-'
  if (typeof id === 'object') id = id.$oid || ''
  return id ? id.slice(0, 10) + '…' : '-'
}

function formatTime(v) {
  if (!v) return '-'
  const d = new Date(v)
  if (isNaN(d.getTime())) return v
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

async function load() {
  const data = await api.users({ offset: offset.value, limit })
  list.value = data.list || []
  total.value = data.total || 0
}

function prev() {
  offset.value = Math.max(0, offset.value - limit)
  load()
}

function next() {
  offset.value += limit
  load()
}

onMounted(load)
</script>

<style scoped>
.note {
  color: var(--muted);
  font-size: 12px;
  margin-top: 12px;
}
</style>
