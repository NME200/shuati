const storage = require('../../utils/storage')
const theme = require('../../utils/theme')

Page({
  data: {
    isDark: false,
    themeMode: 'auto',
    categoryTabs: [],
    activeCategory: '_all',
    banks: []
  },

  async onShow() {
    theme.bindPage(this)
    await this.initTabs()
    await this.refreshBanks()
  },

  onUnload() {
    theme.unbindPage(this)
  },

  async initTabs() {
    const categories = await storage.getCustomCategories()
    const tabs = [
      { id: '_all', name: '全部' },
      ...categories.map(c => ({ id: c.id, name: c.name }))
    ]
    this.setData({ categoryTabs: tabs })
  },

  async switchCategory(e) {
    const { id } = e.currentTarget.dataset
    this.setData({ activeCategory: id }, () => this.refreshBanks())
  },

  async refreshBanks() {
    const allBanks = await storage.getBanks()
    const allRecords = await storage.getRecords()
    const categories = await storage.getCustomCategories()
    const categoryMap = {}
    categories.forEach(c => { categoryMap[c.id] = c })
    const active = this.data.activeCategory

    const filtered = active === '_all'
      ? allBanks
      : allBanks.filter(b => b.category === active)

    const banks = []
    for (const b of filtered) {
      banks.push(await this.buildBank(b, allRecords, categoryMap))
    }
    this.setData({ banks })
  },

  async buildBank(b, allRecords, categoryMap) {
    const category = categoryMap[b.category]
    const questions = await storage.getQuestionsOfBank(b.id)
    const questionCount = questions.length
    const recs = allRecords.filter(r => r.category === b.id)
    const doneCount = recs.reduce((sum, r) => sum + r.total, 0)
    const wrongCount = recs.reduce((sum, r) => sum + r.wrong, 0)
    const lastRec = recs[0]
    const progress = questionCount > 0 ? Math.min(100, Math.round(doneCount / questionCount * 100)) : 0
    const correctRate = doneCount > 0 ? Math.round((doneCount - wrongCount) / doneCount * 100) : 100

    return {
      id: b.id,
      title: b.name,
      categoryName: category ? category.name : '题库',
      questionCount,
      doneCount,
      wrongCount,
      dateText: lastRec ? this.formatShortDate(lastRec.date) : '暂无记录',
      correctWidth: Math.round(progress * correctRate / 100),
      wrongWidth: Math.round(progress * (100 - correctRate) / 100)
    }
  },

  formatShortDate(dateStr) {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${mm}-${dd}`
  },

  async onBankTap(e) {
    const { id } = e.currentTarget.dataset
    const questions = await storage.getQuestionsOfBank(id)
    if (questions.length === 0) {
      wx.showToast({ title: '该题库暂无题目', icon: 'none' })
      return
    }
    wx.navigateTo({ url: `/pages/quiz/quiz?bankId=${id}&count=${questions.length}` })
  }
})
