const https = require('https')
const http = require('http')

let cloud = null

function getCloud() {
  if (!cloud) {
    cloud = require('wx-server-sdk')
    cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
  }
  return cloud
}

function loadModule(name) {
  try {
    return require(name)
  } catch (e) {
    const detail = e && e.message ? e.message : String(e)
    throw new Error('依赖 ' + name + ' 加载失败：' + detail)
  }
}

// 统一的文本 -> 题目解析（与小程序端格式一致）
function parseTextToQuestions(text, defaultType) {
  if (!text || !text.trim()) return []
  const blocks = text.trim().split(/\n\s*\n/).filter(b => b.trim())
  return blocks.map((block, index) => {
    const lines = block.split('\n').map(l => l.trim()).filter(l => l)
    let question = ''
    const options = []
    let answerLine = ''
    let explanation = ''

    lines.forEach(line => {
      if (/^答案[：:]/.test(line)) {
        answerLine = line.replace(/^答案[：:]\s*/, '')
      } else if (/^解析[：:]/.test(line)) {
        explanation = line.replace(/^解析[：:]\s*/, '')
      } else if (/^[A-Za-z][.、．)）]/.test(line)) {
        const key = line[0].toUpperCase()
        const content = line.replace(/^[A-Za-z][.、．)）]\s*/, '')
        options.push({ key, text: content })
      } else if (!question) {
        question = line
      } else {
        explanation += (explanation ? '\n' : '') + line
      }
    })

    let type = defaultType || 'single'
    if (type === 'judge' && options.length === 0) {
      options.push({ key: 'A', text: '正确' }, { key: 'B', text: '错误' })
    }

    const answer = answerLine
      ? answerLine.replace(/[，,、\s]/g, '').split('').map(c => c.toUpperCase()).filter(c => /[A-D]/.test(c))
      : []
    if (answer.length > 1) type = 'multiple'

    return {
      id: `q_${Date.now()}_${index}`,
      type,
      question: question || `题目 ${index + 1}`,
      options: options.length > 0 ? options : [
        { key: 'A', text: '正确' }, { key: 'B', text: '错误' }
      ],
      answer,
      explanation: explanation || '暂无解析'
    }
  }).filter(q => q.answer.length > 0)
}

// Word docx -> 纯文本
async function parseDocx(buffer) {
  const mammoth = loadModule('mammoth')
  const result = await mammoth.extractRawText({ buffer })
  return result.value
}

// Excel -> 纯文本（每行按列拼接）
async function parseExcel(buffer) {
  const XLSX = loadModule('xlsx')
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  let lines = []
  workbook.SheetNames.forEach(name => {
    const sheet = workbook.Sheets[name]
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
    rows.forEach(row => {
      const line = row.map(c => String(c).trim()).filter(c => c).join(' ')
      if (line) lines.push(line)
    })
  })
  return lines.join('\n')
}

// PDF -> 纯文本
async function parsePdf(buffer) {
  const pdf = loadModule('pdf-parse')
  const data = await pdf(buffer)
  return data.text
}

// 下载网络资源（支持重定向）
function fetchUrl(url, redirects) {
  redirects = redirects || 0
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('重定向次数过多'))
    const mod = url.startsWith('https://') ? https : http
    mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const next = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).href
        res.resume()
        return fetchUrl(next, redirects + 1).then(resolve, reject)
      }
      if (res.statusCode !== 200) {
        res.resume()
        return reject(new Error('HTTP ' + res.statusCode))
      }
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks)))
    }).on('error', reject)
  })
}

function normalizeLines(text) {
  return String(text || '')
    .replace(/\r/g, '')
    .split('\n')
    .map(line => line.replace(/\u3000/g, ' ').replace(/\t/g, ' ').trim())
    .filter(Boolean)
}

function getSection(line) {
  const match = line.match(/^[一二三四五六七八九十]+[、.．]\s*(选择题|单选题|多选题|判断题|填空题|简答题|问答题)/)
  if (!match) return null
  const name = match[1]
  if (/选择/.test(name)) return 'choice'
  if (/判断/.test(name)) return 'judge'
  if (/填空/.test(name)) return 'fill'
  if (/简答|问答/.test(name)) return 'essay'
  return null
}

function isQuestionStart(line) {
  return /^\d+\s*[.．、]\s*\S/.test(line) || /^\d+\s*[\u4e00-\u9fa5]/.test(line)
}

function stripQuestionNumber(line) {
  return line.replace(/^\d+\s*[.．、]?\s*/, '').trim()
}

