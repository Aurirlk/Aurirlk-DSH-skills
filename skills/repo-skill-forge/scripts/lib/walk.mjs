// 仓库遍历与语言判定。
// 只依赖 node 内置模块，任何装了 node >= 18 的机器都能跑，不需要 npm install。
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, extname, basename } from 'node:path'

/**
 * 默认忽略目录。
 * 只忽略"确定不是源码"的：构建产物、依赖缓存、IDE 元数据、日志、虚拟环境。
 * 拿不准的一律不忽略——宁可扫多了让用户用 --ignore 减，也不能默默漏掉源码。
 */
export const DEFAULT_IGNORE_DIRS = new Set([
  '.git', '.hg', '.svn',
  'node_modules', 'bower_components', 'jspm_packages',
  'dist', 'build', 'out', 'target', 'bin', 'obj', 'classes', 'release',
  'coverage', '.nyc_output', 'htmlcov',
  '.next', '.nuxt', '.output', '.svelte-kit', '.astro', '.vercel', '.netlify',
  'vendor', '.venv', 'venv', '__pycache__', '.pytest_cache', '.mypy_cache', '.ruff_cache', '.tox',
  '.idea', '.vscode', '.fleet', '.gradle', '.mvn', '.pnpm-store', '.yarn', '.turbo', '.cache', '.parcel-cache', '.eslintcache',
  '.vitepress', '.temp', '.umi', '.dumi', '.storybook-static', '.angular',
  'logs', 'tmp', 'temp', '.tmp',
  '.workbuddy', '.codex', '.claude',
  'Pods', 'DerivedData', '.dart_tool',
])

/** 扩展名 → 语言。这里只列"能抽符号"的语言；其余按文本配置处理。 */
const LANG_BY_EXT = {
  '.java': 'java',
  '.kt': 'kotlin', '.kts': 'kotlin',
  '.ts': 'ts', '.tsx': 'tsx', '.mts': 'ts', '.cts': 'ts',
  '.js': 'js', '.jsx': 'jsx', '.mjs': 'js', '.cjs': 'js',
  '.vue': 'vue', '.svelte': 'svelte',
  '.py': 'python',
  '.go': 'go',
  '.rb': 'ruby',
  '.php': 'php',
  '.cs': 'csharp',
  '.rs': 'rust',
  '.swift': 'swift',
  '.sql': 'sql',
  '.sh': 'shell', '.bash': 'shell', '.ps1': 'powershell',
  '.yml': 'yaml', '.yaml': 'yaml',
  '.json': 'json', '.jsonc': 'json',
  '.toml': 'toml', '.ini': 'ini', '.properties': 'properties',
  '.xml': 'xml', '.gradle': 'gradle',
  '.md': 'markdown', '.mdx': 'markdown',
  '.proto': 'proto',
  '.graphql': 'graphql', '.gql': 'graphql',
  '.tf': 'terraform',
  '.hcl': 'hcl',
  '.c': 'c', '.h': 'c', '.cpp': 'cpp', '.cc': 'cpp', '.hpp': 'cpp',
}

/** 能抽符号的语言（索引阶段只处理这些）。 */
export const INDEXABLE = new Set(['java', 'kotlin', 'ts', 'tsx', 'js', 'jsx', 'vue', 'svelte', 'python', 'go', 'ruby', 'php', 'csharp', 'rust'])

/** 纯文本、可以安全按 UTF-8 读的语言。二进制扩展名不在表里，直接跳过。 */
export function detectLang(relPath) {
  const name = basename(relPath).toLowerCase()
  // .d.ts 单独标出来：它是类型声明，不是实现，统计口径要区分
  if (name.endsWith('.d.ts')) return 'dts'
  const ext = extname(name)
  return LANG_BY_EXT[ext] || null
}

