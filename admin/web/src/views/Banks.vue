<template>
  <div>
    <h3 class="section-title">题库管理</h3>
    <div class="panel">
      <div class="toolbar">
        <input v-model="keyword" class="input" placeholder="搜索题库名称/ID" style="width:240px" />
        <button class="btn" @click="load">刷新</button>
        <span class="muted">共 {{ total }} 个题库</span>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>名称</th>
            <th>ID</th>
            <th>分类</th>
            <th>题目数</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="b in filtered" :key="b._id || b.id">
            <td>{{ b.name }}</td>
            <td class="muted">{{ b.id }}</td>
            <td><span class="tag">{{ b.category === 'all' || !b.category ? '未分类' : b.category }}</span></td>
            <td>{{ b.count ?? '-' }}</td>
            <td>{{ formatTime(b.createdAt) }}</td>
            <td>
              <button class="btn btn-danger" @click="remove(b)">删除</button>
            </td>
          </tr>
          <tr v-if="!filtered.length">
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
const keyword = ref('')

const page = computed(() => Math.floor(offset.value / limit) + 1)
const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return list.value
  return list.value.filter(b =>
    (b.name || '').toLowerCase().includes(kw) || (b.id || '').toLowerCase().includes(kw))
})

function formatTime(v) {
  if (!v) return '-'
  const d = new Date(v)
  if (isNaN(d.getTime())) return v
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

async function load() {
  const data = await api.banks({ offset: offset.value, limit })
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

async function remove(b) {
  if (!window.confirm(`确定删除题库「${b.name}」吗？`)) return
  try {
    const id = b._id && typeof b._id === 'object' ? b._id.$oid : (b._id || b.id)
    await api.remove('banks', id)
    await load()
  } catch (e) {
    window.alert('删除失败：' + e.message)
  }
}

onMounted(load)
</script>
