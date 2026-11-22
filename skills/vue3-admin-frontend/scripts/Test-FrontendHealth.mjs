#!/usr/bin/env node
// 前端健康体检（Test-FrontendHealth）
//
// 只做三条检查，三条都是**纯静态扫描**——不启动 dev server、不跑 vue-tsc、不装依赖：
//
//   ① columns-array    useTable 的 columns 写成了数组字面量（骨架要求是函数）
//   ② i18n-missing    语言包里有这个 key，但 typings 里的 I18n.Schema 没有
//   ③ prop-unused     defineProps 声明了某个 prop，但全仓没有任何地方给它传值
//
// 为什么值得单独做一个脚本，而不是写进技能正文让人「记得检查」：
// 这三条的共同点是 **说了会检查、人肉检查一定会漏**。尤其 ②，语言包常见 8 套、
// key 上百个，靠眼睛对是自欺欺人；而且漏掉的后果不是报错，是界面安静地显示原始 key。
//
// 为什么不直接用 vue-tsc：
// ② 在 vue-tsc 里表现为「某个页面用到该 key 的地方报属性不存在」——它报的是**用例**，
// 不是**缺失的声明**。一个 key 加了但暂时没人用，vue-tsc 一句话都不说，埋到下次。
// 这里反过来：以语言包为基准，逐个问类型表「你有吗」。
//
// 判定全部是**名字级静态分析**，所以有三类盲区（都写在 --help 与 README 里，不藏）：
//   · 通过 `v-bind="obj"` / `{...props}` 展开传的 prop，看不见 → 只要该组件出现过展开，
//     它的 prop 一律判为「无法判定」而不是「没人传」（宁可少报，不可错报）
//   · 动态拼接的 i18n key（`$t('a.' + x)`）不参与比对
//   · 从外部包 import 的 prop 类型（`defineProps<import('x').P>()`）不解析
//
// 用法：node Test-FrontendHealth.mjs [项目根] [--only=columns,i18n,props] [--strict] [--json] [--max=N] [--exclude=dir] [--verbose]
// 退出码：0 通过 / 1 有问题 / 2 跑不起来（路径不对、没有 .vue 文件）

import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, resolve, relative, extname, basename, dirname } from 'node:path'

const ALL_CHECKS = ['columns', 'i18n', 'props']

// ---------------------------------------------------------------- 命令行
const opts = { root: null, only: null, strict: false, json: false, max: 20, exclude: [], verbose: false }

function usage() {
  return `
前端健康体检 · 三条纯静态检查（columns / i18n / props）

用法
  node Test-FrontendHealth.mjs [项目根] [选项]

  [项目根]              默认当前目录；含 src/ 的 Vue 3 后台项目

选项
  --only=columns,i18n,props   只跑指定检查（默认全部）
  --strict                    警告也算不通过（退出码 1）
  --json                      输出机器可读 JSON
  --max=N                     每类问题最多列 N 条，0 = 全列（默认 20）
  --exclude=dir1,dir2         跳过相对路径含这些片段的文件
                              （注意：连「使用点」一起排除，会让组件看起来没人用）
  --verbose                   额外打印「无法判定 / 已跳过」的条目
  -h, --help                  本帮助

退出码
  0  通过（无错误；--strict 下也无警告）
  1  发现问题
  2  跑不起来（路径不存在、没扫到 .vue 文件、参数错误）

三条检查各查什么
  columns  useTable({ columns: [...] }) 写了数组字面量。骨架要求 () => [...]，
           否则列不会随状态更新（列表照样出得来，所以人肉很难发现）
  i18n     以语言包为基准，比对 typings 里的 I18n.Schema：
           语言包有、类型没有   → error（vue-tsc 会在用到该 key 的地方报错）
           类型有、语言包没有   → warn （运行时会显示原始 key 字符串）
           某套语言缺某个 key   → warn （该语言下界面显示 key 原文）
  props    defineProps 声明的 prop 全仓无人传值 → warn（死 prop）
           组件本身全仓没人用 → warn（多半是删页面时漏删的组件）

已知盲区（不修，只声明）
  · v-bind="obj" / {...props} 展开传参：看不见 → 该组件的 prop 判为「无法判定」
  · 动态拼接的 i18n key（$t('a.' + x)）不参与比对
  · defineProps<Pick<...>> / <Omit<...>> / 外部包类型：不解析，标为「无法判定」
  · 名字级匹配：同名组件（不同目录）会互相认成对方

专用逃逸口
  在报出问题的那一行（或上一行）加注释 frontend-health-ignore，该条不再报。
`.trimStart()
}

function die(msg) {
  process.stderr.write(`✗ ${msg}\n`)
  process.exit(2)
}

const argv = process.argv.slice(2)
for (const a of argv) {
  if (a === '-h' || a === '--help') { process.stdout.write(usage()); process.exit(0) }
  else if (a === '--strict') opts.strict = true
  else if (a === '--json') opts.json = true
  else if (a === '--verbose') opts.verbose = true
  else if (a.startsWith('--only=')) {
    const list = a.slice(7).split(',').map((s) => s.trim()).filter(Boolean)
    const bad = list.filter((x) => !ALL_CHECKS.includes(x))
    if (bad.length) die(`未知检查项：${bad.join(', ')}（可选 ${ALL_CHECKS.join(' / ')}）`)
    opts.only = list
  } else if (a.startsWith('--max=')) {
    const n = Number(a.slice(6))
    if (!Number.isFinite(n) || n < 0) die('--max 需要一个 ≥0 的数字')
    opts.max = n
  } else if (a.startsWith('--exclude=')) {
    opts.exclude = a.slice(10).split(',').map((s) => s.trim()).filter(Boolean)
  } else if (a.startsWith('-')) {
    die(`未知选项 ${a}（--help 看全部）`)
  } else if (!opts.root) {
    opts.root = a
  } else {
    die('只接受一个项目根目录')
  }
}

const ROOT = resolve(opts.root ?? process.cwd())
if (!existsSync(ROOT)) die(`路径不存在：${ROOT}`)

const enabled = new Set(opts.only ?? ALL_CHECKS)
const cap = opts.max === 0 ? Infinity : opts.max

// ---------------------------------------------------------------- 基础工具

const CODE_EXT = new Set(['.vue', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])
const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'build', 'out', '.output', '.nuxt', '.next', '.turbo',
  '.cache', 'coverage', 'storybook-static', 'target', '.pnpm-store', '.yarn',
])

const rel = (p) => relative(ROOT, p).split('\\').join('/')

function walk(dir, acc) {
  let entries
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return acc }
  for (const e of entries) {
    const p = join(dir, e.name)
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name) || e.name.startsWith('.')) continue
      walk(p, acc)
    } else if (e.isFile() && CODE_EXT.has(extname(e.name).toLowerCase())) {
      acc.push(p)
    }
  }
  return acc
}

const excluded = (file) => {
  const r = rel(file)
  return opts.exclude.some((frag) => r.includes(frag))
}

function readSource(file) {
  try {
    return readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
  } catch {
    return ''
  }
}

// 预先把行起点算出来，offset → 行列只做一次二分
function makeLineIndex(src) {
  const starts = [0]
  for (let i = 0; i < src.length; i++) if (src.charCodeAt(i) === 10) starts.push(i + 1)
  return (offset) => {
    let lo = 0, hi = starts.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (starts[mid] <= offset) lo = mid
      else hi = mid - 1
    }
    return { line: lo + 1, column: offset - starts[lo] + 1 }
  }
}

// ---------------------------------------------------------------- 遮罩
// 把注释、字符串、模板字面量的**内容**涂成空格（保留长度与换行）。
// 这样后面所有括号匹配、正则匹配都能在「纯结构」上做，不会被字符串里的括号带偏，
// 而 offset / 行号仍然和原文一一对应。
// 模板字面量里的 ${...} 是代码，保留原样。

