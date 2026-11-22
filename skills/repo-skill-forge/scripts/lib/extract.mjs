// 符号与关系抽取。**这是启发式（regex 级），不是编译器级**。
//
// 明确的能力边界，写在这里而不是等用户撞了才发现：
//   ✅ 类型/函数/方法的定义位置、导入关系、组件使用、跨文件引用名
//   ❌ 重载区分、泛型具体化、动态导入的运行时目标、宏/装饰器生成的符号
//   ❌ 调用是否真的执行（只认"名字 + 左括号"），同名符号会归并成多条候选
//
// 所以 build-index 给每条边打 confidence：imports=high（语法确定），refs=medium（同名可能撞）。

const KEYWORDS = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'return', 'function', 'new', 'typeof', 'instanceof',
  'delete', 'void', 'await', 'async', 'yield', 'super', 'this', 'self', 'import', 'require',
  'throw', 'else', 'do', 'try', 'finally', 'case', 'default', 'in', 'of', 'with', 'assert',
  'synchronized', 'print', 'println', 'printf', 'sizeof', 'typeof', 'String', 'Integer', 'Object',
  'console', 'Math', 'JSON', 'Array', 'Promise', 'Number', 'Boolean', 'Error', 'Date', 'RegExp',
  'parseInt', 'parseFloat', 'isNaN', 'setTimeout', 'setInterval', 'clearTimeout', 'fetch',
  'def', 'lambda', 'not', 'and', 'or', 'is', 'none', 'nil', 'len', 'str', 'int', 'list', 'dict',
  'make', 'append', 'range', 'fmt', 'panic', 'recover', 'defer', 'go', 'select', 'map', 'chan',
])

/** 逐行算大括号净增量，跳过注释与字符串。用块注释时会有偏差，但只影响"方法归属哪个类"这类归属判断。 */
export function braceDelta(line) {
  let d = 0
  let quote = null
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (quote) {
      if (c === '\\') i++
      else if (c === quote) quote = null
      continue
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue }
    if (c === '/' && line[i + 1] === '/') break
    if (c === '{') d++
    else if (c === '}') d--
  }
  return d
}

function lineOf(text, index) {
  let n = 1
  for (let i = 0; i < index && i < text.length; i++) if (text.charCodeAt(i) === 10) n++
  return n
}

function pushImport(list, spec, kind, text, index) {
  if (!spec || spec.startsWith('node:')) return
  list.push({ spec, kind, line: lineOf(text, index) })
}

// ------------------------------------------------------------------ Java

