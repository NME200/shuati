const storage = require('../../utils/storage')
const theme = require('../../utils/theme')

const SOURCES = [
  { value: 'text', name: '粘贴文本' },
  { value: 'file', name: '本地文件' },
  { value: 'url', name: '网络URL' }
]

const CLOUD_ENV = 'cloud1-dqgtbohwe97f1bc9'

function describeError(err) {
  if (!err) return '未知错误'
  const code = err.errCode !== undefined && err.errCode !== null
    ? '错误码 ' + err.errCode + '；'
    : ''
  const message = err.errMsg || err.message || String(err)
  return code + message
}

function isCloudEnvError(err) {
  const detail = describeError(err)
  return /601034|云开发|env|environment|not exist|not found|未开通|未关联|未绑定|permission deny|permission denied/i.test(detail)
}

function cloudSetupContent(detail) {
  return '小程序端无法访问云环境。\n\n' + detail +
    '\n\n请在微信开发者工具中依次操作：云开发 → 设置 → 环境设置 → 环境名称 → 管理我的环境 → 使用已有腾讯云环境，选择 ' +
    CLOUD_ENV + ' 并完成转换；同时确认腾讯云账号中心的“微信公众平台”已关联当前小程序。'
}

function showCloudError(err, title, prefix) {
  const detail = describeError(err)
  const content = isCloudEnvError(err)
    ? cloudSetupContent(detail)
    : (prefix ? prefix + '\n\n' : '') + detail
  wx.showModal({ title: title, content: content, showCancel: false })
}