function parseOptions(lines) {
  const text = lines.join(' ')
  const marker = /([A-D])[.．、:：]\s*/g
  const matches = []
  let found
  while ((found = marker.exec(text)) !== null) {
    matches.push({ key: found[1], start: found.index, contentStart: marker.lastIndex })
  }
  return matches.map((item, index) => {
    const end = index + 1 < matches.length ? matches[index + 1].start : text.length
    return {
      key: item.key,
      text: text.slice(item.contentStart, end).trim().replace(/\s+/g, ' ')
    }
  }).filter(option => option.text)
}

function answerLettersFrom(text) {
  const tokens = []
  const paren = /[（(]([^）)]*)[）)]/g
  let found
  while ((found = paren.exec(text)) !== null) {
    const letters = (found[1].match(/[A-Da-d]/g) || []).map(c => c.toUpperCase())
    if (letters.length) {
      tokens.push({ letters, raw: found[0] })
    }
  }
  if (tokens.length) return tokens[0]

  const answerLine = text.match(/答案[：:]\s*([A-Da-d][^\s，,。；;]*)/)
  if (answerLine) {
    const letters = (answerLine[1].match(/[A-Da-d]/g) || []).map(c => c.toUpperCase())
    if (letters.length) return { letters, raw: answerLine[0] }
  }
  return null
}

function parseChoiceBlock(block, index) {
  const first = block[0]
  const answer = answerLettersFrom(block.join(' '))
  const options = parseOptions(block.slice(1))
  if (!answer || !options.length) return null

  const question = stripQuestionNumber(first).replace(answer.raw, '').trim()
  if (!question) return null

  return {
    id: `q_${Date.now()}_${index}`,
    type: answer.letters.length > 1 ? 'multiple' : 'single',
    question,
    options,
    answer: answer.letters,
    explanation: '答案：' + answer.letters.join('、')
  }
}

function parseJudgeBlock(block, index) {
  const first = block[0]
  const text = block.join(' ')
  let raw = ''
  let answer = ''

  const paren = /[（(]([^）)]*)[）)]/g
  let found
  while ((found = paren.exec(text)) !== null) {
    const value = found[1].trim()
    if (/[√对正正确Tt]|true/i.test(value)) {
      raw = found[0]
      answer = 'A'
      break
    }
    if (/[×错错误Ff]|false/i.test(value)) {
      raw = found[0]
      answer = 'B'
      break
    }
  }

  if (!answer) {
    const answerLine = text.match(/答案[：:]\s*(正确|错误|对|错|√|×|T|F)/i)
    if (answerLine) {
      raw = answerLine[0]
      answer = /[√对正正确Tt]|true/i.test(answerLine[1]) ? 'A' : 'B'
    }
  }
  if (!answer) return null

  const question = stripQuestionNumber(first).replace(raw, '').trim()
  if (!question) return null

  return {
    id: `q_${Date.now()}_${index}`,
    type: 'judge',
    question,
    options: [{ key: 'A', text: '正确' }, { key: 'B', text: '错误' }],
    answer: [answer],
    explanation: '答案：' + (answer === 'A' ? '正确' : '错误')
  }
}

function extractBlankAnswers(block) {
  const text = block.join(' ')
  const answers = []
  const underscore = /_{2,}([^_\n]+?)_{2,}/g
  let found
  while ((found = underscore.exec(text)) !== null) {
    const value = found[1].trim().replace(/^_+|_+$/g, '').trim()
    if (value) answers.push(value)
  }
  if (answers.length) return answers

  const continuation = block.slice(1).join(' ')
  if (continuation) {
    const parts = continuation.split(/\s{2,}/).map(part => part.trim()).filter(Boolean)
    const meaningful = parts.filter(part => {
      return part.length > 1 && !/^[和及或、，。；：！？]$/.test(part) && !/^\d+$/.test(part)
    })
    if (meaningful.length) return meaningful
  }

  const spaced = /\s{2,}([^\s，。；;：:]{1,30})(?=\s{2,}|[。；;，,])/g
  while ((found = spaced.exec(text)) !== null) {
    const value = found[1].trim().replace(/^\d+\./, '')
    if (value && !/^[和及或、，。；：！？]$/.test(value)) answers.push(value)
  }
  return answers
}

