const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 返回微信注入的可信身份，不返回任何敏感信息
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  return {
    openid: wxContext.OPENID || '',
    unionid: wxContext.UNIONID || ''
  }
}
