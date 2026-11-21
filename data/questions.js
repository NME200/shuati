// 题库数据
const categories = [
  { id: 'frontend', name: '前端开发', icon: '🎨', desc: 'HTML/CSS/JavaScript/框架', color: '#4A90E2' },
  { id: 'backend', name: '后端开发', icon: '⚙️', desc: 'Java/Python/Node/数据库', color: '#52C41A' },
  { id: 'foundation', name: '计算机基础', icon: '💻', desc: '操作系统/网络/组成原理', color: '#FA8C16' },
  { id: 'algorithm', name: '算法与数据结构', icon: '🧮', desc: '链表/树/排序/动态规划', color: '#722ED1' }
]

const questions = [
  // ========== 前端开发 ==========
  {
    id: 'f001', category: 'frontend', type: 'single',
    question: '以下哪个不是 JavaScript 的基本数据类型？',
    options: [
      { key: 'A', text: 'String' },
      { key: 'B', text: 'Number' },
      { key: 'C', text: 'Object' },
      { key: 'D', text: 'Boolean' }
    ],
    answer: ['C'],
    explanation: 'JavaScript 基本数据类型包括 String、Number、Boolean、Undefined、Null、Symbol、BigInt。Object 属于引用类型。'
  },
  {
    id: 'f002', category: 'frontend', type: 'single',
    question: 'CSS 中哪个属性用于设置元素的最小宽度？',
    options: [
      { key: 'A', text: 'width' },
      { key: 'B', text: 'min-width' },
      { key: 'C', text: 'max-width' },
      { key: 'D', text: 'auto-width' }
    ],
    answer: ['B'],
    explanation: 'min-width 属性用于设置元素的最小宽度，元素宽度不会小于该值。'
  },
  {
    id: 'f003', category: 'frontend', type: 'multiple',
    question: '以下哪些是 HTML5 的新特性？（多选）',
    options: [
      { key: 'A', text: 'Canvas 画布' },
      { key: 'B', text: 'LocalStorage' },
      { key: 'C', text: 'table 标签' },
      { key: 'D', text: 'WebSocket' }
    ],
    answer: ['A', 'B', 'D'],
    explanation: 'Canvas、LocalStorage、WebSocket 都是 HTML5 新增特性，table 标签在 HTML4 中已存在。'
  },
  {
    id: 'f004', category: 'frontend', type: 'judge',
    question: '在 JavaScript 中，`null == undefined` 的结果为 true。',
    options: [
      { key: 'A', text: '正确' },
      { key: 'B', text: '错误' }
    ],
    answer: ['A'],
    explanation: '使用宽松相等 == 比较时，null 和 undefined 会被认为相等，结果为 true。但使用严格相等 === 时结果为 false。'
  },
  {
    id: 'f005', category: 'frontend', type: 'single',
    question: 'Vue.js 中用于计算属性的选项是？',
    options: [
      { key: 'A', text: 'data' },
      { key: 'B', text: 'methods' },
      { key: 'C', text: 'computed' },
      { key: 'D', text: 'watch' }
    ],
    answer: ['C'],
    explanation: 'computed 用于定义计算属性，会基于依赖进行缓存，只有依赖变化才会重新计算。'
  },
  {
    id: 'f006', category: 'frontend', type: 'single',
    question: 'React 中用于管理组件状态的是哪个 Hook？',
    options: [
      { key: 'A', text: 'useEffect' },
      { key: 'B', text: 'useState' },
      { key: 'C', text: 'useContext' },
      { key: 'D', text: 'useMemo' }
    ],
    answer: ['B'],
    explanation: 'useState 用于在函数组件中添加状态管理。'
  },

  // ========== 后端开发 ==========
  {
    id: 'b001', category: 'backend', type: 'single',
    question: 'SQL 中用于查询数据的语句是？',
    options: [
      { key: 'A', text: 'INSERT' },
      { key: 'B', text: 'UPDATE' },
      { key: 'C', text: 'SELECT' },
      { key: 'D', text: 'DELETE' }
    ],
    answer: ['C'],
    explanation: 'SELECT 语句用于从数据库中查询数据。'
  },
  {
    id: 'b002', category: 'backend', type: 'multiple',
    question: '以下哪些是关系型数据库？（多选）',
    options: [
      { key: 'A', text: 'MySQL' },
      { key: 'B', text: 'MongoDB' },
      { key: 'C', text: 'PostgreSQL' },
      { key: 'D', text: 'Redis' }
    ],
    answer: ['A', 'C'],
    explanation: 'MySQL 和 PostgreSQL 是关系型数据库，MongoDB 是文档型数据库，Redis 是键值存储。'
  },
  {
    id: 'b003', category: 'backend', type: 'judge',
    question: 'HTTP 状态码 404 表示服务器内部错误。',
    options: [
      { key: 'A', text: '正确' },
      { key: 'B', text: '错误' }
    ],
    answer: ['B'],
    explanation: '404 表示请求的资源不存在。服务器内部错误是 500。'
  },
  {
    id: 'b004', category: 'backend', type: 'single',
    question: '在 Java 中，以下哪个关键字用于定义常量？',
    options: [
      { key: 'A', text: 'static' },
      { key: 'B', text: 'final' },
      { key: 'C', text: 'const' },
      { key: 'D', text: 'public' }
    ],
    answer: ['B'],
    explanation: 'Java 中使用 final 关键字定义常量，表示变量的值不能被修改。'
  },
  {
    id: 'b005', category: 'backend', type: 'single',
    question: 'Python 中列表和元组的主要区别是？',
    options: [
      { key: 'A', text: '列表有序，元组无序' },
      { key: 'B', text: '列表可变，元组不可变' },
      { key: 'C', text: '列表可迭代，元组不可迭代' },
      { key: 'D', text: '没有区别' }
    ],
    answer: ['B'],
    explanation: '列表（list）是可变的，可以修改元素；元组（tuple）是不可变的，创建后不能修改。'
  },

  // ========== 计算机基础 ==========
  {
    id: 'c001', category: 'foundation', type: 'single',
    question: '计算机中 1GB 等于多少 MB？',
    options: [
      { key: 'A', text: '1000' },
      { key: 'B', text: '1024' },
      { key: 'C', text: '1048' },
      { key: 'D', text: '2048' }
    ],
    answer: ['B'],
    explanation: '计算机中采用二进制，1GB = 1024MB，1MB = 1024KB。'
  },
  {
    id: 'c002', category: 'foundation', type: 'single',
    question: 'OSI 七层模型中，负责端到端通信的是哪一层？',
    options: [
      { key: 'A', text: '物理层' },
      { key: 'B', text: '数据链路层' },
      { key: 'C', text: '网络层' },
      { key: 'D', text: '传输层' }
    ],
    answer: ['D'],
    explanation: '传输层负责端到端的通信，主要协议有 TCP 和 UDP。'
  },
  {
    id: 'c003', category: 'foundation', type: 'multiple',
    question: '以下哪些是操作系统？（多选）',
    options: [
      { key: 'A', text: 'Windows' },
      { key: 'B', text: 'Linux' },
      { key: 'C', text: 'Chrome' },
      { key: 'D', text: 'macOS' }
    ],
    answer: ['A', 'B', 'D'],
    explanation: 'Windows、Linux、macOS 都是操作系统，Chrome 是浏览器。'
  },
  {
    id: 'c004', category: 'foundation', type: 'judge',
    question: 'CPU 的主要功能是执行指令和处理数据。',
    options: [
      { key: 'A', text: '正确' },
      { key: 'B', text: '错误' }
    ],
    answer: ['A'],
    explanation: 'CPU（中央处理器）是计算机的核心部件，主要负责执行指令和处理数据。'
  },
  {
    id: 'c005', category: 'foundation', type: 'single',
    question: 'IP 地址 IPv4 由多少位二进制组成？',
    options: [
      { key: 'A', text: '16 位' },
      { key: 'B', text: '32 位' },
      { key: 'C', text: '64 位' },
      { key: 'D', text: '128 位' }
    ],
    answer: ['B'],
    explanation: 'IPv4 地址由 32 位二进制组成，通常表示为点分十进制形式。IPv6 是 128 位。'
  },

  // ========== 算法与数据结构 ==========
  {
    id: 'a001', category: 'algorithm', type: 'single',
    question: '栈的特点是？',
    options: [
      { key: 'A', text: '先进先出' },
      { key: 'B', text: '先进后出' },
      { key: 'C', text: '随机存取' },
      { key: 'D', text: '有序排列' }
    ],
    answer: ['B'],
    explanation: '栈是一种后进先出（LIFO）的数据结构，也可以说是先进后出。'
  },
  {
    id: 'a002', category: 'algorithm', type: 'single',
    question: '二分查找的时间复杂度是？',
    options: [
      { key: 'A', text: 'O(n)' },
      { key: 'B', text: 'O(log n)' },
      { key: 'C', text: 'O(n²)' },
      { key: 'D', text: 'O(1)' }
    ],
    answer: ['B'],
    explanation: '二分查找每次将搜索范围缩小一半，时间复杂度为 O(log n)。'
  },
  {
    id: 'a003', category: 'algorithm', type: 'multiple',
    question: '以下哪些是稳定的排序算法？（多选）',
    options: [
      { key: 'A', text: '冒泡排序' },
      { key: 'B', text: '快速排序' },
      { key: 'C', text: '归并排序' },
      { key: 'D', text: '插入排序' }
    ],
    answer: ['A', 'C', 'D'],
    explanation: '冒泡排序、归并排序、插入排序是稳定排序；快速排序、堆排序、选择排序是不稳定排序。'
  },
  {
    id: 'a004', category: 'algorithm', type: 'judge',
    question: '二叉树的每个节点最多有两个子节点。',
    options: [
      { key: 'A', text: '正确' },
      { key: 'B', text: '错误' }
    ],
    answer: ['A'],
    explanation: '二叉树的定义是每个节点最多有两个子节点，分别称为左子节点和右子节点。'
  },
  {
    id: 'a005', category: 'algorithm', type: 'single',
    question: '哈希表的平均查找时间复杂度是？',
    options: [
      { key: 'A', text: 'O(1)' },
      { key: 'B', text: 'O(log n)' },
      { key: 'C', text: 'O(n)' },
      { key: 'D', text: 'O(n²)' }
    ],
    answer: ['A'],
    explanation: '理想情况下哈希表的平均查找时间复杂度是 O(1)，最坏情况下可能退化为 O(n)。'
  }
]

module.exports = { categories, questions }
