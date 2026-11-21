<template>
  <div>
    <h3 class="section-title">数据概览</h3>

    <div class="stat-grid">
      <div v-for="card in statCards" :key="card.key" class="stat-card">
        <div class="stat-label">{{ card.label }}</div>
        <div class="stat-value">{{ card.value }}</div>
        <div class="stat-hint">{{ card.hint }}</div>
      </div>
    </div>

    <div class="chart-row">
      <div class="panel chart-panel">
        <div class="section-title">核心指标</div>
        <div ref="barEl" class="chart"></div>
      </div>
      <div class="panel chart-panel">
        <div class="section-title">答题质量</div>
        <div ref="pieEl" class="chart"></div>
      </div>
    </div>

    <div class="panel">
      <div class="section-title">最近答题记录</div>
      <table class="data-table">
        <thead>
          <tr>
            <th>分类</th>
            <th>得分</th>
            <th>正确/总数</th>
            <th>用时</th>
            <th>日期</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(r, i) in recent" :key="i">
            <td>{{ r.category || '-' }}</td>
            <td>{{ r.score ?? '-' }}</td>
            <td>{{ r.correct ?? '-' }} / {{ r.total ?? '-' }}</td>
            <td>{{ formatDuration(r.duration) }}</td>
            <td>{{ formatDate(r.date) }}</td>
          </tr>
          <tr v-if="!recent.length">
            <td colspan="5" class="muted">暂无数据</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import * as echarts from 'echarts'
import { api } from '../api'

const overview = ref({})
const recent = ref([])
const barEl = ref(null)
const pieEl = ref(null)

const statCards = ref([
  { key: 'banks', label: '题库数', value: '-', hint: '题库总数' },
  { key: 'questions', label: '题目数', value: '-', hint: '题目总数' },
  { key: 'records', label: '答题次数', value: '-', hint: '累计记录' },
  { key: 'users', label: '用户数', value: '-', hint: '已登录用户' },
  { key: 'accuracy', label: '正确率', value: '-', hint: '累计正确率' }
])

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

onMounted(async () => {
  let data = {}
  let recs = []
  try {
    data = await api.overview()
  } catch (e) {
    console.warn('overview load failed', e)
  }
  try {
    const r = await api.recentRecords(8)
    recs = r.list || []
  } catch (e) {
    console.warn('recent load failed', e)
  }
  overview.value = data
  recent.value = recs

  const counts = data.counts || {}
  const values = {
    banks: counts.banks ?? 0,
    questions: counts.questions ?? 0,
    records: counts.records ?? 0,
    users: counts.users ?? 0,
    accuracy: data.accuracy ?? 0
  }
  statCards.value = statCards.value.map(c => ({ ...c, value: values[c.key] }))

  // 柱状图
  if (barEl.value) {
    const chart = echarts.init(barEl.value)
    chart.setOption({
      tooltip: { trigger: 'axis' },
      grid: { left: 40, right: 20, top: 20, bottom: 30 },
      xAxis: { type: 'category', data: ['题库', '题目', '记录', '用户'] },
      yAxis: { type: 'value' },
      series: [{
        type: 'bar',
        barWidth: 36,
        data: [values.banks, values.questions, values.records, values.users],
        itemStyle: { color: '#1e7bee', borderRadius: [4, 4, 0, 0] }
      }]
    })
    window.addEventListener('resize', () => chart.resize())
  }

  // 环形图：正确率
  if (pieEl.value) {
    const chart = echarts.init(pieEl.value)
    chart.setOption({
      tooltip: { trigger: 'item', formatter: '{b}: {c}%' },
      legend: { bottom: 0 },
      series: [{
        type: 'pie',
        radius: ['45%', '70%'],
        label: { formatter: '{b}\n{c}%' },
        data: [
          { value: values.accuracy, name: '正确率', itemStyle: { color: '#22a06b' } },
          { value: Math.max(0, 100 - values.accuracy), name: '错误率', itemStyle: { color: '#f0a04b' } }
        ]
      }]
    })
    window.addEventListener('resize', () => chart.resize())
  }
})
</script>

<style scoped>
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.stat-card {
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 18px;
}

.stat-label {
  color: var(--muted);
  font-size: 13px;
}

.stat-value {
  font-size: 30px;
  font-weight: 600;
  margin: 10px 0 4px;
  color: var(--brand);
}

.stat-hint {
  color: var(--muted);
  font-size: 12px;
}

.chart-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 20px;
}

.chart-panel {
  min-width: 0;
}

.chart {
  height: 280px;
  width: 100%;
}

@media (max-width: 900px) {
  .chart-row {
    grid-template-columns: 1fr;
  }
}
</style>
