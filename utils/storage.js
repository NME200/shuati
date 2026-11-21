// 云开发数据服务：云数据库为主，本地缓存加速、离线降级
// 所有数据以当前用户 openid 归属：读取显式按 _openid 过滤，写入依赖微信自动注入 _openid + 集合权限"仅创建者可读写"
const auth = require('./auth')

const LOCAL_KEYS = {
  records: 'quiz_records',
  banks: 'quiz_banks',
  bankQuestions: 'quiz_bank_questions',
  categories: 'quiz_custom_categories'
}

const COLLECTIONS = {
  records: 'quiz_records',
  banks: 'quiz_banks',
  questions: 'quiz_questions',
  categories: 'quiz_categories',
  users: 'quiz_users'
}

let dbInstance = null
let useCloud = false
let lastCloudError = null

// ===== 读取缓存：同一会话内复用云端结果，避免重复网络请求 =====
const memoryCache = {}
const CACHE_TTL = 5 * 60 * 1000
const PAGE_CONCURRENCY = 6

function cacheKey(name, where) {
  return name + ':' + (where ? JSON.stringify(where) : '')
}

function getCache(key) {
  const item = memoryCache[key]
  if (item && Date.now() - item.time < CACHE_TTL) return item.data.slice()
  return null
}

function setCache(key, data) {
  memoryCache[key] = { data, time: Date.now() }
}

function invalidateCache(name) {
  const prefix = name + ':'
  Object.keys(memoryCache).forEach(key => {
    if (key.indexOf(prefix) === 0) delete memoryCache[key]
  })
}

function getDb() {
  if (dbInstance) return dbInstance
  try {
    if (typeof wx !== 'undefined' && wx.cloud) {
      dbInstance = wx.cloud.database()
      useCloud = true
      return dbInstance
    }
  } catch (e) {
    console.warn('[storage] cloud init failed', e)
  }
  return null
}

function localGet(key) {
  try {
    return wx.getStorageSync(key) || []
  } catch (e) {
    return []
  }
}

function localSet(key, value) {
  try {
    wx.setStorageSync(key, value)
  } catch (e) {}
}

function normalizeKey(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/\s+/g, '')
    .trim()
}

function questionKey(question) {
  const options = (question.options || [])
    .map(option => option.key + ':' + normalizeKey(option.text))
    .sort()
    .join(',')
  return [normalizeKey(question.question), options, (question.answer || []).slice().sort().join('')].join('|')
}

function dedupeQuestions(list) {
  const seen = {}
  return (list || []).filter(question => {
    const key = questionKey(question)
    if (seen[key]) return false
    seen[key] = true
    return true
  })
}

// 分页拉取集合全部数据（小程序端单次上限 20）
// 优化：会话内缓存 + 先 count 再并发分页，避免多次串行网络往返
// 归属：自动注入 _openid 条件，确保只读写当前用户的数据
async function fetchAll(name, where) {
  const db = getDb()
  if (!db) return localGet(LOCAL_KEYS[name]) || []

  const openid = await auth.ensureLogin()
  if (!openid) {
    console.warn('[storage] openid unavailable, skip read ' + name)
    return []
  }

  // 合并调用方条件与归属条件，缓存 key 含 openid，避免切换账号命中旧数据
  const scopedWhere = Object.assign({}, where || {}, { _openid: openid })
  const key = cacheKey(name, scopedWhere)
  const cached = getCache(key)
  if (cached) return cached

  try {
    const MAX = 20
    let query = db.collection(COLLECTIONS[name]).where(scopedWhere)

    let total = -1
    try {
      const countRes = await query.count()
      total = countRes.total || 0
    } catch (e) {
      total = -1
    }

    let all = []
    if (total === 0) {
      setCache(key, all)
      return all
    }

    if (total < 0) {
      // count 不可用时降级为串行分页，保证功能可用
      let skip = 0
      while (skip < 10000) {
        const res = await query.skip(skip).limit(MAX).get()
        const list = res.data || []
        all = all.concat(list)
        if (list.length < MAX) break
        skip += MAX
      }
    } else {
      const pageCount = Math.ceil(total / MAX)
      for (let i = 0; i < pageCount; i += PAGE_CONCURRENCY) {
        const tasks = []
        for (let j = i; j < Math.min(i + PAGE_CONCURRENCY, pageCount); j++) {
          tasks.push(query.skip(j * MAX).limit(MAX).get())
        }
        const results = await Promise.all(tasks)
        results.forEach(res => { all = all.concat(res.data || []) })
      }
    }

    setCache(key, all)
    return all
  } catch (e) {
    console.warn('[storage] fetchAll ' + name + ' failed', e)
    return localGet(LOCAL_KEYS[name]) || []
  }
}