Page({
  data: {
    isDark: false,
    themeMode: 'auto',
    banks: [],
    bankIndex: 0,
    bankNames: [],
    sources: SOURCES,
    sourceIndex: 0,
    inputText: '',
    url: '',
    filePath: '',
    fileName: '',
    parsedCount: 0,
    preview: [],
    parsing: false
  },

  async onLoad(options) {
    const banks = await storage.getBanks()
    const bankNames = banks.map(b => b.name)
    let bankIndex = 0
    if (options.bankId) {
      const idx = banks.findIndex(b => b.id === options.bankId)
      if (idx > -1) bankIndex = idx
    }
    this.setData({ banks, bankNames, bankIndex })
  },

  onShow() {
    theme.bindPage(this)
  },

  onUnload() {
    theme.unbindPage(this)
  },

  async ensureCloudReady() {
    if (!wx.cloud) {
      wx.showModal({
        title: '云服务不可用',
        content: '当前微信或开发者工具版本不支持云开发，请升级到最新版后重试。',
        showCancel: false
      })
      return false
    }

    const app = getApp()
    if (!app.globalData.cloudReady && app.initCloud) app.initCloud()
    if (!app.globalData.cloudReady) {
      showCloudError({ message: 'wx.cloud 初始化失败' }, '云服务不可用')
      return false
    }

    if (this._cloudChecked) return true

    try {
      await wx.cloud.callFunction({
        name: 'parseQuestions',
        data: { healthCheck: true }
      })
      this._cloudChecked = true
      return true
    } catch (e) {
      showCloudError(e, '云服务不可用', '连不上云函数 parseQuestions。')
      return false
    }
  },

  onBankChange(e) {
    this.setData({ bankIndex: Number(e.detail.value) })
  },

  onSourceChange(e) {
    this.setData({ sourceIndex: Number(e.detail.value), preview: [], parsedCount: 0 })
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value })
  },

  onUrlInput(e) {
    this.setData({ url: e.detail.value })
  },

  chooseFile() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['docx', 'xlsx', 'xls', 'pdf', 'txt'],
      success: (res) => {
        const file = res.tempFiles[0]
        this.setData({ filePath: file.path, fileName: file.name, preview: [], parsedCount: 0 })
      }
    })
  },

  loadDemo() {
    const demo = `在 JavaScript 中，以下哪个是基本数据类型？
A. Object
B. String
C. Array
D. Function
答案：B
解析：String 是基本数据类型，其他都是引用类型。

CSS 中哪个属性用于设置元素的最小宽度？
A. width
B. min-width
C. max-width
D. auto-width
答案：B
解析：min-width 用于设置元素的最小宽度。`
    this.setData({ inputText: demo, sourceIndex: 0 })
    this.parseQuestions()
  },

  clearInput() {
    this.setData({ inputText: '', url: '', filePath: '', fileName: '', preview: [], parsedCount: 0 })
  },

  // 调用云函数解析
  async callParse(payload) {
    wx.showLoading({ title: '解析中...' })
    this.setData({ parsing: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'parseQuestions',
        data: payload
      })
      wx.hideLoading()
      this.setData({ parsing: false })
      const result = res.result || {}
      if (!result.success) {
        wx.showModal({ title: '解析失败', content: result.error || '未知错误', showCancel: false })
        return []
      }
      return result.questions || []
    } catch (e) {
      wx.hideLoading()
      this.setData({ parsing: false })
      showCloudError(e, '解析失败', '调用云函数 parseQuestions 失败。')
      return []
    }
  },

  async parseQuestions() {
    const cloudReady = await this.ensureCloudReady()
    if (!cloudReady) return

    const source = SOURCES[this.data.sourceIndex].value
    let questions = []

    if (source === 'text') {
      if (!this.data.inputText.trim()) {
        wx.showToast({ title: '请输入题目内容', icon: 'none' })
        return
      }
      questions = await this.callParse({text: this.data.inputText })
    } else if (source === 'url') {
      if (!this.data.url.trim()) {
        wx.showToast({ title: '请输入 URL', icon: 'none' })
        return
      }
      questions = await this.callParse({url: this.data.url.trim() })
    } else if (source === 'file') {
      if (!this.data.filePath) {
        wx.showToast({ title: '请先选择文件', icon: 'none' })
        return
      }
      // 上传到云存储
      wx.showLoading({ title: '上传中...' })
      const ext = (this.data.fileName.split('.').pop() || 'txt').toLowerCase()
      const cloudPath = `imports/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      try {
        const up = await wx.cloud.uploadFile({
          cloudPath,
          filePath: this.data.filePath
        })
        wx.hideLoading()
        questions = await this.callParse({fileID: up.fileID })
      } catch (e) {
        wx.hideLoading()
        showCloudError(e, '上传失败', '上传文件到云存储失败。')
        return
      }
    }

    if (questions.length > 0) {
      this.setData({
        preview: questions.slice(0, 5),
        parsedCount: questions.length
      })
      this._parsedQuestions = questions
      wx.showToast({ title: `解析到 ${questions.length} 题`, icon: 'success' })
    }
  },

  async importQuestions() {
    const questions = this._parsedQuestions || []
    if (questions.length === 0) {
      wx.showToast({ title: '请先解析题目', icon: 'none' })
      return
    }
    const bank = this.data.banks[this.data.bankIndex]
    if (!bank) {
      wx.showToast({ title: '请先创建题库', icon: 'none' })
      return
    }
    wx.showLoading({ title: `导入中 0/${questions.length}` })
    try {
      const result = await storage.addQuestionsToBank(bank.id, questions, (done, total) => {
        wx.showLoading({ title: `导入中 ${done}/${total}` })
      })
      wx.hideLoading()
      if (result && result.failed > 0) {
        const detail = result.error
          ? (result.error.errMsg || result.error.message || String(result.error))
          : '部分题目写入失败，请检查 quiz_questions 集合权限'
        wx.showModal({
          title: '导入未完成',
          content: `成功 ${result.saved} 题，失败 ${result.failed} 题。\n\n${detail}`,
          showCancel: false
        })
        return
      }
      wx.showToast({ title: `新增 ${result.added} 题，更新 ${result.updated} 题`, icon: 'success' })
      setTimeout(() => wx.navigateBack(), 1000)
    } catch (e) {
      wx.hideLoading()
      const detail = (e && (e.errMsg || e.message)) || String(e)
      wx.showModal({ title: '导入失败', content: detail, showCancel: false })
    }
  }
})
