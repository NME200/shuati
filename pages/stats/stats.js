const storage = require('../../utils/storage')
const quizService = require('../../utils/quiz')
const theme = require('../../utils/theme')
const auth = require('../../utils/auth')

Page({
  data: {
    isDark: false,
    themeMode: 'auto',
    showStatsDetail: false,
    showRecordsDetail: false,
    stats: {},
    categoryStats: [],
    records: [],
    wrongQuestions: [],
    activeTab: 'overview',
    userInfo: {
      name: '微信用户',
      id: '',
      days: 1,
      avatarUrl: ''
    },
    cacheSize: '0KB'
  },

  onShow() {
    theme.bindPage(this)
    this.refreshUser()
    this.refreshData()
    this.updateCacheSize()
  },

  onUnload() {
    theme.unbindPage(this)
  },

  // 从云端加载真实用户资料；未授权时用默认值兜底
  async refreshUser() {
    const shortId = await storage.getUserShortId()
    const user = await storage.getOrCreateUser()

    let avatarUrl = ''
    if (user && user.avatarFileID) {
      try {
        const res = await wx.cloud.getTempFileURL({ fileList: [user.avatarFileID] })
        const file = res && res.fileList && res.fileList[0]
        if (file && file.tempFileURL) avatarUrl = file.tempFileURL
      } catch (e) {
        console.warn('[stats] get avatar url failed', e)
      }
    }

    const name = (user && user.nickname) || '微信用户'
    const createdAt = (user && user.createdAt) || Date.now()
    const days = Math.max(1, Math.floor((Date.now() - createdAt) / 86400000) + 1)

    this.setData({
      userInfo: {
        name,
        id: shortId || '—',
        days,
        avatarUrl
      }
    })
  },

  // chooseAvatar 返回本地临时路径，上传到云存储后保存 fileID
  async onChooseAvatar(e) {
    const tempPath = e.detail && e.detail.avatarUrl
    if (!tempPath) return
    const openid = auth.getOpenId()
    if (!openid) {
      wx.showToast({ title: '身份未就绪，请稍后重试', icon: 'none' })
      return
    }

    wx.showLoading({ title: '上传中...' })
    try {
      const ext = (tempPath.split('.').pop() || 'png').split('?')[0] || 'png'
      const cloudPath = `avatars/${openid}.${ext}`
      const upload = await wx.cloud.uploadFile({ cloudPath, filePath: tempPath })
      await storage.updateUserProfile({ avatarFileID: upload.fileID })
      wx.hideLoading()
      wx.showToast({ title: '头像已更新', icon: 'success' })
      this.refreshUser()
    } catch (err) {
      wx.hideLoading()
      console.warn('[stats] upload avatar failed', err)
      wx.showToast({ title: '上传失败', icon: 'none' })
    }
  },

  onNicknameInput(e) {
    this._nickname = e.detail.value
  },

  async onNicknameBlur() {
    const nickname = (this._nickname || '').trim()
    if (!nickname || nickname === this.data.userInfo.name) return
    this._nickname = ''
    const ok = await storage.updateUserProfile({ nickname })
    if (ok) {
      wx.showToast({ title: '昵称已保存', icon: 'success' })
      this.refreshUser()
    } else {
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  },

  async refreshData() {
    const stats = await storage.getStats()
    const banks = await storage.getBanks()
    const bankMap = {}
    banks.forEach(b => { bankMap[b.id] = b })

    const categoryStatsMap = await storage.getCategoryStats()
    const categoryStats = Object.entries(categoryStatsMap).map(([id, data]) => ({
      id,
      name: bankMap[id] ? bankMap[id].name : '题库练习',
      ...data,
      accuracy: data.total > 0 ? Math.round(data.correct / data.total * 100) : 0
    })).sort((a, b) => b.accuracy - a.accuracy)

    const records = (await storage.getRecentRecords(20)).map(r => {
      const wrong = r.total - r.correct
      return {
        ...r,
        categoryName: bankMap[r.category] ? bankMap[r.category].name : '题库练习',
        dateText: this.formatDate(r.date),
        durationText: this.formatDuration(r.duration),
        wrong,
        correctWidth: r.total > 0 ? Math.round(r.correct / r.total * 100) : 0,
        wrongWidth: r.total > 0 ? Math.round(wrong / r.total * 100) : 0
      }
    })

    const wrongQuestions = (await storage.getWrongQuestions()).slice(0, 10).map(q => ({
      ...q,
      typeName: quizService.getTypeName(q.type || 'single'),
      answerText: (q.correctAnswer || []).join('、')
    }))

    this.setData({ stats, categoryStats, records, wrongQuestions })
  },

  updateCacheSize() {
    try {
      const info = wx.getStorageInfoSync()
      this.setData({ cacheSize: (info.currentSize || 0) + 'KB' })
    } catch (e) {
      this.setData({ cacheSize: '0KB' })
    }
  },

  showStatsPanel() {
    this.setData({ showStatsDetail: true })
  },

  hideStatsPanel() {
    this.setData({ showStatsDetail: false })
  },

  showRecordsPanel() {
    this.refreshData()
    this.setData({ showRecordsDetail: true })
  },

  hideRecordsPanel() {
    this.setData({ showRecordsDetail: false })
  },

  onThemeToggle() {
    // 由 theme-toggle 组件内部处理切换，此处仅作为事件占位以便扩展
  },

  showFAQ() {
    wx.showModal({
      title: '常见问题',
      content: '1. 如何开始刷题？\n在首页点击刷题记录，或在录题页选择题库开始答题。\n\n2. 如何查看错题？\n答题结束后在结果页可查看错题和详细解析。\n\n3. 数据会丢失吗？\n数据保存在本地，清理缓存后会被删除。',
      showCancel: false,
      confirmText: '知道了'
    })
  },

  showRecommend() {
    wx.showModal({
      title: '程序推荐',
      content: '感谢使用佛脚刷题！\n\n推荐给身边备考的朋友，一起高效学习、共同进步。',
      showCancel: false,
      confirmText: '好的'
    })
  },

  showRecycle() {
    wx.showToast({ title: '暂无回收站记录', icon: 'none' })
  },

  showTutorial() {
    wx.showModal({
      title: '使用教程',
      content: '1. 首页查看刷题记录，点击进入答题\n\n2. 录题页浏览题库，选择题数开始练习\n\n3. 答题结束后查看成绩、错题和解析\n\n4. 本页面可查看统计和清理缓存',
      showCancel: false,
      confirmText: '知道了'
    })
  },

  showContact() {
    wx.showModal({
      title: '联系客服',
      content: '如有问题或建议，欢迎通过小程序留言反馈，我们会尽快回复。',
      showCancel: false,
      confirmText: '知道了'
    })
  },

  showAbout() {
    wx.showModal({
      title: '关于我们',
      content: '佛脚刷题 v1.0.0\n\n一款简洁高效的刷题小程序，助你备考路上事半功倍。',
      showCancel: false,
      confirmText: '知道了'
    })
  },

  clearCache() {
    wx.showModal({
      title: '清理缓存',
      content: `当前缓存 ${this.data.cacheSize}，确定要清理吗？清理后答题记录将被删除。`,
      confirmColor: '#FF4D4F',
      success: async (res) => {
        if (res.confirm) {
          await storage.clearRecords()
          this.refreshData()
          this.updateCacheSize()
          wx.showToast({ title: '缓存已清理', icon: 'success' })
        }
      }
    })
  },

  copyUserId() {
    const shortId = this.data.userInfo.id
    if (!shortId || shortId === '—') {
      wx.showToast({ title: '身份未就绪，请稍后重试', icon: 'none' })
      return
    }
    wx.setClipboardData({
      data: shortId,
      success: () => wx.showToast({ title: '用户ID已复制', icon: 'success' })
    })
  },

  setTab(e) {
    this.setData({ activeTab: e.currentTarget.dataset.tab })
  },

  clearRecords() {
    wx.showModal({
      title: '清空答题记录',
      content: '确定要清空所有答题记录吗？此操作不可恢复。',
      confirmText: '确认清空',
      confirmColor: '#FF4D4F',
      success: async (res) => {
        if (res.confirm) {
          await storage.clearRecords()
          this.refreshData()
          wx.showToast({ title: '已清空', icon: 'success' })
        }
      }
    })
  },

  formatDate(dateStr) {
    const d = new Date(dateStr)
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hour = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    return `${month}-${day} ${hour}:${min}`
  },

  formatDuration(seconds) {
    if (!seconds) return '—'
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
    const ss = String(seconds % 60).padStart(2, '0')
    return `${mm}:${ss}`
  }
})