async function setDoc(name, id, data) {
  const db = getDb()
  if (!db) return false
  lastCloudError = null
  const collection = db.collection(COLLECTIONS[name])
  try {
    let exists = false
    try {
      const current = await collection.doc(id).get()
      exists = !!(current && current.data)
    } catch (e) {
      exists = false
    }

    if (exists) {
      await collection.doc(id).update({ data })
    } else {
      await collection.add({ data })
    }
    invalidateCache(name)
    return true
  } catch (e) {
    lastCloudError = e
    console.warn('[storage] setDoc ' + name + ' failed', e)
    return false
  }
}

async function removeDoc(name, id) {
  const db = getDb()
  if (!db) return false
  try {
    await db.collection(COLLECTIONS[name]).doc(id).remove()
    invalidateCache(name)
    return true
  } catch (e) {
    return false
  }
}

// ============ 答题记录 ============
async function getRecords() {
  const list = await fetchAll('records')
  return list.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
}

async function saveRecord(record) {
  const id = Date.now().toString()
  const doc = Object.assign({ id, date: new Date().toISOString() }, record)
  const ok = await setDoc('records', id, doc)
  return ok ? doc : null
}

async function clearRecords() {
  const db = getDb()
  if (!db) { localSet(LOCAL_KEYS.records, []); return true }
  const list = await fetchAll('records')
  await Promise.all(list.map(r => removeDoc('records', r._id || r.id)))
  return true
}

async function deleteRecordsByCategory(categories) {
  const list = await fetchAll('records')
  await Promise.all(list
    .filter(r => categories.indexOf(r.category) > -1)
    .map(r => removeDoc('records', r._id || r.id)))
  return true
}

// ============ 分类 ============
async function getCustomCategories() {
  const list = await fetchAll('categories')
  return list.map(c => ({ id: c.id, name: c.name, createdAt: c.createdAt }))
}

async function createCategory(name) {
  const id = 'cat_' + Date.now().toString()
  const doc = { id, name, createdAt: Date.now() }
  const ok = await setDoc('categories', id, doc)
  return ok ? doc : null
}

async function deleteCategory(categoryId) {
  const banks = await getBanks()
  if (banks.some(b => b.category === categoryId)) return false
  const list = await fetchAll('categories')
  const target = list.find(c => c.id === categoryId)
  if (!target) return true
  return removeDoc('categories', target._id || target.id)
}

// ============ 题库 ============
async function getBanks() {
  const list = await fetchAll('banks')
  return list.map(b => ({
    id: b.id,
    name: b.name,
    category: b.category || 'all',
    createdAt: b.createdAt || Date.now(),
    count: b.count || 0
  }))
}

async function createBank(name, category) {
  const id = 'bank_' + Date.now().toString()
  const doc = { id, name, category: category || 'all', createdAt: Date.now(), count: 0 }
  const ok = await setDoc('banks', id, doc)
  return ok ? doc : null
}

async function deleteBank(bankId) {
  const questions = await getQuestionsOfBank(bankId)
  await Promise.all(questions.map(q => removeDoc('questions', q._id || q.id)))
  const banks = await fetchAll('banks')
  const target = banks.find(b => b.id === bankId)
  if (target) await removeDoc('banks', target._id || target.id)
  return true
}

// ============ 题目 ============
async function getBankQuestions() {
  return fetchAll('questions')
}