/** 判断是不是测试代码。宁可多认几种命名，也不想把测试算进生产代码。 */
export function isTestPath(relPath) {
  const p = '/' + relPath.replace(/\\/g, '/')
  if (/\/(src\/)?test\//i.test(p) || /\/tests?\//i.test(p) || /__tests__/i.test(p) || /\/spec\//i.test(p)) return true
  if (/\.(spec|test|e2e|cy)\.(ts|tsx|js|jsx|mjs|cjs|vue)$/i.test(p)) return true
  if (/(Test|Tests|IT|TestCase)\.(java|kt|cs)$/i.test(p)) return true
  if (/_test\.go$/.test(p)) return true
  if (/(^|\/)test_[^/]+\.py$/.test(p)) return true
  return false
}

/** 字节级数行数 —— 比 split('\n') 省一个数量级的内存，也快。 */
export function countLines(buf) {
  if (!buf || buf.length === 0) return 0
  let n = 0
  for (let i = 0; i < buf.length; i++) if (buf[i] === 0x0a) n++
  if (buf[buf.length - 1] !== 0x0a) n++
  return n
}

/**
 * 遍历仓库。
 *
 * 用显式栈而不是递归：深层目录（生成的嵌套包结构）递归容易爆栈。
 * 不跟随符号链接——仓库里的软链指到仓库外是常见的事，跟进去会扫到系统目录。
 *
 * @param {string} root 仓库根（绝对路径）
 * @param {{ignore?: Set<string>, maxFiles?: number, maxFileBytes?: number}} opts
 * @returns {{files: Array<{rel: string, abs: string, lang: string|null, size: number, lines: number, test: boolean}>, skipped: {binary: number, huge: number, truncated: boolean, ignored: number}}}
 */
export function walkRepo(root, opts = {}) {
  const ignore = opts.ignore ?? DEFAULT_IGNORE_DIRS
  const maxFiles = opts.maxFiles ?? 40000
  const maxFileBytes = opts.maxFileBytes ?? 1_500_000

  const files = []
  const skipped = { binary: 0, huge: 0, truncated: false, ignored: 0 }
  const stack = ['']

  while (stack.length) {
    if (files.length >= maxFiles) { skipped.truncated = true; break }
    const relDir = stack.pop()
    const absDir = relDir ? join(root, relDir) : root
    let entries
    try {
      entries = readdirSync(absDir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const e of entries) {
      const rel = relDir ? relDir + '/' + e.name : e.name
      if (e.isSymbolicLink()) { skipped.ignored++; continue }
      if (e.isDirectory()) {
        if (ignore.has(e.name)) { skipped.ignored++; continue }
        stack.push(rel)
        continue
      }
      if (!e.isFile()) continue

      const lang = detectLang(rel)
      // 没有语言的（二进制、图片、字体、jar）直接跳过，但计数留着，报告里要说清扫了什么
      if (!lang) { skipped.binary++; continue }

      const abs = join(root, rel)
      let st
      try { st = statSync(abs) } catch { continue }
      if (st.size > maxFileBytes) { skipped.huge++; continue }

      // 打包产物：hash 文件名 + 在 assets 目录里（或本身就是压缩单行）。
      // 只看 hash 会误杀 normal-abcdef.js 这种人写的文件，加目录/单行两个条件才安全。
      const name = basename(rel)
      const hashed = /[.-][A-Za-z0-9_-]{6,}\.(?:js|css|mjs|cjs)$/.test(name)
      if (hashed && /(^|\/)(assets|static|public|dist|build)\//i.test('/' + rel)) { skipped.bundles = (skipped.bundles || 0) + 1; continue }

      let lines = 0
      try {
        const buf = readFileSync(abs)
        // 含 NUL 字节的按二进制处理（有些人把图片改成 .ts 之类的怪情况）
        const probeLen = Math.min(buf.length, 4096)
        let isBinary = false
        for (let i = 0; i < probeLen; i++) if (buf[i] === 0) { isBinary = true; break }
        if (isBinary) { skipped.binary++; continue }
        lines = countLines(buf)
      } catch {
        continue
      }

      files.push({ rel, abs, lang, size: st.size, lines, test: isTestPath(rel) })
    }
  }

  files.sort((a, b) => (a.rel < b.rel ? -1 : 1))
  return { files, skipped }
}

/** 安全读文本：截断超长文件，避免一个压缩过的产物把内存吃掉。 */
export function readText(abs, maxBytes = 1_500_000) {
  const buf = readFileSync(abs)
  const slice = buf.length > maxBytes ? buf.subarray(0, maxBytes) : buf
  return slice.toString('utf8')
}

/** 统一成 POSIX 风格的相对路径，Windows 上也不会出现反斜杠。 */
export function toPosix(p) {
  return p.replace(/\\/g, '/')
}
