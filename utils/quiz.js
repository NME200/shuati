// 答题逻辑服务
const { questions, categories } = require('../data/questions')

// 按分类获取题目
function getQuestionsByCategory(categoryId) {
  if (!categoryId || categoryId === 'all') return questions
  return questions.filter(q => q.category === categoryId)
}

// 获取分类信息
function getCategory(categoryId) {
  return categories.find(c => c.id === categoryId)
}

// 获取所有分类
function getCategories() {
  return categories
}

// 随机打乱数组
function shuffle(arr) {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

// 生成试卷
function generateQuiz(categoryId, count = 10) {
  let pool = getQuestionsByCategory(categoryId)
  pool = shuffle(pool)
  return pool.slice(0, Math.min(count, pool.length))
}

// 判断答案是否正确
function checkAnswer(question, userAnswer) {
  if (!userAnswer || userAnswer.length === 0) return false
  const correct = [...question.answer].sort().join(',')
  const user = [...userAnswer].sort().join(',')
  return correct === user
}

// 计算成绩
function calculateResult(questions, answers) {
  let correct = 0
  const wrongList = []
  const details = []

  questions.forEach((q, index) => {
    const userAnswer = answers[q.id] || []
    const isCorrect = checkAnswer(q, userAnswer)
    if (isCorrect) {
      correct++
    } else {
      wrongList.push({
        id: q.id,
        question: q.question,
        userAnswer,
        correctAnswer: q.answer,
        explanation: q.explanation
      })
    }
    details.push({
      id: q.id,
      question: q.question,
      userAnswer,
      correctAnswer: q.answer,
      isCorrect,
      explanation: q.explanation
    })
  })

  const total = questions.length
  return {
    total,
    correct,
    wrong: total - correct,
    score: total > 0 ? Math.round(correct / total * 100) : 0,
    wrongList,
    details
  }
}

// 获取题目类型名称
function getTypeName(type) {
  const map = { single: '单选题', multiple: '多选题', judge: '判断题' }
  return map[type] || '未知题型'
}

module.exports = {
  getQuestionsByCategory,
  getCategory,
  getCategories,
  shuffle,
  generateQuiz,
  checkAnswer,
  calculateResult,
  getTypeName
}