const REGEX_PREV = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '~', '^', '<', '>'])
const REGEX_KEYWORDS = new Set(['return', 'typeof', 'case', 'in', 'of', 'delete', 'void', 'instanceof', 'new', 'yield', 'await', 'do', 'else'])

function isRegexStart(src, i) {
  let k = i - 1
  while (k >= 0 && /\s/.test(src[k])) k--
  if (k < 0) return true
  const prev = src[k]
  if (prev === '<') return false            // `</div>` 的 `<`
  if (REGEX_PREV.has(prev)) return true
  if (/[\w$]/.test(prev)) {
    let w = k
    while (w >= 0 && /[\w$]/.test(src[w])) w--
    return REGEX_KEYWORDS.has(src.slice(w + 1, k + 1))
  }
  return false
}

function maskSource(src) {
  const out = src.split('')
  const n = src.length
  const blank = (a, b) => {
    for (let k = Math.max(0, a); k < Math.min(b, n); k++) {
      const ch = src[k]
      if (ch !== '\n' && ch !== '\r') out[k] = ' '
    }
  }

  let i = 0
  while (i < n) {
    const c = src[i]

    if (c === '/' && src[i + 1] === '/') {
      let j = src.indexOf('\n', i)
      if (j < 0) j = n
      blank(i, j); i = j; continue
    }

    if (c === '/' && src[i + 1] === '*') {
      let j = src.indexOf('*/', i + 2)
      j = j < 0 ? n : j + 2
      blank(i, j); i = j; continue
    }

    if (c === '"' || c === "'") {
      let j = i + 1
      while (j < n) {
        const d = src[j]
        if (d === '\\') { j += 2; continue }
        if (d === c) { j++; break }
        if (d === '\n') break            // 未闭合（单行字符串），别吞掉后面整段
        j++
      }
      blank(i + 1, j - 1); i = j; continue
    }

    if (c === '`') {
      let j = i + 1
      while (j < n) {
        const d = src[j]
        if (d === '\\') { blank(j, j + 2); j += 2; continue }
        if (d === '`') { j++; break }
        if (d === '$' && src[j + 1] === '{') {
          // ${ } 里面是代码：保留，但要正确跳过其中的字符串与嵌套花括号
          let depth = 1
          j += 2
          while (j < n && depth > 0) {
            const e = src[j]
            if (e === '"' || e === "'") {
              let k = j + 1
              while (k < n) {
                if (src[k] === '\\') { k += 2; continue }
                if (src[k] === e || src[k] === '\n') break
                k++
              }
              j = k + 1; continue
            }
            if (e === '{') depth++
            else if (e === '}') depth--
            j++
          }
          continue
        }
        blank(j, j + 1); j++
      }
      i = j; continue
    }

    if (c === '/' && isRegexStart(src, i)) {
      let j = i + 1, closed = false
      while (j < n) {
        const d = src[j]
        if (d === '\\') { j += 2; continue }
        if (d === '\n') break
        if (d === '/') { closed = true; j++; break }
        j++
      }
      if (closed) { blank(i + 1, j - 1); i = j; continue }
    }

    i++
  }
  return out.join('')
}

// ---------------------------------------------------------------- 括号匹配

const PAIRS = { '(': ')', '[': ']', '{': '}' }

// 返回与 open 处括号配对的闭括号下标；配不上返回 -1（宁可放弃，不猜）
function matchBracket(text, open) {
  if (!PAIRS[text[open]]) return -1
  const stack = []
  for (let i = open; i < text.length; i++) {
    const c = text[i]
    if (PAIRS[c]) stack.push(PAIRS[c])
    else if (c === ')' || c === ']' || c === '}') {
      if (!stack.length) return -1
      if (stack[stack.length - 1] !== c) return -1    // 结构性错乱，直接放弃
      stack.pop()
      if (!stack.length) return i
    }
  }
  return -1
}

// 尖括号（泛型）匹配：`>` 前面是 `=` 的是箭头函数的箭头，不算闭合
function matchAngle(text, open) {
  let depth = 0
  for (let i = open; i < text.length; i++) {
    const c = text[i]
    if (c === '<') depth++
    else if (c === '>') {
      let k = i - 1
      while (k >= 0 && /\s/.test(text[k])) k--
      if (text[k] === '=') continue
      depth--
      if (depth === 0) return i
    } else if (depth === 0 && (c === ';' || c === '\n')) {
      // 泛型还没开始就断了，说明这不是泛型
      return -1
    }
  }
  return -1
}

// ---------------------------------------------------------------- 对象结构 → 路径集
// 一个极小的「对象字面量 / interface 成员」走查器：
// 只需要回答两个问题——**有哪些成员路径**、**哪些层级是动态的（索引签名）**。
// 不做完整 TS 解析，遇到看不懂的形态就少报一条，绝不猜。

function tokenize(text, start, end) {
  const toks = []
  let i = start
  while (i < end) {
    const c = text[i]
    if (/\s/.test(c)) { i++; continue }
    if (/[A-Za-z_$]/.test(c) || c.charCodeAt(0) > 0x7f) {
      const s = i
      while (i < end && (/[\w$\u0080-\uffff]/.test(text[i]))) i++
      toks.push({ t: 'id', v: text.slice(s, i), at: s })
      continue
    }
    if (/[0-9]/.test(c)) {
      const s = i
      while (i < end && /[\w.]/.test(text[i])) i++
      toks.push({ t: 'num', v: text.slice(s, i), at: s })
      continue
    }
    if ('{}[]()<>.,;:?=|&!*+-/%~^'.includes(c)) { toks.push({ t: c, v: c, at: i }); i++; continue }
    toks.push({ t: 'p', v: c, at: i }); i++
  }
  return toks
}

// `'foo-bar': 1` 这种引号键在遮罩后的文本里只剩空白，得回原文取
function quotedKeyBefore(original, colonIdx) {
  let k = colonIdx - 1
  while (k >= 0 && /\s/.test(original[k])) k--
  const q = original[k]
  if (q !== "'" && q !== '"') return null
  let j = k - 1
  while (j >= 0) {
    if (original[j] === '\\') { j -= 2; continue }
    if (original[j] === q) return { name: original.slice(j + 1, k), at: j }
    j--
  }
  return null
}

// 值里出现这些工具类型时，成员的子键是算不出来的（动态或重映射），只能标「部分可知」
const DYNAMIC_TYPE = new Set(['Record', 'Pick', 'Omit', 'Partial', 'Required', 'Readonly', 'Exclude', 'Extract'])

// 值就是这些名字时，它是个叶子，不是一个可以展开的类型别名
const PRIMITIVE = new Set(['string', 'number', 'boolean', 'any', 'unknown', 'never', 'void', 'null', 'undefined', 'object', 'bigint', 'symbol', 'true', 'false', 'this'])

/**
 * 走查一个对象字面量 / interface 体，返回成员路径。
 * @param {string} src            整段源码
 * @param {object} opt
 * @param {number} opt.brace      从哪个 `{` 开始（默认找第一个）
 * @param {number} opt.maxObjDepth 只收浅几层；0 = 不限
 *                                 浅层模式下「值是对象」的成员**也算**（prop 可以是对象）
 * @param {boolean} opt.collectOpen 是否记录带索引签名的前缀
 * @returns {{ paths: Map<string, number>, open: Set<string>, refs: Map<string, string> }}
 *          refs：成员 → 它引用的类型名（`userName: FormMsg`），供调用方展开
 */
