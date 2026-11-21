// components/theme-toggle/theme-toggle.js
const theme = require('../../utils/theme')

Component({
  options: {
    styleIsolation: 'apply-shared'
  },

  properties: {
    // 展示样式：'feature' 宫格样式 | 'inline' 行内开关样式
    variant: {
      type: String,
      value: 'feature'
    }
  },

  data: {
    isDark: false,
    themeMode: 'auto'
  },

  lifetimes: {
    attached() {
      const state = theme.getTheme()
      this.setData({ isDark: state.isDark, themeMode: state.mode })
      this._unsubscribe = theme.subscribe(next => {
        this.setData({ isDark: next.isDark, themeMode: next.mode })
      })
    },
    detached() {
      if (this._unsubscribe) {
        this._unsubscribe()
        this._unsubscribe = null
      }
    }
  },

  methods: {
    onToggle() {
      const before = theme.getTheme()
      theme.toggle()
      const after = theme.getTheme()
      wx.showToast({
        title: after.isDark ? '已开启夜间模式' : '已切换日间模式',
        icon: 'none',
        duration: 1200
      })
      this.triggerEvent('change', { ...after, previous: before })
    }
  }
})
