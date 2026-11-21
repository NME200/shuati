<template>
  <div>
    <h3 class="section-title">题目管理</h3>
    <div class="panel">
      <div class="toolbar">
        <input v-model="keyword" class="input" placeholder="搜索题干" style="width:300px" />
        <input v-model="bankId" class="input" placeholder="按题库 ID 过滤（可选）" style="width:220px" />
        <button class="btn btn-primary" @click="applyFilter">查询</button>
        <button class="btn" @click="reset">重置</button>
        <span class="muted">共 {{ total }} 道题</span>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th style="width:55%">题干</th>
            <th>题型</th>
            <th>答案</th>
            <th>所属题库</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="q in list" :key="q._id || q.id">
            <td>{{ q.question }}</td>
            <td><span class="tag">{{ typeName(q.type) }}</span></td>
            <td>{{ formatAnswer(q.answer) }}</td>
            <td class="muted">{{ q.bankId || '-' }}</td>
            <td>
              <button class="btn btn-danger" @click="remove(q)">删除</button>
            </td>
          </tr>
          <tr v-if="!list.length">
            <td colspan="5" class="muted">暂无数据</td>
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
const bankId = ref('')
const activeBank = ref('')
const activeKeyword = ref('')

const page = computed(() => Math.floor(offset.value / limit) + 1)

function typeName(t) {
  if (t === 'multiple') return '多选题'
  if (t === 'judge' || t === 'boolean') return '判断题'
  return '单选题'
}

function formatAnswer(a) {
  if (!a) return '-'
  if (Array.isArray(a)) return a.join('、')
  return String(a)
}

async function load() {
  const params = { offset: offset.value, limit }
  if (activeBank.value) params.bankId = activeBank.value
  const data = await api.questions(params)
  let rows = data.list || []
  const kw = activeKeyword.value.trim()
  if (kw) rows = rows.filter(q => (q.question || '').includes(kw))
  list.value = rows
  total.value = data.total || 0
}

function applyFilter() {
  offset.value = 0
  activeBank.value = bankId.value.trim()
  activeKeyword.value = keyword.value
  load()
}

function reset() {
  keyword.value = ''
  bankId.value = ''
  activeBank.value = ''
  activeKeyword.value = ''
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

async function remove(q) {
  if (!window.confirm('确定删除这道题吗？此操作不可恢复。')) return
  try {
    const id = q._id && typeof q._id === 'object' ? q._id.$oid : (q._id || q.id)
    await api.remove('questions', id)
    await load()
  } catch (e) {
    window.alert('删除失败：' + e.message)
  }
}

onMounted(load)
</script>
