// app.js
const theme = require('./utils/theme')
const auth = require('./utils/auth')

const CLOUD_ENV = 'cloud1-d0gzpuodv51a600cc'

App({
  globalData: {
    lastResult: null,
    cloudReady: false,
    cloudEnv: CLOUD_ENV,
    theme: theme,
    auth: auth
  },

  onLaunch() {
    // 主题初始化需尽早执行，避免首屏闪白
    theme.init()
    this.initCloud()
  },

  initCloud() {
    if (!wx.cloud) {
      console.error('[cloud] 当前微信版本不支持云开发')
      return false
    }

    try {
      wx.cloud.init({
        env: CLOUD_ENV,
        traceUser: true
      })
      this.globalData.cloudReady = true
      console.log('[cloud] init ok, env =', CLOUD_ENV)

      // 尽早获取可信用户身份，后续数据层按 openid 隔离
      auth.init()
      return true
    } catch (e) {
      console.error('[cloud] init FAILED:', e)
      this.globalData.cloudReady = false
      return false
    }
  }
})