const JAVA_TYPE = /(?:^|[\s;}])(?:(?:public|protected|private|abstract|final|static|sealed|non-sealed|strictfp)\s+)*(class|interface|enum|record|@interface)\s+([A-Za-z_$][\w$]*)/
const JAVA_METHOD = /^\s*(?:(?:public|protected|private|static|final|abstract|synchronized|native|default|strictfp)\s+)*(?:<[^>]{1,120}>\s*)?([A-Za-z_$][\w$]*(?:<[^;{}]{0,120}>)?(?:\[\])?)\s+([A-Za-z_$][\w$]*)\s*\(([^;{}]*)\)\s*(?:throws\s+[\w.,\s]+)?\s*[{;]/

export function extractJava(text) {
  const symbols = []
  const imports = []
  const lines = text.split(/\r?\n/)
  let pkg = null
  let depth = 0
  const stack = [] // {name, kind, depth}

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const trimmed = raw.trim()
    if (!pkg && trimmed.startsWith('package')) {
      const m = /^package\s+([\w.]+)\s*;/.exec(trimmed)
      if (m) pkg = m[1]
    }
    if (trimmed.startsWith('import')) {
      const m = /^import\s+(static\s+)?([\w.*]+)\s*;/.exec(trimmed)
      if (m) pushImport(imports, m[2], m[1] ? 'static-import' : 'import', text, 0)
      depth += braceDelta(raw)
      continue
    }

    const before = depth

    // 类型声明：要求不是注解行、不是 new 表达式
    if (!trimmed.startsWith('@') && !trimmed.startsWith('//') && !trimmed.startsWith('*') && /\b(class|interface|enum|record)\b/.test(trimmed)) {
      const m = JAVA_TYPE.exec(' ' + trimmed)
      if (m) {
        const kind = m[1] === '@interface' ? 'annotation' : m[1]
        const name = m[2]
        const rest = trimmed.slice(trimmed.indexOf(name) + name.length)
        const ext = /extends\s+([\w$.,<>\[\]\s]+?)(?:\s+implements|\s*\{|$)/.exec(rest)
        const impl = /implements\s+([\w$.,<>\[\]\s]+?)(?:\s*\{|$)/.exec(rest)
        const clean = (s) => s.split(',').map((x) => x.trim().replace(/<.*$/, '')).filter(Boolean)
        symbols.push({
          name, kind, line: i + 1,
          container: stack.length ? stack[stack.length - 1].name : null,
          exported: /\bpublic\b/.test(trimmed),
          extends: ext ? clean(ext[1]) : [],
          implements: impl ? clean(impl[1]) : [],
        })
        // 只有行尾带 { 才算真的开了作用域；`record X(...);` 这种没有体
        if (/\{\s*$/.test(trimmed) || braceDelta(raw) > 0) stack.push({ name, kind, depth: before + 1 })
      }
    } else if (before > 0 && !trimmed.startsWith('@') && !trimmed.startsWith('//') && !trimmed.startsWith('*') && trimmed.includes('(') && !/^(return|new|throw|if|for|while|switch|case|else|try|catch|do)\b/.test(trimmed) && !/^\w+\s*=[^=]/.test(trimmed)) {
      const m = JAVA_METHOD.exec(raw)
      if (m) {
        const container = stack.length ? stack[stack.length - 1] : null
        const name = m[2]
        const isCtor = container && name === container.name
        const params = m[3].trim() ? m[3].split(',').length : 0
        if (container && (isCtor || /[A-Za-z_$}]/.test(m[1]))) {
          symbols.push({
            name, kind: isCtor ? 'constructor' : 'method', line: i + 1,
            container: container.name, params,
            exported: /\bpublic\b/.test(trimmed),
            static: /\bstatic\b/.test(trimmed),
          })
        }
      }
    }

    depth += braceDelta(raw)
    while (stack.length && depth < stack[stack.length - 1].depth) stack.pop()
  }

  return { package: pkg, symbols, imports, components: [] }
}

// ------------------------------------------------------------------ TS / JS

const JS_IMPORT_FROM = /\bfrom\s+['"]([^'"]+)['"]/g
const JS_IMPORT_BARE = /^[ \t]*import\s+['"]([^'"]+)['"]/gm
const JS_REQUIRE = /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g
const JS_DYNAMIC = /[^.\w]import\(\s*['"]([^'"]+)['"]\s*\)/g

const JS_DECLS = [
  [/\bexport\s+(?:default\s+)?(?:declare\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/g, 'function', true],
  [/\bexport\s+(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/g, 'class', true],
  [/\bexport\s+(?:declare\s+)?(?:interface|type)\s+([A-Za-z_$][\w$]*)/g, 'type', true],
  [/\bexport\s+(?:declare\s+)?(?:const\s+)?enum\s+([A-Za-z_$][\w$]*)/g, 'enum', true],
  [/\bexport\s+(?:default\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g, 'const', true],
  [/^[ \t]*(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/gm, 'function', false],
  [/^[ \t]*class\s+([A-Za-z_$][\w$]*)/gm, 'class', false],
  [/^[ \t]*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=\n]+)?=\s*(?:async\s*)?(?:\([^)\n]*\)|[A-Za-z_$][\w$]*)\s*=>/gm, 'arrow', false],
  [/^[ \t]*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?function\b/gm, 'function', false],
]

const JS_METHOD = /^\s{2,}(?:(?:public|private|protected|static|async|get|set|readonly|override)\s+)*\*?\s*([A-Za-z_$][\w$]*)\s*\(([^)\n]*)\)\s*(?::\s*[^{\n]+)?\{/

export function extractScript(text, { vue = false } = {}) {
  const symbols = []
  const imports = []
  const components = []

  for (const re of [JS_IMPORT_FROM, JS_IMPORT_BARE, JS_REQUIRE, JS_DYNAMIC]) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(text))) {
      const kind = re === JS_REQUIRE ? 'require' : re === JS_DYNAMIC ? 'dynamic' : 'import'
      pushImport(imports, m[1], kind, text, m.index)
    }
  }

  for (const [re, kind, exported] of JS_DECLS) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(text))) {
      const name = m[1]
      if (KEYWORDS.has(name)) continue
      symbols.push({ name, kind, line: lineOf(text, m.index), container: null, exported })
    }
  }

  // 类方法：用大括号深度把方法归属到最近的 class
  const lines = text.split(/\r?\n/)
  let depth = 0
  const stack = []
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const trimmed = raw.trim()
    const before = depth

    const cls = /^\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/.exec(raw)
    if (cls) stack.push({ name: cls[1], depth: before + 1 })
    else if (before > 0 && JS_METHOD.test(raw) && !trimmed.startsWith('//') && !trimmed.startsWith('*')) {
      const m = JS_METHOD.exec(raw)
      const container = stack.length ? stack[stack.length - 1].name : null
      const name = m[1]
      if (container && !KEYWORDS.has(name)) {
        symbols.push({
          name, kind: name === 'constructor' ? 'constructor' : 'method', line: i + 1,
          container, exported: false,
          params: m[2].trim() ? m[2].split(',').length : 0,
        })
      }
    }

    depth += braceDelta(raw)
    while (stack.length && depth < stack[stack.length - 1].depth) stack.pop()
  }

  if (vue) {
    // 模板里的大写标签 = 子组件引用；kebab-case 交给调用方按文件名映射
    const tpl = /<template>([\s\S]*)<\/template>/.exec(text)
    if (tpl) {
      const re = /<([A-Z][\w]*)/g
      let m
      while ((m = re.exec(tpl[1]))) components.push({ name: m[1], kind: 'component' })
    }
    // 组件契约：props / emits 是"这个页面怎么被用"的关键，单独留痕
    const props = /defineProps\s*(?:<([^>]+)>)?\s*\(/.exec(text)
    if (props) components.push({ name: 'defineProps', kind: 'props', detail: (props[1] || '').slice(0, 400) })
    const emits = /defineEmits\s*(?:<([^>]+)>)?\s*\(/.exec(text)
    if (emits) components.push({ name: 'defineEmits', kind: 'emits', detail: (emits[1] || '').slice(0, 400) })
    // defineExpose 决定父组件能不能 ref 调用它，属"对外接口"而非内部实现
    if (/defineExpose\s*\(/.test(text)) components.push({ name: 'defineExpose', kind: 'expose' })
  }

  return { package: null, symbols, imports, components }
}

/** 拆 Vue SFC：script 按块抽取（行号要按块偏移校正），template 单独取组件引用。 */
export function extractVue(text) {
  const symbols = []
  const imports = []
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/g
  let m
  while ((m = re.exec(text))) {
    const bodyStart = m.index + m[0].indexOf('>') + 1
    // 行号校正：不补这一笔，所有 .vue 里的符号都会往上报到文件开头附近，
    // 点进去看到的是 import 行，人会以为索引坏了。
    const startLine = 1 + (text.slice(0, bodyStart).match(/\n/g) || []).length
    const out = extractScript(m[2])
    for (const sym of out.symbols) symbols.push({ ...sym, line: sym.line + startLine - 1 })
    for (const imp of out.imports) imports.push({ ...imp, line: imp.line + startLine - 1 })
  }

  const components = []
  const tpl = /<template>([\s\S]*)<\/template>/.exec(text)
  if (tpl) {
    // 模板里的大写标签 = 子组件引用；kebab-case 由调用方按文件名映射
    const tag = /<([A-Z][\w]*)/g
    let t
    const seen = new Set()
    while ((t = tag.exec(tpl[1]))) {
      if (seen.has(t[1])) continue
      seen.add(t[1])
      components.push({ name: t[1], kind: 'component' })
    }
  }
  // 组件契约：props / emits 是"这个页面怎么被用"的关键，单独留痕
  const props = /defineProps\s*(?:<([^>]+)>)?\s*\(/.exec(text)
  if (props) components.push({ name: 'defineProps', kind: 'props', detail: (props[1] || '').slice(0, 400) })
  const emits = /defineEmits\s*(?:<([^>]+)>)?\s*\(/.exec(text)
  if (emits) components.push({ name: 'defineEmits', kind: 'emits', detail: (emits[1] || '').slice(0, 400) })
  if (/defineExpose\s*\(/.test(text)) components.push({ name: 'defineExpose', kind: 'expose' })

  return { package: null, symbols, imports, components }
}

// ------------------------------------------------------------------ Python

export function extractPython(text) {
  const symbols = []
  const imports = []
  const lines = text.split(/\r?\n/)
  let currentClass = null

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    if (!raw.trim() || raw.trim().startsWith('#')) continue
    const indent = raw.length - raw.trimStart().length

    let m = /^(?:from\s+([\w.]+)\s+import\s+(.+)|import\s+([\w.]+))/.exec(raw.trim())
    if (m) {
      pushImport(imports, m[1] || m[3], 'import', text, 0)
      continue
    }
    m = /^class\s+([A-Za-z_]\w*)\s*(?:\(([^)]*)\))?/.exec(raw.trim())
    if (m) {
      symbols.push({ name: m[1], kind: 'class', line: i + 1, container: null, exported: !m[1].startsWith('_'), extends: m[2] ? m[2].split(',').map((s) => s.trim()).filter(Boolean) : [] })
      currentClass = indent === 0 ? m[1] : null
      continue
    }
    m = /^(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/.exec(raw.trim())
    if (m) {
      symbols.push({
        name: m[1], kind: currentClass && indent > 0 ? 'method' : 'function', line: i + 1,
        container: currentClass && indent > 0 ? currentClass : null,
        exported: !m[1].startsWith('_'),
        params: m[2].trim() ? m[2].split(',').length : 0,
      })
      continue
    }
    if (indent === 0 && !raw.startsWith(' ')) currentClass = null
  }

  return { package: null, symbols, imports, components: [] }
}

// ------------------------------------------------------------------ Go

export function extractGo(text) {
  const symbols = []
  const imports = []

  const block = /import\s*\(([\s\S]*?)\)/.exec(text)
  if (block) {
    const re = /"([^"]+)"/g
    let m
    while ((m = re.exec(block[1]))) pushImport(imports, m[1], 'import', text, 0)
  }
  const single = /\bimport\s+(?:[\w.]+\s+)?"([^"]+)"/g
  let sm
  while ((sm = single.exec(text))) pushImport(imports, sm[1], 'import', text, sm.index)

  const funcRe = /^func\s+(?:\(\s*\w*\s*\*?\s*([A-Za-z_]\w*)\s*\)\s*)?([A-Za-z_]\w*)\s*\(/gm
  let m
  while ((m = funcRe.exec(text))) {
    symbols.push({
      name: m[2], kind: m[1] ? 'method' : 'function', line: lineOf(text, m.index),
      container: m[1] || null,
      exported: /^[A-Z]/.test(m[2]),
    })
  }
  const typeRe = /^type\s+([A-Za-z_]\w*)\s+(struct|interface|func|map|\[)/gm
  while ((m = typeRe.exec(text))) {
    symbols.push({ name: m[1], kind: m[2] === 'struct' ? 'struct' : m[2] === 'interface' ? 'interface' : 'type', line: lineOf(text, m.index), container: null, exported: /^[A-Z]/.test(m[1]) })
  }
  return { package: null, symbols, imports, components: [] }
}

// ------------------------------------------------------------------ 统一入口

/** 按语言选抽取器。不认识的返回空结构，调用方不用判空。 */
export function extractFile(rel, text, lang) {
  switch (lang) {
    case 'java':
    case 'kotlin':
      return extractJava(text)
    case 'ts': case 'tsx': case 'js': case 'jsx': case 'dts':
      return extractScript(text)
    case 'vue':
    case 'svelte':
      return extractVue(text)
    case 'python':
      return extractPython(text)
    case 'go':
      return extractGo(text)
    default:
      return { package: null, symbols: [], imports: [], components: [] }
  }
}

/** 抽出"疑似被调用/引用的名字"，用于建呼叫边。只收名字，不收语义。 */
export function collectRefs(text) {
  const counts = new Map()
  const re = /([A-Za-z_$][\w$]*)\s*\(/g
  let m
  while ((m = re.exec(text))) {
    const name = m[1]
    if (KEYWORDS.has(name) || name.length < 2) continue
    counts.set(name, (counts.get(name) || 0) + 1)
  }
  // JSX / 模板里的大写标签也算引用（组件调用）
  const jsx = /<([A-Z][\w]*)[\s/>]/g
  while ((m = jsx.exec(text))) counts.set(m[1], (counts.get(m[1]) || 0) + 1)
  return counts
}

export { KEYWORDS }