function collectMembers(src, opt = {}) {
  const masked = maskSource(src)
  const { maxObjDepth = 0, collectOpen = false } = opt
  let brace = opt.brace
  if (brace == null) brace = masked.indexOf('{')
  if (brace < 0) return { paths: new Map(), open: new Set(), refs: new Map() }

  // 只走这一个对象/类型体：不把「闭合之后那些声明」也扫进来。
  // 不截断的话，Schema 后面所有 interface/type 的成员都会被算成 Schema 的 key
  // （实测里那 14 条 baseURL / proxyPattern / status 全是这么来的）。
  const closeBrace = matchBracket(masked, brace)
  const limit = closeBrace > brace ? closeBrace + 1 : masked.length
  const tokens = tokenize(masked, brace, limit)
  /** @type {{key: string|null, at: number, open: boolean}[]} */
  const stack = []
  const refs = new Map()
  const paths = new Map()
  const open = new Set()

  const pathOf = () => stack.map((f) => f.key).filter(Boolean).join('.')
  const emit = (name, at) => {
    if (maxObjDepth && stack.length > maxObjDepth) return
    const full = [...stack.map((f) => f.key).filter(Boolean), name].join('.')
    if (full && !paths.has(full)) paths.set(full, at)
  }

  let awaiting = null      // `key:` 之后等着看值是什么
  let cand = null          // 成员位置上刚读到的标识符（可能是键）
  let memberPos = true     // 当前位置是否处于「成员开始」
  let lastPopped = null    // 刚弹出的那个对象帧（用来识别 A & Record<...> 这种部分动态类型）

  // 「上一个 token 是值的结尾」→ 换行之后就是下一个成员。
  // interface 的成员之间可以完全不用逗号，只靠换行分隔，所以这条必须有。
  const isValueEnd = (t) => t && (t.t === 'id' || t.t === 'num' || t.t === '}' || t.t === ')' || t.t === ']' || t.t === '>')

  for (let ti = 0; ti < tokens.length; ti++) {
    const tk = tokens[ti]
    const prevT = tokens[ti - 1]
    const newlineBefore = prevT
      ? /\n/.test(masked.slice(prevT.at + String(prevT.v ?? '').length, tk.at))
      : true

    // ---- 结构字符
    if (tk.t === '{') {
      const key = awaiting
      awaiting = null
      if (key && maxObjDepth && stack.length + 1 > maxObjDepth && stack.length <= maxObjDepth) {
        // 浅层模式下，值为对象的成员本身也是成员（prop 可以是个对象）
        emit(key.name, key.at)
      }
      stack.push({ key: key ? key.name : null, at: key ? key.at : tk.at, open: false })
      cand = null; memberPos = true
      continue
    }

    if (tk.t === '}') {
      // 值可能是字符串（遮罩后没有 token），所以在收尾处补发一次
      if (awaiting) { emit(awaiting.name, awaiting.at); awaiting = null }
      const frame = stack.pop()
      if (frame && frame.open && collectOpen) {
        const p = [...stack.map((f) => f.key).filter(Boolean), frame.key].filter(Boolean).join('.')
        open.add(p)          // p 可能是空串：根层就有索引签名，等价于「全都判不了」
      }
      awaiting = null; cand = null; memberPos = true
      lastPopped = frame
      continue
    }

    if (tk.t === '[') {
      const close = matchBracket(masked, tk.at)
      if (awaiting) {
        emit(awaiting.name, awaiting.at)          // key: [...] 是数组值，成员到此为止
        awaiting = null
      } else if (tokens[ti + 1]?.t === 'id' && tokens[ti + 2]?.t === ':') {
        if (stack.length && collectOpen) stack[stack.length - 1].open = true   // [key: string]: T
      }
      cand = null; memberPos = true
      if (close > tk.at) {
        const next = tokens.findIndex((t) => t.at > close)
        ti = next < 0 ? tokens.length : next - 1
      }
      continue
    }

    if (tk.t === ':') {
      // 键：紧贴的标识符（允许中间夹 ? / !），或引号键
      let key = null
      if (cand && /^[\s?!]*$/.test(src.slice(cand.end, tk.at))) key = cand
      else if (memberPos) key = quotedKeyBefore(src, tk.at)   // 只在成员位置接受引号键，避开三元
      awaiting = key
      cand = null; memberPos = false
      continue
    }

    if (tk.t === 'id' || tk.t === 'num') {
      if (awaiting) {
        const full = [...stack.map((f) => f.key).filter(Boolean), awaiting.name].join('.')
        emit(awaiting.name, awaiting.at)
        // 值形如 `Record<K, V>` / `Pick<>` / `Partial<>` → 这个成员的子键是动态的，
        // 别拿「类型里没有」去判它的下一层（`route: Record<RouteKey, string>` 就是这种）。
        if (collectOpen && DYNAMIC_TYPE.has(tk.v) && tokens[ti + 1]?.t === '<' && full) open.add(full)
        // 值是单个类型名（不是 string/number 这种）→ 记下来，调用方可以展开它的成员
        if (!PRIMITIVE.has(tk.v) && /^[A-Za-z_$][\w$]*$/.test(tk.v) && tokens[ti + 1]?.t !== '<' && full) {
          refs.set(full, tk.v)
        }
        awaiting = null; cand = null
        memberPos = true          // 值结束，下一个标识符就是下一个成员
        continue
      }
      if (!memberPos && newlineBefore && isValueEnd(prevT)) memberPos = true
      if (memberPos) {
        cand = { name: tk.v, at: tk.at, end: tk.at + tk.v.length, adjacent: true }
        memberPos = false
        continue
      }
      cand = null
      continue
    }

    if (tk.t === '(' || tk.t === '<') {
      // 值可能是 `(a: string) => void` 或 `Foo<Bar>`：成员已经确定了，收掉
      if (awaiting) emit(awaiting.name, awaiting.at)
      awaiting = null; cand = null; memberPos = false
      continue
    }

    if (tk.t === ',' || tk.t === ';') {
      if (awaiting) emit(awaiting.name, awaiting.at)
      awaiting = null; cand = null; memberPos = true
      continue
    }

    if (tk.t === ')' || tk.t === ']' || tk.t === '>') {
      // 复杂类型的收尾：`(a: string) => void` / `T[]` / `Foo<Bar>`
      awaiting = null; cand = null; memberPos = true
      continue
    }

    // 联合类型的 `|` 不算值结束：`size?: 'sm' | 'md'` 里字符串是遮罩掉的，
    // 这里若清掉 awaiting，这个成员就永远发不出来了。
    if (tk.t === '|') { cand = null; memberPos = false; continue }
    if (tk.t === '&') {
      // `themeSchema: { title: string } & Record<UnionKey.ThemeScheme, string>`
      // 前半段是固定的、后半段是动态的 → 整个键只能算「部分可知」，
      // 不当成 open 就会把 light/dark/auto 全报成「类型里没有」。
      if (lastPopped && lastPopped.key && collectOpen) {
        open.add([...stack.map((f) => f.key).filter(Boolean), lastPopped.key].join('.'))
      }
      cand = null; memberPos = false
      continue
    }
    if (tk.t === '=') { awaiting = null; cand = null; memberPos = false; continue }

    // `?` `!` 是可选标记，键还没定，保留 cand
    if (tk.t === '?' || tk.t === '!') { memberPos = false; continue }

    cand = null; memberPos = false
  }

  return { paths, open, refs }
}

// 索引签名的前缀判断：`a.b` 是否落在某个动态前缀下（无法静态判定）
function underOpenPrefix(path, open) {
  for (const pre of open) {
    if (pre === '') return true                    // 根上就有索引签名 → 全都判不了
    if (path === pre || path.startsWith(`${pre}.`)) return true
  }
  return false
}