async function fetchBankQuestionDocs(bankId) {
  const db = getDb()
  if (!db) {
    const all = localGet(LOCAL_KEYS.bankQuestions)
    return (all && all[bankId]) || []
  }
  // 复用 questions 全量缓存，多个题库不再各自分页查询，消除 N+1 串行请求
  const all = await fetchAll('questions')
  return (all || []).filter(q => q.bankId === bankId)
}

async function getQuestionsOfBank(bankId) {
  try {
    return dedupeQuestions(await fetchBankQuestionDocs(bankId))
  } catch (e) {
    console.warn('[storage] getQuestionsOfBank failed', e)
    return []
  }
}

function cleanQuestionData(question, bankId) {
  const data = Object.assign({}, question, { bankId })
  delete data._id
  delete data._openid
  return data
}

async function addQuestionDoc(question) {
  const db = getDb()
  if (!db) return false
  try {
    await db.collection(COLLECTIONS.questions).add({ data: question })
    invalidateCache('questions')
    return true
  } catch (e) {
    lastCloudError = e
    console.warn('[storage] add question failed', e)
    return false
  }
}

async function updateQuestionDoc(docId, question) {
  const db = getDb()
  if (!db) return false
  try {
    await db.collection(COLLECTIONS.questions).doc(docId).update({ data: question })
    invalidateCache('questions')
    return true
  } catch (e) {
    lastCloudError = e
    console.warn('[storage] update question failed', e)
    return false
  }
}

async function addQuestionsToBank(bankId, newQuestions, onProgress) {
  const db = getDb()
  if (!db) {
    const all = localGet(LOCAL_KEYS.bankQuestions) || {}
    all[bankId] = dedupeQuestions((all[bankId] || []).concat(newQuestions))
    localSet(LOCAL_KEYS.bankQuestions, all)
    if (onProgress) onProgress(newQuestions.length, newQuestions.length, newQuestions.length, 0)
    return { success: true, saved: newQuestions.length, added: newQuestions.length, updated: 0, failed: 0 }
  }

  lastCloudError = null
  const total = newQuestions.length
  const batchSize = 8
  const existingDocs = await fetchBankQuestionDocs(bankId)
  const groups = {}
  existingDocs.forEach(doc => {
    const key = questionKey(doc)
    if (!groups[key]) groups[key] = []
    groups[key].push(doc)
  })
  const pending = {}

  let added = 0
  let updated = 0
  let failed = 0

  for (let i = 0; i < total; i += batchSize) {
    const batch = newQuestions.slice(i, i + batchSize)
    const results = await Promise.all(batch.map(async q => {
      const key = questionKey(q)
      const data = cleanQuestionData(q, bankId)
      const matches = groups[key]
      if (matches && matches.length) {
        const okList = await Promise.all(matches.map(doc => updateQuestionDoc(doc._id, data)))
        return okList.every(Boolean) ? 'updated' : 'failed'
      }
      if (pending[key]) return 'updated'
      pending[key] = true
      return (await addQuestionDoc(data)) ? 'added' : 'failed'
    }))
    results.forEach(result => {
      if (result === 'added') added += 1
      else if (result === 'updated') updated += 1
      else failed += 1
    })
    if (onProgress) onProgress(Math.min(i + batchSize, total), total, added + updated, failed)
  }

  try {
    const banks = await fetchAll('banks')
    const target = banks.find(b => b.id === bankId)
    if (target) {
      const uniqueCount = dedupeQuestions(await fetchBankQuestionDocs(bankId)).length
      await db.collection(COLLECTIONS.banks).doc(target._id || target.id).update({ count: uniqueCount })
      invalidateCache('banks')
    }
  } catch (e) {
    console.warn('[storage] update bank count failed', e)
  }

  return {
    success: failed === 0,
    saved: added + updated,
    added,
    updated,
    failed,
    error: lastCloudError
  }
}

