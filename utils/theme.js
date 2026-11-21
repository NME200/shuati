// utils/theme.js
// 主题管理：支持 auto（跟随系统）/ light / dark 三种模式，状态持久化，系统主题变化监听

const STORAGE_KEY = 'shuati_theme_mode'

const MODE = {
  AUTO: 'auto',
  LIGHT: 'light',
  DARK: 'dark'
}

const THEME = {
  LIGHT: 'light',
  DARK: 'dark'
}

// 原生导航栏 / TabBar / 窗口背景 配色
const NATIVE_COLORS = {
  [THEME.LIGHT]: {
    navBg: '#FFFFFF',
    navFront: '#000000',        // wx.setNavigationBarColor 仅支持 #ffffff / #000000
    navFrontHex: '#000000',     // 页面内嵌导航栏组件使用
    tabBg: '#FFFFFF',
    tabColor: '#999999',
    tabSelected: '#1E7BEE',
    tabBorder: 'black',
    winBg: '#f5f6fa',
    winBgTop: '#FFFFFF',
    winBgBottom: '#f5f6fa'
  },
  [THEME.DARK]: {
    navBg: '#1C1C1E',
    navFront: '#ffffff',
    navFrontHex: '#E5E5EA',
    tabBg: '#1C1C1E',
    tabColor: '#8E8E93',
    tabSelected: '#5AA8FF',
    tabBorder: 'white',
    winBg: '#121212',
    winBgTop: '#1C1C1E',
    winBgBottom: '#121212'
  }
}

let currentMode = MODE.AUTO
let currentTheme = THEME.LIGHT
let initialized = false
const listeners = []

function readStoredMode() {
  try {
    const value = wx.getStorageSync(STORAGE_KEY)
    if (value === MODE.AUTO || value === MODE.LIGHT || value === MODE.DARK) return value
  } catch (e) {}
  return MODE.AUTO
}

function getSystemTheme() {
  try {
    const info = wx.getSystemInfoSync()
    if (info && info.theme === THEME.DARK) return THEME.DARK
  } catch (e) {}
  return THEME.LIGHT
}

function resolveTheme(mode) {
  if (mode === MODE.AUTO) return getSystemTheme()
  return mode === MODE.DARK ? THEME.DARK : THEME.LIGHT
}

// 应用原生 UI 配色（导航栏 / TabBar / 窗口背景）
// 注意：setNavigationBarColor 只对当前页面生效，因此每个页面 onShow 都需调用
function applyNativeUI(theme) {
  const c = NATIVE_COLORS[theme] || NATIVE_COLORS[THEME.LIGHT]

  try {
    wx.setNavigationBarColor({
      frontColor: c.navFront,
      backgroundColor: c.navBg,
      fail: () => {}
    })
  } catch (e) {}

  try {
    wx.setTabBarStyle({
      color: c.tabColor,
      selectedColor: c.tabSelected,
      backgroundColor: c.tabBg,
      borderStyle: c.tabBorder,
      fail: () => {}
    })
  } catch (e) {}

  try {
    wx.setBackgroundColor({
      backgroundColor: c.winBg,
      backgroundColorTop: c.winBgTop,
      backgroundColorBottom: c.winBgBottom,
      fail: () => {}
    })
  } catch (e) {}
}

function notify() {
  const snapshot = getTheme()
  listeners.slice().forEach(fn => {
    try { fn(snapshot) } catch (e) { console.warn('[theme] listener error', e) }
  })
}

function init() {
  if (initialized) return
  initialized = true

  currentMode = readStoredMode()
  currentTheme = resolveTheme(currentMode)
  applyNativeUI(currentTheme)

  // 跟随系统模式下，监听系统主题变化（基础库 2.11.0+）
  if (typeof wx.onThemeChange === 'function') {
    wx.onThemeChange(res => {
      if (currentMode !== MODE.AUTO) return
      const next = res && res.theme === THEME.DARK ? THEME.DARK : THEME.LIGHT
      if (next === currentTheme) return
      currentTheme = next
      applyNativeUI(currentTheme)
      notify()
    })
  }
}

function setMode(mode) {
  if (mode !== MODE.AUTO && mode !== MODE.LIGHT && mode !== MODE.DARK) return
  currentMode = mode
  currentTheme = resolveTheme(mode)
  try { wx.setStorageSync(STORAGE_KEY, mode) } catch (e) {}
  applyNativeUI(currentTheme)
  notify()
}

// 在日间/夜间间快速切换（基于当前生效主题）
function toggle() {
  setMode(currentTheme === THEME.DARK ? MODE.LIGHT : MODE.DARK)
}

function getTheme() {
  return {
    mode: currentMode,
    theme: currentTheme,
    isDark: currentTheme === THEME.DARK
  }
}

function subscribe(fn) {
  if (typeof fn !== 'function') return () => {}
  listeners.push(fn)
  return function unsubscribe() {
    const idx = listeners.indexOf(fn)
    if (idx > -1) listeners.splice(idx, 1)
  }
}

// 页面辅助：在 onShow 中调用，绑定主题状态 + 重新应用原生导航栏配色
// 返回 unsubscribe，页面 onUnload 时调用
function bindPage(page) {
  if (!page.__themeUnsubscribe) {
    page.__themeUnsubscribe = subscribe(state => {
      page.setData({ isDark: state.isDark, themeMode: state.mode })
      applyNativeUI(state.theme)
    })
  }
  const state = getTheme()
  page.setData({ isDark: state.isDark, themeMode: state.mode })
  applyNativeUI(state.theme)
  return page.__themeUnsubscribe
}

function unbindPage(page) {
  if (page && page.__themeUnsubscribe) {
    page.__themeUnsubscribe()
    page.__themeUnsubscribe = null
  }
}

module.exports = {
  MODE,
  THEME,
  NATIVE_COLORS,
  init,
  setMode,
  toggle,
  getTheme,
  subscribe,
  bindPage,
  unbindPage,
  getSystemTheme
}