// ---------------------------------------------------------------- 收集结果
const findings = []
const skipped = []
const stats = { files: 0, vue: 0, columns: 0, langs: 0, typings: 0 }

function add(level, check, file, line, column, message, detail) {
  findings.push({ level, check, file: file ? rel(file) : null, line, column, message, detail })
}

// 文件里的逃逸注释：本行或上一行写了 frontend-health-ignore 就跳过这一条。
// 三条检查都认这个口径——文档里承诺了「加注释就不报」，那就得真的每条都认，
// 只在前端那一类认得、另外两类不认，是最容易让人觉得「这工具在骗我」的做法。
function lineIgnored(lines, line) {
  if (!line) return false
  const cur = lines[line - 1] ?? ''
  const prev = lines[line - 2] ?? ''
  return /frontend-health-ignore/.test(cur) || /frontend-health-ignore/.test(prev)
}

// 注意：key 是字符串，只能用 Map——WeakMap 的键必须是对象，
// 传字符串会抛 "Invalid value used as weak map key"（真抛过）。
const splitCache = new Map()
function linesOf(src) {
  let hit = splitCache.get(src)
  if (!hit) { hit = src.split('\n'); splitCache.set(src, hit) }
  return hit
}

// ================================================================ ① columns

function checkColumns(files) {
  if (!enabled.has('columns')) return

  for (const file of files) {
    const ext = extname(file).toLowerCase()
    if (ext !== '.vue' && ext !== '.tsx' && ext !== '.ts' && ext !== '.jsx') continue
    const src = readSource(file)
    if (!src.includes('useTable')) continue

    const masked = maskSource(src)
    const lineOf = makeLineIndex(src)

    for (const m of masked.matchAll(/\buseTable\s*[<(]/g)) {
      stats.columns++          // 计「调用处」而不是「文件数」，摘要里能看出这一条到底有没有真在跑
      let p = m.index + m[0].length - 1
      if (masked[p] === '<') {
        const closeAngle = matchAngle(masked, p)
        if (closeAngle < 0) continue
        p = closeAngle + 1
      }
      while (p < masked.length && /\s/.test(masked[p])) p++
      if (masked[p] !== '(') continue
      const close = matchBracket(masked, p)
      if (close < 0) continue

      const region = masked.slice(p + 1, close)
      const regionBase = p + 1

      for (const c of region.matchAll(/\bcolumns\s*:/g)) {
        const colonAt = regionBase + c.index + c[0].length - 1
        let v = colonAt + 1
        while (v < masked.length && /\s/.test(masked[v])) v++
        const ch = masked[v]
        if (ch == null) continue
        const pos = lineOf(colonAt)
        if (lineIgnored(linesOf(src), pos.line)) continue
        const snippet = src.slice(src.lastIndexOf('\n', colonAt) + 1, src.indexOf('\n', v) < 0 ? undefined : src.indexOf('\n', v)).trim()

        if (ch === '[') {
          add('error', 'columns-array', file, pos.line, pos.column,
            'columns 传的是数组字面量，useTable 要求函数',
            { snippet, hint: '改成 columns: () => [...]；写成数组列表照样能出，但列不会随状态更新' })
          continue
        }

        if (ch === '(' || ch === '<') {
          // `() => [...]` / `function () {}`：看闭括号后面是不是箭头
          const closeParen = ch === '(' ? matchBracket(masked, v) : -1
          if (closeParen > 0 && /^\s*=>/.test(masked.slice(closeParen + 1))) continue
          if (ch === '(') continue    // 可能是 `(columns)` 包一层，判不了就放过
          continue
        }

        if (/[A-Za-z_$]/.test(ch)) {
          const nameMatch = /^[A-Za-z_$][\w$]*/.exec(masked.slice(v))
          const name = nameMatch?.[0]
          if (!name) continue
          // 同文件里找这个标识符的定义
          const declRe = new RegExp(`(?:const|let|var)\\s+${name.replace(/\$/g, '\\$')}\\s*(?::[^=]*)?=\\s*`)
          const decl = declRe.exec(masked)
          if (!decl) continue
          let d = decl.index + decl[0].length
          while (d < masked.length && /\s/.test(masked[d])) d++
          if (masked[d] === '[') {
            add('warn', 'columns-array-via-var', file, pos.line, pos.column,
              `columns 传的是变量 ${name}，同一文件里它是数组字面量`,
              { snippet, hint: `把 ${name} 改成函数（() => [...]）或直接内联成 columns: () => [...]` })
          }
        }
      }
    }
  }
}

// ================================================================ ② i18n

const LANGS_DIR_CANDIDATES = [
  'src/locales/langs',
  'src/locale/langs',
  'src/i18n/langs',
  'src/locales',
  'locales/langs',
  'locales',
]

function findLangsDir() {
  for (const rel of LANGS_DIR_CANDIDATES) {
    const dir = join(ROOT, rel)
    if (!existsSync(dir)) continue
    try {
      const files = readdirSync(dir).filter((f) => /\.(ts|js|mjs)$/.test(f))
      if (files.length) return { dir, rel, files }
    } catch { /* 读不了就试下一个 */ }
  }
  return null
}

// 语言包：找到那份「key 的树」到底从哪个 `{` 开始。
// 两种真实写法都要认：
//   export default { ... }                    （直接给对象）
//   const local: App.I18n.Schema = { ... }
//   export default local                      （SoybeanAdmin 系，先声明再导出）
function langObjectBrace(masked) {
  const ed = /\bexport\s+default\b/.exec(masked)
  if (ed) {
    let i = ed.index + ed[0].length
    while (/\s/.test(masked[i])) i++
    if (masked[i] === '{') return i
    const idm = /^[A-Za-z_$][\w$]*/.exec(masked.slice(i))
    if (idm) {
      const decl = new RegExp(`\\b(?:const|let|var)\\s+${escapeRe(idm[0])}\\s*(?::[^=]*)?=\\s*\\{`).exec(masked)
      if (decl) return masked.indexOf('{', decl.index + decl[0].length - 1)
    }
  }
  // 兜底：文件里第一个 `= {`
  const any = /=\s*\{/.exec(masked)
  return any ? masked.indexOf('{', any.index) : -1
}

function langKeys(src) {
  const masked = maskSource(src)
  const brace = langObjectBrace(masked)
  if (brace < 0) return null
  const { paths } = collectMembers(src, { brace, maxObjDepth: 0, collectOpen: true })
  return paths
}

// 类型表：src/typings 下所有声明了 I18n.Schema 的 .d.ts
function findTypingFiles() {
  const out = []
  const candidates = [
    join(ROOT, 'src/typings'),
    join(ROOT, 'src/types'),
    join(ROOT, 'src/typings/app.d.ts'),
    join(ROOT, 'src/typings/extra.d.ts'),
  ]
  const seen = new Set()
  const push = (f) => { if (existsSync(f) && !seen.has(f)) { seen.add(f); out.push(f) } }
  for (const c of candidates) {
    if (!existsSync(c)) continue
    if (c.endsWith('.d.ts')) { push(c); continue }
    const files = walk(c, []).filter((f) => f.endsWith('.d.ts'))
    for (const f of files) push(f)
  }
  return out.filter((f) => {
    const s = readSource(f)
    return /\binterface\s+Schema\b|\btype\s+Schema\s*=/.test(s) && /I18n/.test(s)
  })
}

function schemaPaths(src) {
  const masked = maskSource(src)
  const acc = { paths: new Map(), open: new Set(), refs: new Map() }
  // `interface Schema {...}` 与 `type Schema = {...}` 两种都要认。
  // 注意正则尾部不能加 \b：`=` 与空格之间没有 \b，加了就永远匹配不上。
  const re = /\b(?:interface\s+Schema|type\s+Schema\s*=)/g
  for (const m of masked.matchAll(re)) {
    const brace = masked.indexOf('{', m.index + m[0].length)
    if (brace < 0) continue
    const sub = collectMembers(src, { brace, maxObjDepth: 0, collectOpen: true })
    for (const [k, v] of sub.paths) if (!acc.paths.has(k)) acc.paths.set(k, v)
    for (const k of sub.open) acc.open.add(k)
    for (const [k, v] of sub.refs) if (!acc.refs.has(k)) acc.refs.set(k, v)
  }
  return acc
}

// 类型别名索引：`type FormMsg = { required: string; invalid: string }`
// 不建这张表，`form.userName: FormMsg` 的下一层就会被判成「类型里没有」——
// 这是本项目实测里最大的一类误报（12 条全是它）。
function buildTypeIndex(sources) {
  const idx = new Map()
  const dup = new Set()
  for (const src of sources) {
    const masked = maskSource(src)
    for (const m of masked.matchAll(/\b(?:interface|type)\s+([A-Za-z_$][\w$]*)\s*(?:=\s*)?(?=[<{])/g)) {
      const name = m[1]
      let brace = masked.indexOf('{', m.index + m[0].length)
      if (brace < 0) continue
      // 跳过泛型参数列表里的 `{`
      const close = matchBracket(masked, brace)
      if (close < 0) continue
      const body = src.slice(brace, close + 1)
      if (idx.has(name)) { dup.add(name); continue }
      idx.set(name, { body, base: brace })
    }
  }
  for (const d of dup) idx.delete(d)      // 同名多处 → 不解析，宁可不判
  return idx
}

// 顺着 refs 把类型别名一层层摊平（最多 3 层，防循环引用）
function expandRefs(acc, typeIndex, depth = 0) {
  if (depth > 3) return
  const pending = [...acc.refs]
  let added = false
  for (const [path, name] of pending) {
    const hit = typeIndex.get(name)
    if (!hit) continue
    const sub = collectMembers(hit.body, { maxObjDepth: 0, collectOpen: true })
    for (const [k, at] of sub.paths) {
      const full = `${path}.${k}`
      if (!acc.paths.has(full)) { acc.paths.set(full, hit.base + at); added = true }
    }
    for (const o of sub.open) acc.open.add(`${path}.${o}`)
    for (const [k, n] of sub.refs) if (!acc.refs.has(`${path}.${k}`)) acc.refs.set(`${path}.${k}`, n)
  }
  if (added) expandRefs(acc, typeIndex, depth + 1)
}

function checkI18n() {
  if (!enabled.has('i18n')) return

  const langs = findLangsDir()
  if (!langs) {
    skipped.push({ check: 'i18n', reason: `没找到语言包目录（试过 ${LANGS_DIR_CANDIDATES.join(' / ')}）` })
    return
  }

  const langFiles = langs.files
    .map((f) => join(langs.dir, f))
    .filter((f) => !/^(index|types?)\.(ts|js|mjs)$/.test(basename(f)))
    .filter((f) => !excluded(f))

  /** @type {{file: string, name: string, keys: Map<string, number>, src: string}[]} */
  const packs = []
  for (const file of langFiles) {
    const src = readSource(file)
    const keys = langKeys(src)
    if (!keys || !keys.size) continue
    packs.push({ file, name: basename(file).replace(/\.(ts|js|mjs)$/, ''), keys, src })
  }
  stats.langs = packs.length

  if (!packs.length) {
    skipped.push({ check: 'i18n', reason: `${langs.rel} 下没解析出任何 key（可能不是对象字面量形式）` })
    return
  }

  const union = new Map()
  for (const p of packs) for (const [k, at] of p.keys) if (!union.has(k)) union.set(k, { pack: p, at })

  // ②-a 语言包之间的对齐：某套语言缺了别处有的 key。
  // 按 key 汇总成一条（「缺 3 套：fil-ph, id-id, ms-my」），否则 8 套语言里漏一个 key
  // 就报 7 条，几十个 key 直接刷屏、真正的问题反而找不着。
  const missingByKey = new Map()
  for (const p of packs) {
    for (const k of union.keys()) {
      if (p.keys.has(k)) continue
      if (!missingByKey.has(k)) missingByKey.set(k, [])
      missingByKey.get(k).push(p)
    }
  }
  for (const [k, lacking] of missingByKey) {
    const hit = union.get(k)
    const lineOf = makeLineIndex(hit.pack.src)
    const pos = lineOf(hit.at)
    if (lineIgnored(linesOf(hit.pack.src), pos.line)) continue
    add('warn', 'lang-parity', hit.pack.file, pos.line, pos.column,
      `key「${k}」缺 ${lacking.length} 套语言（${lacking.map((p) => p.name).join(', ')}），那些语言下会显示 key 原文`,
      { key: k, langs: lacking.map((p) => p.name) })
  }

  // ②-b 类型表
  const typingFiles = findTypingFiles()
  stats.typings = typingFiles.length
  if (!typingFiles.length) {
    skipped.push({
      check: 'i18n',
      reason: '没找到声明 I18n.Schema 的 .d.ts（试过 src/typings/app.d.ts、src/typings/**、src/types/**）',
    })
    return
  }

  const typeAcc = { paths: new Map(), open: new Set(), refs: new Map() }
  const typingSources = typingFiles.map(readSource)
  for (const src of typingSources) {
    const sub = schemaPaths(src)
    for (const [k, v] of sub.paths) if (!typeAcc.paths.has(k)) typeAcc.paths.set(k, v)
    for (const k of sub.open) typeAcc.open.add(k)
    for (const [k, v] of sub.refs) if (!typeAcc.refs.has(k)) typeAcc.refs.set(k, v)
  }
  expandRefs(typeAcc, buildTypeIndex(typingSources))
  if (!typeAcc.paths.size) {
    skipped.push({ check: 'i18n', reason: `${typingFiles.map(rel).join(', ')} 里没解析出 I18n.Schema 的成员` })
    return
  }

  for (const [k, hit] of union) {
    if (typeAcc.paths.has(k)) continue
    if (underOpenPrefix(k, typeAcc.open)) continue
    const lineOf = makeLineIndex(hit.pack.src)
    const pos = lineOf(hit.at)
    if (lineIgnored(linesOf(hit.pack.src), pos.line)) continue
    add('error', 'i18n-missing-type', hit.pack.file, pos.line, pos.column,
      `语言包有「${k}」，I18n.Schema 没有 → vue-tsc 会在用到该 key 的地方报属性不存在`,
      { key: k, hint: '在手写的 I18n.Schema 里补上（类型表不会自动生成）' })
  }

  // `form.userName: FormMsg` 这种「值是对象」的成员本身不是文案 key，只有它的叶子才是。
  // 先把所有「有下级」的前缀收成一张表，下面遇到就跳过，否则每个对象成员都会被误报一条。
  const parents = new Set()
  for (const p of typeAcc.paths.keys()) {
    const parts = p.split('.')
    for (let i = 1; i < parts.length; i++) parents.add(parts.slice(0, i).join('.'))
  }

  for (const [k] of typeAcc.paths) {
    if (union.has(k)) continue
    if (underOpenPrefix(k, typeAcc.open)) continue
    if (parents.has(k)) continue
    // 类型可能来自多个 .d.ts、还可能是展开出来的别名成员，行号不可靠 → 只报文件
    add('warn', 'i18n-type-without-value', typingFiles[0], null, null,
      `I18n.Schema 有「${k}」，但没有语言包提供它 → 运行时会显示原始 key 字符串`,
      { key: k })
  }
}

// ================================================================ ③ props

const HTML_TAGS = new Set(('a abbr address area article aside audio b base bdi bdo blockquote br button canvas caption ' +
  'cite code col colgroup data datalist dd del details dfn dialog div dl dt em embed fieldset figcaption figure ' +
  'footer form h1 h2 h3 h4 h5 h6 head header hgroup hr html i iframe img input ins kbd label legend li link main ' +
  'map mark menu meta meter nav noscript object ol optgroup option output p picture pre progress q rp rt ruby s ' +
  'samp script section select slot small source span strong style sub summary sup table tbody td template textarea ' +
  'tfoot th thead time title tr track u ul var video wbr').split(' '))

const pascal = (name) => name.split(/[-_]/).filter(Boolean).map((s) => s[0].toUpperCase() + s.slice(1)).join('')
const kebab = (name) => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
const camel = (name) => name.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase())

function splitTopLevel(str, sep) {
  const out = []
  let depth = 0, last = 0
  for (let i = 0; i < str.length; i++) {
    const c = str[i]
    if ('<({['.includes(c)) depth++
    else if ('>)}]'.includes(c)) depth--
    else if (c === sep && depth === 0) { out.push(str.slice(last, i)); last = i + 1 }
  }
  out.push(str.slice(last))
  return out
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// 从 defineProps 的形态里拿 prop 名字
function propsOfDefineProps(src, masked, at) {
  let i = at + 'defineProps'.length
  while (/\s/.test(masked[i])) i++
  const c = masked[i]

  if (c === '<') {
    const close = matchAngle(masked, i)
    if (close < 0) return { names: null, reason: '泛型括号没闭合' }
    const body = src.slice(i + 1, close).trim()
    const res = propsFromType(src, body, [[i, close]])
    return { ...res, spans: res.spans ?? [[i, close]] }
  }

  if (c === '(') {
    const close = matchBracket(masked, i)
    if (close < 0) return { names: null, reason: '参数括号没闭合' }
    const body = src.slice(i + 1, close).trim()
    if (!body) return { names: new Set(), reason: null, span: [i, close] }   // defineProps() 无参
    if (body.startsWith('[')) {
      const names = new Set([...body.matchAll(/['"]([\w$-]+)['"]/g)].map((m) => m[1]))
      return { names, reason: null, span: [i, close] }
    }
    if (body.startsWith('{')) {
      const { paths } = collectMembers(body, { maxObjDepth: 1 })
      return { names: new Set(paths.keys()), reason: null, span: [i, close] }
    }
    return { names: null, reason: 'defineProps 的参数看不懂', span: [i, close] }
  }
  return { names: null, reason: 'defineProps 调用形态看不懂', span: [at, at] }
}

// 找到某个 prop 名在 defineProps 表达式里真正出现的位置。
// 报行号时不能用 `defineProps<Props>()` 那一行——用户拿着那一行既改不了、也贴不准忽略注释。
function memberOffset(src, span, name) {
  const [from, to] = span
  const re = new RegExp(`(?:^|[{,;\\s])['"]?${escapeRe(name)}['"]?\\s*[?:]`)
  const m = re.exec(src.slice(from, to + 1))
  if (!m) return null
  return from + m.index + m[0].indexOf(name)
}

function propsFromType(src, body, spans = []) {
  const names = new Set()
  const unresolved = []
  const parts = splitTopLevel(body.replace(/^\s*\{|\}\s*$/g, (m) => (m.startsWith('{') ? '{' : '}')), '&')

  for (const raw of parts) {
    let p = raw.trim()
    while (p.startsWith('(') && p.endsWith(')')) p = p.slice(1, -1).trim()
    if (!p) continue

    if (p.startsWith('{')) {
      const { paths } = collectMembers(p, { maxObjDepth: 1 })
      for (const k of paths.keys()) names.add(k)
      continue
    }

    // 泛型包装：Partial<T> / Required<T> / Readonly<T> 直接拆
    const wrap = /^(Partial|Required|Readonly)\s*<([\s\S]+)>$/.exec(p)
    if (wrap) {
      const inner = propsFromType(src, wrap[2], spans)
      for (const k of inner.names ?? []) names.add(k)
      for (const r of inner.unresolved ?? []) unresolved.push(r)
      continue
    }

    if (/^(Pick|Omit)\s*</.test(p)) { unresolved.push(p.split('<')[0]); continue }

    const id = /^([A-Za-z_$][\w$]*)$/.exec(p)
    if (id) {
      const resolved = resolveTypeRef(src, id[1])
      if (resolved) {
        for (const k of resolved.keys) names.add(k)
        spans.push(resolved.span)
      } else unresolved.push(id[1])
      continue
    }

    unresolved.push(p.slice(0, 40))
  }

  return { names: names.size ? names : null, unresolved, spans }
}

// 同文件里找 interface/type 定义；找不到就交给调用方标「无法判定」。
// 同时把类型体的位置区间带出去——报行号要用它，不然只能说「第 8 行的 defineProps」。
function resolveTypeRef(src, name) {
  const masked = maskSource(src)
  const re = new RegExp(`\\b(?:interface|type)\\s+${escapeRe(name)}\\b`, 'g')
  for (const m of masked.matchAll(re)) {
    const brace = masked.indexOf('{', m.index + m[0].length)
    if (brace < 0) continue
    const close = matchBracket(masked, brace)
    if (close < 0) continue
    const { paths } = collectMembers(src.slice(brace, close + 1), { maxObjDepth: 1 })
    if (paths.size) return { keys: new Set(paths.keys()), span: [brace, close] }
  }
  return null
}

function findDefinePropsCalls(src) {
  const masked = maskSource(src)
  const out = []
  for (const m of masked.matchAll(/\bdefineProps\s*[<(]/g)) out.push(m.index)
  return { masked, out }
}

// 「这个 prop 有默认值」：withDefaults(..., {...}) 的第二参，或运行时 prop 里的 default
function propsWithDefault(src, masked) {
  const out = new Set()
  for (const m of masked.matchAll(/\bwithDefaults\s*\(/g)) {
    const open = m.index + m[0].length - 1
    const close = matchBracket(masked, open)
    if (close < 0) continue
    const parts = splitTopLevel(src.slice(open + 1, close), ',')
    if (parts.length < 2) continue
    const defSrc = parts.slice(1).join(',')
    if (!defSrc.includes('{')) continue
    const { paths } = collectMembers(defSrc, { maxObjDepth: 1 })
    for (const k of paths.keys()) out.add(k)
  }
  return out
}

// 组件名以 defineOptions({ name: 'X' }) 为准；**不能**全文件搜 `name: '...'`，
// 那会把列定义里的 `{ name: 'text' }` 当成组件名（真踩过）。
function componentNameOverride(src, masked) {
  for (const m of masked.matchAll(/\bdefineOptions\s*\(/g)) {
    const open = m.index + m[0].length - 1
    const close = matchBracket(masked, open)
    if (close < 0) continue
    const n = /\bname\s*:\s*['"]([\w.-]+)['"]/.exec(src.slice(open + 1, close))
    if (n) return n[1]
  }
  return null
}

function checkProps(files) {
  if (!enabled.has('props')) return

  /** @type {{file: string, comp: string, variants: string[], props: {name: string, line: number}[], unresolved: string[]}[]} */
  const components = []

  for (const file of files) {
    const ext = extname(file).toLowerCase()
    if (!['.vue', '.tsx', '.jsx', '.ts', '.js'].includes(ext)) continue
    const src = readSource(file)
    if (!src.includes('defineProps')) continue

    const { masked, out } = findDefinePropsCalls(src)
    const lineOf = makeLineIndex(src)

    const base = basename(file).replace(/\.\w+$/, '')
    const nameOverride = componentNameOverride(src, masked)
    // 模板里认的是 **import 时那个变量名**（script setup 的作用域查找），
    // 而 defineOptions.name 只影响 devtools / KeepAlive 缓存键。
    // 两者经常不一致（文件名 FooCard.vue、name 写 Foo），
    // 所以两个都要当候选，否则会误报「全仓没人用」。
    const comp = base
    const variants = [...new Set([base, nameOverride].filter(Boolean).flatMap((n) => [n, pascal(n), kebab(n), camel(n)]))]

    const declared = new Map()
    const unresolvedAll = []
    const defaults = propsWithDefault(src, masked)

    for (const at of out) {
      const res = propsOfDefineProps(src, masked, at)
      if (res.unresolved) for (const u of res.unresolved) unresolvedAll.push(u)
      if (!res.names) {
        if (res.reason) unresolvedAll.push(res.reason)
        continue
      }
      for (const name of res.names) {
        if (declared.has(name)) continue
        // 依次在「泛型体」和「解析出来的类型体」里找这个名字的真实位置
        let off = null
        for (const sp of res.spans ?? []) {
          off = memberOffset(src, sp, name)
          if (off != null) break
        }
        declared.set(name, lineOf(off ?? at).line)
      }
    }

    if (!declared.size) {
      if (unresolvedAll.length) {
        skipped.push({
          check: 'props',
          reason: `${rel(file)} 的 prop 类型无法静态解析（${[...new Set(unresolvedAll)].join(', ')}）`,
        })
      }
      continue
    }

    components.push({
      file,
      comp,
      variants,
      props: [...declared].map(([name, line]) => ({ name, line })),
      unresolved: [...new Set(unresolvedAll)],
      defaults,
    })
  }

  if (!components.length) {
    skipped.push({ check: 'props', reason: '没扫到任何 defineProps 声明' })
    return
  }

  const variantOwner = new Map()
  for (const c of components) for (const v of c.variants) if (!variantOwner.has(v)) variantOwner.set(v, c)

  const norm = (p) => p.split('\\').join('/')
  const byFile = new Map(components.map((c) => [norm(c.file), c]))

  // 「这个文件里的 Xxx 到底指向哪个组件」——直接读 import 最准。
  // 只靠组件名会出现两个同名叫 SettingItem 的组件互相顶替，一个报「没人用」、
  // 另一个把别人传的 prop 记成自己的（实测踩到）。
  function localImports(file, src) {
    const map = new Map()
    for (const m of src.matchAll(/\bimport\s+([A-Za-z_$][\w$]*)\s*,?\s*(?:\{[^}]*\}\s*)?from\s+['"]([^'"]+)['"]/g)) {
      const [, name, spec] = m
      let abs = null
      if (spec.startsWith('.')) abs = resolve(dirname(file), spec)
      else if (spec.startsWith('@/')) abs = join(ROOT, 'src', spec.slice(2))
      if (!abs) continue
      const hit = byFile.get(norm(abs)) || byFile.get(norm(abs) + '.vue')
      map.set(name, hit ?? null)
    }
    return map
  }

  // 第二遍：只找这些组件的使用点（模板标签 / JSX 标签 / h() 对象）
  /** @type {Map<string, {kind:'tag'|'object', text:string, file:string}[]>} */
  const usages = new Map()

  for (const file of files) {
    const ext = extname(file).toLowerCase()
    if (!['.vue', '.tsx', '.jsx', '.ts', '.js'].includes(ext)) continue
    const src = readSource(file)
    const masked = maskSource(src)
    if (!/[<(]/.test(masked)) continue
    const local = localImports(file, src)

    // <Tag ...>
    for (const m of masked.matchAll(/<([A-Za-z][\w.:-]*)/g)) {
      const tag = m[1]
      if (HTML_TAGS.has(tag.toLowerCase()) && !variantOwner.has(tag)) continue
      // 本文件 import 过的优先按 import 解析（同名组件不会互相顶替）；
      // 没 import 的（全局自动注册）再退回按名字认。
      const owner = local.has(tag) ? local.get(tag) : variantOwner.get(tag)
      if (!owner) continue
      if (owner.file === file) continue

      let end = -1
      let depth = 0
      for (let i = m.index + m[0].length; i < masked.length; i++) {
        const c = masked[i]
        if (c === '{') depth++
        else if (c === '}') depth--
        else if (c === '>' && depth === 0) { end = i; break }
        else if (c === '<' && depth === 0) break        // 畸形标签，放弃
      }
      if (end < 0) continue

      const text = src.slice(m.index, end + 1)
      if (!usages.has(owner.file)) usages.set(owner.file, [])
      usages.get(owner.file).push({ kind: 'tag', text, file })
    }

    // h(Comp, { ... }) / h(Comp, {...}) —— h() 的对象式传参
    for (const m of masked.matchAll(/\bh\s*\(\s*([A-Za-z_$][\w$]*)\s*,/g)) {
      const owner = local.has(m[1]) ? local.get(m[1]) : variantOwner.get(m[1])
      if (!owner || owner.file === file) continue
      let p = m.index + m[0].length
      while (p < masked.length && /\s/.test(masked[p])) p++
      if (masked[p] !== '{') continue
      const close = matchBracket(masked, p)
      if (close < 0) continue
      if (!usages.has(owner.file)) usages.set(owner.file, [])
      usages.get(owner.file).push({ kind: 'object', text: src.slice(p, close + 1), file })
    }
  }

  const SPREAD = /v-bind\s*=\s*["']|v-bind\s*=\s*\{|\{\s*\.\.\./

  for (const c of components) {
    const sites = usages.get(c.file) ?? []
    const compSrc = readSource(c.file)
    const lineOf = makeLineIndex(compSrc)

    if (!sites.length) {
      // 页面文件是路由表按目录约定拉起来的，不靠模板标签引用 —— 判它「没人用」纯属噪音。
      // views 下只有 components/ 与 modules/ 里的才是真正的组件，其余是路由页面。
      const r = rel(c.file)
      const isRoutePage = /(^|\/)(views|pages)\//.test(r) && !/\/(components|modules)\//.test(r)
      const isDynamicRoute = /[[(]/.test(basename(c.file))
      if (isRoutePage || isDynamicRoute) continue

      add('warn', 'component-unused', c.file, 1, 1,
        `组件 ${c.comp} 声明了 props，但全仓没有任何地方使用它`,
        { comp: c.comp, hint: '删页面时漏删的组件？确认后删掉，或补上使用点' })
      continue
    }

    const spreadSites = sites.filter((s) => SPREAD.test(s.text))
    if (spreadSites.length) {
      skipped.push({
        check: 'props',
        reason: `${rel(c.file)} 在 ${spreadSites.length} 处用展开方式传参（v-bind="obj" / {...props}），其 prop 判为无法判定`,
      })
      continue
    }

    for (const p of c.props) {
      if (isPassed(p.name, sites)) continue
      if (lineIgnored(linesOf(compSrc), p.line)) continue
      // 有默认值的 prop 从没被传过 → 等于「恒用默认值」，是设计味道而不是 bug，降级
      const fallback = c.defaults?.has(p.name)
        || new RegExp(`\\b${escapeRe(p.name)}\\s*:\\s*\\{[^{}]*\\bdefault\\s*:`).test(compSrc)
      if (fallback) {
        add('info', 'prop-never-overridden', c.file, p.line, 1,
          `prop「${p.name}」有默认值，且全仓从未被传过（等于恒用默认值）`,
          { comp: c.comp, prop: p.name })
        continue
      }
      add('warn', 'prop-unused', c.file, p.line, 1,
        `prop「${p.name}」定义了但全仓没有任何地方传值`,
        { comp: c.comp, prop: p.name, hint: '删掉它，或者补上使用点；留着会让下一个读代码的人以为它有默认行为' })
    }

    for (const u of c.unresolved) {
      skipped.push({ check: 'props', reason: `${rel(c.file)} 的 prop 类型「${u}」没解析（Pick/Omit/外部类型），该组件部分 prop 未判定` })
    }
  }

  function isPassed(prop, sites) {
    const forms = new Set([prop, kebab(prop)])
    for (const s of sites) {
      const t = s.text
      // v-model / v-model:arg
      for (const m of t.matchAll(/\bv-model(?::([\w-]+))?/g)) {
        if (!m[1] && prop === 'modelValue') return true
        if (m[1] && (m[1] === prop || m[1] === kebab(prop))) return true
      }
      for (const f of forms) {
        if (s.kind === 'tag') {
          // 带值的 `:foo="x"` / `foo="x"`，以及**裸属性** `foo`（布尔 prop 常见写法：
          // `<TraceDetail embedded />`）。值部分已被遮罩，所以不会误命中表达式里的同名标识符。
          if (new RegExp(`(?:^|[\\s<{])[:@#]?${escapeRe(f)}(?=[\\s/>=])`).test(t)) return true
          if (new RegExp(`v-bind:${escapeRe(f)}(?=[\\s/>=])`).test(t)) return true
        } else {
          if (new RegExp(`(?:^|[{,\\s])${escapeRe(f)}\\s*:`).test(t)) return true
          if (new RegExp(`(?:^|[{,\\s])${escapeRe(f)}\\s*(?:,|})`).test(t)) return true   // 简写 { name }
        }
      }
    }
    return false
  }
}

// ================================================================ 主流程

const started = Date.now()

const files = walk(ROOT, []).filter((f) => !excluded(f))
stats.files = files.length
stats.vue = files.filter((f) => f.toLowerCase().endsWith('.vue')).length

if (!files.length) die(`${ROOT} 下没扫到任何源码文件（.vue/.ts/.tsx/.js/.jsx）`)
if (!stats.vue && enabled.has('columns')) {
  // 没有 .vue 也不一定是错（纯 TS 组件库），只提示不拦
  skipped.push({ check: 'columns', reason: `没扫到 .vue 文件（共 ${files.length} 个源文件），columns 检查可能不适用` })
}

for (const fn of [checkColumns, checkI18n, checkProps]) {
  try {
    fn(files)
  } catch (e) {
    // 单个检查崩了不该拖垮另外两个，但必须明说
    findings.push({ level: 'error', check: 'internal', file: null, line: null, column: null,
      message: `${fn.name} 内部异常：${e.message}`, detail: { stack: String(e.stack).split('\n').slice(0, 3) } })
  }
}

const order = { error: 0, warn: 1, info: 2 }
findings.sort((a, b) => order[a.level] - order[b.level] || String(a.file).localeCompare(String(b.file)) || (a.line ?? 0) - (b.line ?? 0))

const counts = { error: 0, warn: 0, info: 0 }
for (const f of findings) counts[f.level]++

const durationMs = Date.now() - started

// ---------------------------------------------------------------- 输出
if (opts.json) {
  process.stdout.write(JSON.stringify({
    root: ROOT,
    durationMs,
    scanned: { files: stats.files, vue: stats.vue, langs: stats.langs, typings: stats.typings },
    counts,
    findings,
    skipped,
  }, null, 2) + '\n')
} else {
  const C = process.stdout.isTTY
    ? { dim: '\x1b[2m', red: '\x1b[31m', yellow: '\x1b[33m', green: '\x1b[32m', bold: '\x1b[1m', reset: '\x1b[0m' }
    : { dim: '', red: '', yellow: '', green: '', bold: '', reset: '' }

  const out = []
  out.push(`${C.bold}前端健康体检${C.reset}  ${ROOT}`)
  out.push(`${C.dim}源文件 ${stats.files}（.vue ${stats.vue} / useTable ${stats.columns} 处 / 语言包 ${stats.langs} / 类型表 ${stats.typings}）· ${durationMs}ms${C.reset}`)
  out.push('')

  const LABEL = { error: `${C.red}error${C.reset}`, warn: `${C.yellow}warn ${C.reset}`, info: `${C.dim}info ${C.reset}` }
  const TITLE = {
    'columns-array': 'useTable 的 columns 是数组字面量',
    'columns-array-via-var': 'columns 通过变量传了数组',
    'i18n-missing-type': '语言包有、I18n.Schema 没有',
    'i18n-type-without-value': 'I18n.Schema 有、语言包没有',
    'lang-parity': '语言包之间不一致',
    'prop-unused': 'prop 定义了但没人传值',
    'prop-never-overridden': 'prop 有默认值且从未被覆盖',
    'component-unused': '组件声明了 props 但没人用',
    internal: '检查器自身异常',
  }

  const groups = new Map()
  for (const f of findings) {
    const k = `${f.level}|${f.check}`
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k).push(f)
  }

  if (!findings.length) {
    out.push(`${C.green}✓ ${enabled.size} 条检查全部通过${C.reset}${skipped.length ? `（${skipped.length} 项降级，见下）` : ''}`)
    const PASS_LABEL = { columns: 'columns 是函数', i18n: 'i18n 值与类型对齐', props: '没有死 prop' }
    out.push(`${C.dim}  ${[...enabled].map((k) => PASS_LABEL[k] ?? k).join(' · ')}${C.reset}`)
  }

  let shown = 0
  for (const [key, list] of groups) {
    const [level, check] = key.split('|')
    const total = list.length
    const visible = list.slice(0, cap)
    out.push(`${LABEL[level]} ${C.bold}${TITLE[check] ?? check}${C.reset}  ${C.dim}${total} 处${C.reset}`)
    for (const f of visible) {
      shown++
      const loc = f.file ? `${f.file}${f.line ? ':' + f.line : ''}` : '(仓库级)'
      out.push(`  ${loc}  ${f.message}`)
      if (opts.verbose && f.detail?.snippet) out.push(`      ${C.dim}${f.detail.snippet}${C.reset}`)
      if (f.detail?.hint) out.push(`      ${C.dim}→ ${f.detail.hint}${C.reset}`)
      if (f.detail?.firstSeenIn) out.push(`      ${C.dim}→ 首次出现于 ${f.detail.firstSeenIn}${C.reset}`)
    }
    if (visible.length < total) {
      out.push(`  ${C.dim}… 另有 ${total - visible.length} 处（--max=0 全列，--json 拿全部）${C.reset}`)
    }
    out.push('')
  }

  if (skipped.length) {
    out.push(`${C.dim}降级 / 跳过：${C.reset}`)
    const seen = new Set()
    for (const s of skipped) {
      if (seen.has(s.reason)) continue
      seen.add(s.reason)
      out.push(`  ${C.dim}· ${s.reason}${C.reset}`)
    }
    out.push('')
  }

  const passed = counts.error === 0 && (!opts.strict || counts.warn === 0)
  out.push(
    `${counts.error ? C.red : C.green}${counts.error} 错误${C.reset}` +
    ` / ${counts.warn ? C.yellow : C.dim}${counts.warn} 警告${C.reset}` +
    `${shown ? '' : ''}` +
    `  →  ${passed ? `${C.green}通过${C.reset}` : `${C.red}不通过${C.reset}`}${opts.strict ? C.dim + '（--strict：警告也算不通过）' + C.reset : ''}`,
  )

  process.stdout.write(out.join('\n') + '\n')
}

process.exit(counts.error > 0 || (opts.strict && counts.warn > 0) ? 1 : 0)
