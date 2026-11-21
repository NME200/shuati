const quizService = require('../../utils/quiz')
const storage = require('../../utils/storage')
const theme = require('../../utils/theme')

Page({
  data: {
    isDark: false,
    themeMode: 'auto',
    questions: [],
    answers: {},
    currentIndex: 0,
    currentQuestion: null,
    answeredCount: 0,
    showCard: false,
    cardScrollInto: '',
    category: 'all',
    categoryName: '综合练习',
    timeText: '00:00',
    startTime: 0
  },

  timer: null,

  async onLoad(options) {
    theme.bindPage(this)
    const count = Number(options.count) || 0
    let questions
    let categoryName

    if (options.bankId) {
      const banks = await storage.getBanks()
      const bank = banks.find(b => b.id === options.bankId)
      const bankQuestions = await storage.getQuestionsOfBank(options.bankId)
      questions = quizService.shuffle(bankQuestions)
      console.log('[quiz] bankId=' + options.bankId + ' countParam=' + count + ' dbQuestions=' + bankQuestions.length + ' useQuestions=' + questions.length)
      categoryName = (bank ? bank.name : '自定义题库') + '（' + questions.length + '题）'
      this.setData({ bankId: options.bankId })
    } else {
      questions = []
      categoryName = '综合练习'
    }

    if (questions.length === 0) {
      wx.showToast({ title: '题库暂无题目', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 800)
      return
    }

    this.setData({
      questions,
      categoryName,
      currentQuestion: this.buildQuestion(questions[0], {}),
      startTime: Date.now()
    })

    this.startTimer()
  },

  onShow() {
    theme.bindPage(this)
  },

  onUnload() {
    theme.unbindPage(this)
    if (this.timer) clearInterval(this.timer)
  },

  buildQuestion(question, answers) {
    if (!question) return null
    const selected = answers[question.id] || []
    return {
      ...question,
      options: question.options.map(opt => ({
        ...opt,
        selected: selected.indexOf(opt.key) > -1
      }))
    }
  },

  startTimer() {
    this.timer = setInterval(() => {
      const seconds = Math.floor((Date.now() - this.data.startTime) / 1000)
      const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
      const ss = String(seconds % 60).padStart(2, '0')
      this.setData({ timeText: `${mm}:${ss}` })
    }, 1000)
  },

  toggleOption(e) {
    const { key } = e.currentTarget.dataset
    const question = this.data.currentQuestion
    if (!question) return

    const answers = { ...this.data.answers }
    const current = answers[question.id] || []

    if (question.type === 'multiple') {
      if (current.indexOf(key) > -1) {
        answers[question.id] = current.filter(k => k !== key)
      } else {
        answers[question.id] = [...current, key]
      }
    } else {
      answers[question.id] = [key]
    }

    this.setData({
      answers,
      currentQuestion: this.buildQuestion(question, answers),
      answeredCount: Object.values(answers).filter(a => a.length > 0).length
    })
  },

  prevQuestion() {
    if (this.data.currentIndex > 0) {
      const index = this.data.currentIndex - 1
      this.setData({
        currentIndex: index,
        currentQuestion: this.buildQuestion(this.data.questions[index], this.data.answers)
      })
    }
  },

  nextQuestion() {
    if (this.data.currentIndex < this.data.questions.length - 1) {
      const index = this.data.currentIndex + 1
      this.setData({
        currentIndex: index,
        currentQuestion: this.buildQuestion(this.data.questions[index], this.data.answers)
      })
    }
  },

  toggleCard() {
    const showCard = !this.data.showCard
    this.setData({
      showCard,
      cardScrollInto: showCard ? `card-q-${this.data.currentIndex}` : ''
    })
  },

  jumpToQuestion(e) {
    const { index } = e.currentTarget.dataset
    this.setData({
      currentIndex: index,
      currentQuestion: this.buildQuestion(this.data.questions[index], this.data.answers),
      showCard: false,
      cardScrollInto: ''
    })
  },

  submitQuiz() {
    const unanswered = this.data.questions.length - this.data.answeredCount
    const doSubmit = async () => {
      if (this.timer) clearInterval(this.timer)
      const result = quizService.calculateResult(this.data.questions, this.data.answers)
      const duration = Math.floor((Date.now() - this.data.startTime) / 1000)
      const category = this.data.bankId ? this.data.bankId : (this.data.category || 'all')

      getApp().globalData.lastResult = result

      wx.showLoading({ title: '提交中...' })
      await storage.saveRecord({
        category,
        total: result.total,
        correct: result.correct,
        score: result.score,
        duration,
        wrongList: result.wrongList
      })
      wx.hideLoading()

      wx.redirectTo({
        url: `/pages/result/result?score=${result.score}&correct=${result.correct}&total=${result.total}&duration=${duration}&category=${encodeURIComponent(category)}`
      })
    }

    if (unanswered > 0) {
      wx.showModal({
        title: '还有题目未作答',
        content: `你有 ${unanswered} 道题未作答，确定要交卷吗？`,
        confirmText: '确定交卷',
        cancelText: '继续答题',
        success: (res) => { if (res.confirm) doSubmit() }
      })
    } else {
      doSubmit()
    }
  }
})
