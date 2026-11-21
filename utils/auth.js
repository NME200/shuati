// 用户身份：通过云函数 login 拿到微信注入的 openid（唯一可信来源）
// openid 不对外展示，界面使用由它生成的短 ID

const STORAGE_KEY = 'shuati_openid'

// 只保存"本次已确认"的 openid：成功来自云函数，失败才降级读本地
let cachedOpenId = ''
let loginPromise = null
let loginSettled = false

function readLocal() {
  try {
    return wx.getStorageSync(STORAGE_KEY) || ''
  } catch (e) {
    return ''
  }
}

function writeLocal(openid) {
  try {
    wx.setStorageSync(STORAGE_KEY, openid || '')
  } catch (e) {}
}

function requestLogin() {
  if (loginPromise) return loginPromise
  // 本次会话已尝试且失败，不再重复请求，避免每次查询都重试
  if (loginSettled && !cachedOpenId) return Promise.resolve('')

  loginPromise = new Promise((resolve) => {
    if (typeof wx === 'undefined' || !wx.cloud) {
      resolve('')
      return
    }
    wx.cloud.callFunction({
      name: 'login',
      data: {},
      success: (res) => {
        const result = (res && res.result) || {}
        resolve(result.openid || '')
      },
      fail: (err) => {
        console.warn('[auth] login cloud function failed', err)
        resolve('')
      }
    })
  }).then(openid => {
    // 云函数成功时以云端为准（避免换账号后沿用旧缓存）；失败才用本地兜底
    cachedOpenId = openid || (cachedOpenId || readLocal())
    if (openid) writeLocal(cachedOpenId)
    loginSettled = true
    loginPromise = null
    return cachedOpenId
  })
  return loginPromise
}

// App 启动时调用：始终向云函数确认一次身份
function init() {
  loginSettled = false
  return requestLogin()
}

function getOpenId() {
  return cachedOpenId
}

// 页面/数据层调用：身份未就绪时等待登录完成，避免用旧缓存过滤数据
function ensureLogin() {
  if (cachedOpenId) return Promise.resolve(cachedOpenId)
  return requestLogin()
}

function isLoginReady() {
  return !!cachedOpenId
}

// 简单 32 位哈希，把 openid 变成固定 8 位短 ID；不可逆、不暴露原文
function getShortId() {
  if (!cachedOpenId) return ''
  let hash = 0x811c9dc5
  for (let i = 0; i < cachedOpenId.length; i++) {
    hash ^= cachedOpenId.charCodeAt(i)
    hash = (hash + (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)) >>> 0
  }
  return 'U-' + hash.toString(16).toUpperCase().padStart(8, '0').slice(-8)
}

module.exports = {
  init,
  getOpenId,
  ensureLogin,
  isLoginReady,
  getShortId
}
