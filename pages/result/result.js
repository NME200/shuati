const theme = require('../../utils/theme')

Page({
  data: {
    isDark: false,
    themeMode: 'auto',
    score: 0,
    correct: 0,
    total: 0,
    wrong: 0,
    durationText: '00:00',
    grade: '',
    gradeText: '',
    details: [],
    displayDetails: [],
    showWrongOnly: false,
    category: 'all'
  },

  allDetails: [],

  onLoad(options) {
    theme.bindPage(this)
    const result = getApp().globalData.lastResult
    const score = Number(options.score) || 0
    const correct = Number(options.correct) || 0
    const total = Number(options.total) || 0
    const duration = Number(options.duration) || 0
    const category = options.category || 'all'

    const gradeInfo = this.getGrade(score)
    const mm = String(Math.floor(duration / 60)).padStart(2, '0')
    const ss = String(duration % 60).padStart(2, '0')

    const details = result ? result.details.map(d => ({
      ...d,
      userAnswerText: d.userAnswer.length > 0 ? d.userAnswer.join('、') : '未作答',
      correctAnswerText: d.correctAnswer.join('、')
    })) : []
    this.allDetails = details

    this.setData({
      score,
      correct,
      total,
      wrong: total - correct,
      durationText: `${mm}:${ss}`,
      grade: gradeInfo.grade,
      gradeText: gradeInfo.text,
      category,
      details,
      displayDetails: details
    })
  },

  onShow() {
    theme.bindPage(this)
  },

  onUnload() {
    theme.unbindPage(this)
  },

  getGrade(score) {
    if (score >= 90) return { grade: 'A', text: '优秀！继续保持 🎉' }
    if (score >= 80) return { grade: 'B', text: '良好，再接再厉！' }
    if (score >= 60) return { grade: 'C', text: '及格，还需要努力' }
    return { grade: 'D', text: '加油，多练习几遍！' }
  },

  toggleFilter() {
    const showWrongOnly = !this.data.showWrongOnly
    this.setData({
      showWrongOnly,
      displayDetails: showWrongOnly ? this.allDetails.filter(d => !d.isCorrect) : this.allDetails
    })
  },

  retryQuiz() {
    const category = this.data.category || 'all'
    if (category.indexOf('bank_') === 0) {
      wx.redirectTo({ url: `/pages/quiz/quiz?bankId=${category}&count=${this.data.total}` })
    } else {
      wx.redirectTo({ url: `/pages/quiz/quiz?category=${category}&count=${this.data.total}` })
    }
  },

  goHome() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  goStats() {
    wx.switchTab({ url: '/pages/stats/stats' })
  }
})
