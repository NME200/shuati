<template>
  <div>
    <h3 class="section-title">答题记录</h3>
    <div class="panel">
      <div class="toolbar">
        <input v-model="category" class="input" placeholder="按分类 ID 过滤（可选）" style="width:240px" />
        <button class="btn btn-primary" @click="applyFilter">查询</button>
        <button class="btn" @click="reset">重置</button>
        <span class="muted">共 {{ total }} 条记录</span>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>分类 ID</th>
            <th>得分</th>
            <th>正确/总数</th>
            <th>用时</th>
            <th>日期</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in list" :key="r._id || r.id">
            <td class="muted">{{ r.category || '-' }}</td>
            <td :style="{ color: scoreColor(r.score) }">{{ r.score ?? '-' }}</td>
            <td>{{ r.correct ?? '-' }} / {{ r.total ?? '-' }}</td>
            <td>{{ formatDuration(r.duration) }}</td>
            <td>{{ formatDate(r.date) }}</td>
            <td>
              <button class="btn btn-danger" @click="remove(r)">删除</button>
            </td>
          </tr>
          <tr v-if="!list.length">
            <td colspan="6" class="muted">暂无数据</td>
          </tr>
        </tbody>
      </table>
      <div class="pager">
        <button class="btn" :disabled="offset === 0" @click="prev">上一页</button>
        <span>第 {{ page }} 页</span>
        <button class="btn" :disabled="offset + limit >= total" @click="next">下一页</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { api } from '../api'

const list = ref([])
const total = ref(0)
const offset = ref(0)
const limit = 20
const category = ref('')
const activeCategory = ref('')

const page = computed(() => Math.floor(offset.value / limit) + 1)

function scoreColor(score) {
  if (score == null) return ''
  return score >= 60 ? 'var(--success)' : 'var(--danger)'
}

function formatDuration(sec) {
  if (!sec && sec !== 0) return '-'
  const m = String(Math.floor(sec / 60)).padStart(2, '0')
  const s = String(sec % 60).padStart(2, '0')
  return m + ':' + s
}

function formatDate(str) {
  if (!str) return '-'
  const d = new Date(str)
  if (isNaN(d.getTime())) return str
  const p = n => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

async function load() {
  const params = { offset: offset.value, limit }
  if (activeCategory.value) params.category = activeCategory.value
  const data = await api.records(params)
  list.value = data.list || []
  total.value = data.total || 0
}

function applyFilter() {
  offset.value = 0
  activeCategory.value = category.value.trim()
  load()
}

function reset() {
  category.value = ''
  activeCategory.value = ''
  offset.value = 0
  load()
}

function prev() {
  offset.value = Math.max(0, offset.value - limit)
  load()
}

function next() {
  offset.value += limit
  load()
}

async function remove(r) {
  if (!window.confirm('确定删除这条答题记录吗？')) return
  try {
    const id = r._id && typeof r._id === 'object' ? r._id.$oid : (r._id || r.id)
    await api.remove('records', id)
    await load()
  } catch (e) {
    window.alert('删除失败：' + e.message)
  }
}

onMounted(load)
</script>