// ============ 统计（基于云端记录） ============
async function getStats() {
  const records = await getRecords()
  if (records.length === 0) {
    return { totalQuizzes: 0, totalQuestions: 0, totalCorrect: 0, accuracy: 0, streak: 0 }
  }
  const totalQuestions = records.reduce((sum, r) => sum + r.total, 0)
  const totalCorrect = records.reduce((sum, r) => sum + r.correct, 0)
  const dates = [...new Set(records.map(r => (r.date || '').slice(0, 10)))].sort().reverse()
  let streak = 0
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  if (dates[0] === today || dates[0] === yesterday) {
    streak = 1
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]).getTime()
      const curr = new Date(dates[i]).getTime()
      if (prev - curr === 86400000) streak++
      else break
    }
  }
  return {
    totalQuizzes: records.length,
    totalQuestions,
    totalCorrect,
    accuracy: totalQuestions > 0 ? Math.round(totalCorrect / totalQuestions * 100) : 0,
    streak
  }
}

async function getCategoryStats() {
  const records = await getRecords()
  const stats = {}
  records.forEach(r => {
    const cat = r.category || 'unknown'
    if (!stats[cat]) stats[cat] = { total: 0, correct: 0, count: 0 }
    stats[cat].total += r.total
    stats[cat].correct += r.correct
    stats[cat].count += 1
  })
  return stats
}

async function getRecentRecords(n = 10) {
  const records = await getRecords()
  return records.slice(0, n)
}

async function getWrongQuestions() {
  const records = await getRecords()
  const wrongMap = {}
  records.forEach(r => {
    if (r.wrongList && r.wrongList.length) {
      r.wrongList.forEach(q => {
        if (!wrongMap[q.id]) wrongMap[q.id] = Object.assign({}, q, { count: 0 })
        wrongMap[q.id].count++
      })
    }
  })
  return Object.values(wrongMap).sort((a, b) => b.count - a.count)
}

// ============ 用户资料（以 openid 为 _id，归属由集合权限保障） ============
async function getOrCreateUser() {
  const db = getDb()
  const openid = await auth.ensureLogin()
  if (!db || !openid) return null

  try {
    const res = await db.collection(COLLECTIONS.users).doc(openid).get()
    if (res && res.data) return res.data
  } catch (e) {
    // 文档不存在，走创建
  }

  const doc = {
    nickname: '',
    avatarFileID: '',
    createdAt: Date.now(),
    lastLoginAt: Date.now()
  }
  try {
    await db.collection(COLLECTIONS.users).add({ data: Object.assign({ _id: openid }, doc) })
    return Object.assign({ _id: openid }, doc)
  } catch (e) {
    // 并发创建时可能已存在，再读一次
    try {
      const existing = await db.collection(COLLECTIONS.users).doc(openid).get()
      if (existing && existing.data) return existing.data
    } catch (e2) {}
    lastCloudError = e
    console.warn('[storage] getOrCreateUser failed', e)
    return null
  }
}

async function updateUserProfile(patch) {
  const db = getDb()
  const openid = await auth.ensureLogin()
  if (!db || !openid) return false

  const data = {}
  if (typeof patch.nickname === 'string') data.nickname = patch.nickname
  if (typeof patch.avatarFileID === 'string') data.avatarFileID = patch.avatarFileID
  data.lastLoginAt = Date.now()

  try {
    const collection = db.collection(COLLECTIONS.users)
    let exists = false
    try {
      const current = await collection.doc(openid).get()
      exists = !!(current && current.data)
    } catch (e) {
      exists = false
    }
    if (exists) {
      await collection.doc(openid).update({ data })
    } else {
      await collection.add({ data: Object.assign({ _id: openid, createdAt: Date.now() }, data) })
    }
    return true
  } catch (e) {
    lastCloudError = e
    console.warn('[storage] updateUserProfile failed', e)
    return false
  }
}

async function getUserShortId() {
  await auth.ensureLogin()
  return auth.getShortId()
}

module.exports = {
  getLastCloudError: () => lastCloudError,
  getRecords,
  saveRecord,
  clearRecords,
  deleteRecordsByCategory,
  getStats,
  getCategoryStats,
  getRecentRecords,
  getWrongQuestions,
  getCustomCategories,
  createCategory,
  deleteCategory,
  getBanks,
  createBank,
  deleteBank,
  getBankQuestions,
  getQuestionsOfBank,
  addQuestionsToBank,
  getOrCreateUser,
  updateUserProfile,
  getUserShortId
}