function parseFillBlock(block, index) {
  const text = block.join(' ')
  const answers = extractBlankAnswers(block)
  if (!answers.length) return null

  const optionTexts = answers.slice(0, 4)
  if (optionTexts.length === 1) optionTexts.push('其他')
  const options = optionTexts.map((value, i) => ({ key: 'ABCD'[i], text: value }))
  const question = stripQuestionNumber(block[0]).replace(/_{2,}/g, '____').trim()

  return {
    id: `q_${Date.now()}_${index}`,
    type: answers.length > 1 ? 'multiple' : 'single',
    question,
    options,
    answer: options.slice(0, answers.length).map(option => option.key),
    explanation: '填空：' + answers.slice(0, 4).join('、')
  }
}

function parseEssayBlock(block, index) {
  const question = stripQuestionNumber(block[0]).trim()
  const answerText = block.slice(1).join(' ').replace(/\s+/g, ' ').trim().slice(0, 160)
  if (!question || !answerText) return null

  return {
    id: `q_${Date.now()}_${index}`,
    type: 'single',
    question,
    options: [{ key: 'A', text: answerText }, { key: 'B', text: '略' }],
    answer: ['A'],
    explanation: '参考答案：' + answerText
  }
}

function parseAdaptiveQuestions(text, defaultType) {
  const lines = normalizeLines(text)
  const questions = []
  let section = defaultType === 'judge' ? 'judge' : 'choice'
  let index = 0

  while (index < lines.length) {
    const heading = getSection(lines[index])
    if (heading) {
      section = heading
      index += 1
      continue
    }

    if (!isQuestionStart(lines[index])) {
      index += 1
      continue
    }

    const block = [lines[index]]
    index += 1
    while (index < lines.length && !getSection(lines[index]) && !isQuestionStart(lines[index])) {
      block.push(lines[index])
      index += 1
    }

    let question = null
    if (section === 'essay') {
      question = parseEssayBlock(block, questions.length) ||
        parseChoiceBlock(block, questions.length) ||
        parseJudgeBlock(block, questions.length) ||
        parseFillBlock(block, questions.length)
    } else if (section === 'judge') {
      question = parseJudgeBlock(block, questions.length) || parseChoiceBlock(block, questions.length)
    } else if (section === 'fill') {
      question = parseFillBlock(block, questions.length) ||
        parseChoiceBlock(block, questions.length) ||
        parseJudgeBlock(block, questions.length)
    } else {
      question = parseChoiceBlock(block, questions.length) ||
        parseJudgeBlock(block, questions.length) ||
        parseFillBlock(block, questions.length)
    }

    if (question) questions.push(question)
  }

  return questions
}

exports.main = async (event) => {
  if (event && event.healthCheck) {
    return { success: true, health: 'ok' }
  }

  const { type, fileID, url, text } = event

  try {
    let plainText = ''

    if (fileID) {
      // 云存储文件
      const res = await getCloud().downloadFile({ fileID })
      const buffer = res.fileContent
      const ext = (fileID.split('?')[0].split('.').pop() || '').toLowerCase()
      if (ext === 'docx') plainText = await parseDocx(buffer)
      else if (ext === 'xlsx' || ext === 'xls') plainText = await parseExcel(buffer)
      else if (ext === 'pdf') plainText = await parsePdf(buffer)
      else plainText = buffer.toString('utf8')
    } else if (url) {
      // 网络 URL：先下载
      const buffer = await fetchUrl(url)
      const clean = url.split('?')[0].toLowerCase()
      if (clean.endsWith('.docx')) plainText = await parseDocx(buffer)
      else if (clean.endsWith('.xlsx') || clean.endsWith('.xls')) plainText = await parseExcel(buffer)
      else if (clean.endsWith('.pdf')) plainText = await parsePdf(buffer)
      else if (clean.endsWith('.txt')) plainText = buffer.toString('utf8')
      else {
        // 网页：抽取正文文本
        const cheerio = loadModule('cheerio')
        const $ = cheerio.load(buffer.toString('utf8'))
        $('script').remove()
        $('style').remove()
        $('br').replaceWith('\n')
        $('p, div, li, h1, h2, h3, h4').each((i, el) => {
          $(el).append('\n')
        })
        plainText = $('body').text().replace(/\n{3,}/g, '\n\n').trim()
      }
    } else if (text) {
      plainText = text
    } else {
      return { success: false, error: '缺少导入内容' }
    }

    let questions = parseAdaptiveQuestions(plainText, type)
    if (!questions.length) questions = parseTextToQuestions(plainText, type)
    if (questions.length === 0) {
      return { success: false, error: '未解析到有效题目，请检查格式（答案需以“答案：”开头）' }
    }
    return { success: true, count: questions.length, questions }
  } catch (e) {
    return { success: false, error: (e && e.message) || String(e) }
  }
}
