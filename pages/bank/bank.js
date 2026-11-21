const storage = require('../../utils/storage')
const theme = require('../../utils/theme')

Page({
  data: {
    isDark: false,
    themeMode: 'auto',
    groups: [],
    expandedIds: [],
    showCategoryModal: false,
    showBankModal: false,
    inputName: '',
    activeCategoryId: '',
    bankCategoryOptions: []
  },

  async onShow() {
    theme.bindPage(this)
    await this.refreshGroups()
  },

  onUnload() {
    theme.unbindPage(this)
  },

  async refreshGroups() {
    const categories = (await storage.getCustomCategories()).map(c => ({
      id: c.id,
      name: c.name,
      builtin: false
    }))

    const allBanks = await storage.getBanks()
    const groups = []
    for (const cat of categories) {
      const banks = []
      for (const b of allBanks.filter(item => item.category === cat.id)) {
        const questions = await storage.getQuestionsOfBank(b.id)
        banks.push({
          ...b,
          count: questions.length,
          dateText: this.formatDate(b.createdAt)
        })
      }
      groups.push({
        ...cat,
        banks,
        expanded: this.data.expandedIds.indexOf(cat.id) > -1,
        swiped: this.data.groups.some(g => g.id === cat.id && g.swiped)
      })
    }

    this.setData({
      groups,
      bankCategoryOptions: categories.map(c => ({ id: c.id, name: c.name }))
    })
  },

  formatDate(timestamp) {
    if (!timestamp) return ''
    const d = new Date(timestamp)
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    return `${mm}/${dd} ${hh}:${min}`
  },

  onTouchStart(e) {
    const touch = e.touches[0]
    this._startX = touch.clientX
    this._startY = touch.clientY
    this._swipeId = e.currentTarget.dataset.id
    this._swipeChanged = false
  },

  onTouchMove(e) {
    const touch = e.touches[0]
    const dx = touch.clientX - this._startX
    const dy = touch.clientY - this._startY
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 15) {
      const shouldSwipe = dx < -40
      if (shouldSwipe !== this._swiped) {
        this._swipeChanged = true
        this._swiped = shouldSwipe
        this.updateSwipeState(shouldSwipe)
      }
    }
  },

  onTouchEnd() {
    if (!this._swipeChanged) {
      const anySwiped = this.data.groups.some(g => g.swiped)
      if (anySwiped) {
        this._swipeId = null
        this.updateSwipeState(false)
      }
    }
  },

  updateSwipeState(swipe) {
    const groups = this.data.groups.map(g => ({
      ...g,
      swiped: swipe && g.id === this._swipeId
    }))
    this.setData({ groups })
  },

  toggleGroup(e) {
    const { id } = e.currentTarget.dataset
    if (this._swipeChanged) return
    const expanded = [...this.data.expandedIds]
    const idx = expanded.indexOf(id)
    if (idx > -1) expanded.splice(idx, 1)
    else expanded.push(id)
    this.setData({ expandedIds: expanded }, () => this.refreshGroups())
  },

  showCreateCategory() {
    this.setData({ showCategoryModal: true, inputName: '' })
  },

  hideCreateCategory() {
    this.setData({ showCategoryModal: false })
  },

  onNameInput(e) {
    this.setData({ inputName: e.detail.value })
  },

  async confirmCreateCategory() {
    const name = this.data.inputName.trim()
    if (!name) {
      wx.showToast({ title: '请输入分类名称', icon: 'none' })
      return
    }
    wx.showLoading({ title: '创建中...' })
    const category = await storage.createCategory(name)
    wx.hideLoading()
    if (category) {
      wx.showToast({ title: '分类创建成功', icon: 'success' })
      this.setData({
        showCategoryModal: false,
        expandedIds: this.data.expandedIds.concat(category.id)
      }, () => this.refreshGroups())
    } else {
      const err = storage.getLastCloudError && storage.getLastCloudError()
      const detail = err ? (err.errMsg || err.message || String(err)) : '云数据库写入失败'
      wx.showModal({
        title: '创建失败',
        content: detail + '\n\n请确认云数据库集合 quiz_categories 已创建，且权限允许当前用户写入。',
        showCancel: false
      })
    }
  },

  async deleteCategory(e) {
    const { id } = e.currentTarget.dataset
    const group = this.data.groups.find(g => g.id === id)
    if (group && group.banks.length > 0) {
      wx.showModal({
        title: '无法删除',
        content: '该分类下有题库，请先删除题库。',
        showCancel: false,
        confirmText: '知道了'
      })
      this.updateSwipeState(false)
      return
    }
    wx.showModal({
      title: '删除分类',
      content: '确定删除该分类吗？',
      confirmColor: '#FF4D4F',
      success: async (res) => {
        if (res.confirm) {
          const ok = await storage.deleteCategory(id)
          wx.showToast({ title: ok ? '已删除' : '删除失败', icon: ok ? 'success' : 'none' })
          this.refreshGroups()
        } else {
          this.updateSwipeState(false)
        }
      }
    })
  },

  showCreateBank(e) {
    const { id } = e.currentTarget.dataset
    this.setData({
      showBankModal: true,
      inputName: '',
      activeCategoryId: id
    })
  },

  hideCreateBank() {
    this.setData({ showBankModal: false })
  },

  selectBankCategory(e) {
    this.setData({ activeCategoryId: e.currentTarget.dataset.id })
  },

  async confirmCreateBank() {
    const name = this.data.inputName.trim()
    if (!name) {
      wx.showToast({ title: '请输入题库名称', icon: 'none' })
      return
    }
    const categoryId = this.data.activeCategoryId
    wx.showLoading({ title: '创建中...' })
    const bank = await storage.createBank(name, categoryId)
    wx.hideLoading()
    if (bank) {
      wx.showToast({ title: '题库创建成功', icon: 'success' })
      this.setData({
        showBankModal: false,
        expandedIds: this.data.expandedIds.indexOf(categoryId) > -1
          ? this.data.expandedIds
          : this.data.expandedIds.concat(categoryId)
      }, () => this.refreshGroups())
      wx.showModal({
        title: '创建成功',
        content: `题库「${name}」已创建，是否现在录入题目？`,
        confirmText: '去录题',
        cancelText: '稍后',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: `/pages/bank-import/bank-import?bankId=${bank.id}` })
          }
        }
      })
    } else {
      wx.showToast({ title: '创建失败', icon: 'none' })
    }
  },

  goToImport() {
    wx.navigateTo({ url: '/pages/bank-import/bank-import' })
  },

  async onBankTap(e) {
    const { id } = e.currentTarget.dataset
    const questions = await storage.getQuestionsOfBank(id)
    if (questions.length === 0) {
      wx.showModal({
        title: '题库为空',
        content: '该题库还没有题目，请先用「电脑录题」添加题目。',
        confirmText: '去录题',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: `/pages/bank-import/bank-import?bankId=${id}` })
          }
        }
      })
      return
    }
    wx.navigateTo({ url: `/pages/quiz/quiz?bankId=${id}&count=${questions.length}` })
  },

  onBankMore(e) {
    const { id } = e.currentTarget.dataset
    wx.showActionSheet({
      itemList: ['录入题目', '删除题库'],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.navigateTo({ url: `/pages/bank-import/bank-import?bankId=${id}` })
        } else if (res.tapIndex === 1) {
          wx.showModal({
            title: '删除题库',
            content: '确定删除该题库及其所有题目吗？',
            confirmColor: '#FF4D4F',
            success: async (r) => {
              if (r.confirm) {
                await storage.deleteBank(id)
                wx.showToast({ title: '已删除', icon: 'success' })
                this.refreshGroups()
              }
            }
          })
        }
      }
    })
  }
})
