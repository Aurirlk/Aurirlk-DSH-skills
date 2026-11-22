#!/usr/bin/env node
// 仓库事实扫描器。
//
// 定位：只产出**可核对的事实**，不产出判断和文风。
// 每条事实都带 `source`（哪个文件、哪一行），因为一份没有出处的仓库说明
// 等于让下一个人重新猜一遍。
//
// 用法：
//   node scan-repo.mjs <仓库路径> [--out <输出目录>] [--ignore a,b] [--name 名字]
// 产出：
//   <out>/facts.json   机器读（emit-skills 消费）
//   <out>/FACTS.md     人读（事实摘要，也是核对扫描准不准的地方）
import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { walkRepo, readText, INDEXABLE, DEFAULT_IGNORE_DIRS } from './lib/walk.mjs'
import { extractFile } from './lib/extract.mjs'

// ------------------------------------------------------------------ 参数

function parseArgs(argv) {
  const args = { root: null, out: null, ignore: [], name: null, maxFiles: 40000, quiet: false }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--out') args.out = argv[++i]
    else if (a === '--ignore') args.ignore.push(...String(argv[++i]).split(',').map((s) => s.trim()).filter(Boolean))
    else if (a === '--name') args.name = argv[++i]
    else if (a === '--max-files') args.maxFiles = parseInt(argv[++i], 10) || 40000
    else if (a === '--quiet') args.quiet = true
    else if (a === '-h' || a === '--help') { console.log('node scan-repo.mjs <repo> [--out dir] [--ignore a,b] [--name slug]'); process.exit(0) }
    else if (!a.startsWith('-')) args.root = a
  }
  if (!args.root) { console.error('缺少仓库路径。用法：node scan-repo.mjs <repo> [--out dir]'); process.exit(2) }
  args.root = resolve(args.root)
  args.out = resolve(args.out || join(process.cwd(), 'repo-facts'))
  return args
}

const args = parseArgs(process.argv)
if (!existsSync(args.root)) { console.error(`路径不存在：${args.root}`); process.exit(2) }

const warn = (msg) => { if (!args.quiet) console.error(`[scan] ${msg}`) }
const posix = (p) => p.replace(/\\/g, '/')

// ------------------------------------------------------------------ 遍历

// --ignore 只做"加法"：默认忽略项是安全底线（node_modules / target 里没有源码），
// 想扫被默认忽略的目录，用 --include（这里留了位置，但故意不给默认项开后门）。
const extraIgnore = new Set(args.ignore)
const ignore = new Set([...DEFAULT_IGNORE_DIRS, ...extraIgnore])

warn(`扫描 ${args.root}`)
const walkStart = Date.now()
const { files, skipped } = walkRepo(args.root, { ignore, maxFiles: args.maxFiles })
warn(`发现 ${files.length} 个可读文件，跳过 ${skipped.binary} 个非文本 / ${skipped.huge} 个超大文件，耗时 ${Date.now() - walkStart}ms`)

const byLang = new Map()
for (const f of files) {
  if (!f.lang) continue
  const cur = byLang.get(f.lang) || { lang: f.lang, files: 0, loc: 0, tests: 0 }
  cur.files++
  cur.loc += f.lines
  if (f.test) cur.tests++
  byLang.set(f.lang, cur)
}
const languages = [...byLang.values()].sort((a, b) => b.loc - a.loc)

// ------------------------------------------------------------------ 元信息

function git(cmd) {
  try { return execSync(`git -C "${args.root}" ${cmd}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() } catch { return null }
}

const pkgJson = (() => {
  const p = join(args.root, 'package.json')
  if (!existsSync(p)) return null
  try { return JSON.parse(readFileSync(p, 'utf8')) } catch { return null }
})()

function slugify(s) {
  return String(s).toLowerCase().replace(/^@[^/]+\//, '').replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'repo'
}

const repoName = args.name || slugify(pkgJson?.name || basename(args.root))
const meta = {
  name: repoName,
  root: args.root,
  dirName: basename(args.root),
  scannedAt: new Date().toISOString(),
  git: { head: git('rev-parse --short HEAD'), branch: git('rev-parse --abbrev-ref HEAD'), lastCommitDate: git('log -1 --format=%cs') },
  totals: {
    files: files.length,
    sourceFiles: files.filter((f) => INDEXABLE.has(f.lang || '')).length,
    loc: files.reduce((a, f) => a + f.lines, 0),
    sourceLoc: files.filter((f) => INDEXABLE.has(f.lang || '') && !f.test).reduce((a, f) => a + f.lines, 0),
    testLoc: files.filter((f) => INDEXABLE.has(f.lang || '') && f.test).reduce((a, f) => a + f.lines, 0),
  },
}

// ------------------------------------------------------------------ 清单解析

function readIf(rel) {
  const p = join(args.root, rel)
  if (!existsSync(p)) return null
  try { return readFileSync(p, 'utf8') } catch { return null }
}

/** Maven pom：模块、坐标、依赖。用正则而不是 XML 解析——pom 里的 namespace 变体太多，正则在这是更稳的。 */
function parsePom(xml) {
  // 子 pom 的第一段一定是 <parent>，里面也有 <artifactId>。
  // 不剥掉它，所有子模块都会被叫成父工程的名字（这个 bug 真的出现过，
  // 表现是模块清单里五行同一个名字，看起来"扫到了"其实全是错的）。
  const body = xml.replace(/<parent>[\s\S]*?<\/parent>/, '')
  const head = body.split(/<dependencies>|<dependencyManagement>|<build>|<profiles>|<modules>/)[0]
  const one = (tag) => {
    const m = new RegExp(`<${tag}>\\s*([^<]+?)\\s*</${tag}>`).exec(head)
    return m ? m[1].trim() : null
  }
  const modulesBlock = /<modules>([\s\S]*?)<\/modules>/.exec(body)
  const modules = modulesBlock
    ? [...modulesBlock[1].matchAll(/<module>\s*([^<]+?)\s*<\/module>/g)].map((m) => m[1].trim())
    : []
  const depsBlock = /<dependencies>([\s\S]*?)<\/dependencies>/.exec(body)
  const deps = depsBlock
    ? [...depsBlock[1].matchAll(/<dependency>([\s\S]*?)<\/dependency>/g)]
        .map((m) => {
          const g = /<groupId>\s*([^<]+?)\s*<\/groupId>/.exec(m[1])
          const a = /<artifactId>\s*([^<]+?)\s*<\/artifactId>/.exec(m[1])
          return g && a ? `${g[1]}:${a[1]}` : null
        })
        .filter(Boolean)
    : []
  const packaging = one('packaging')
  return { artifactId: one('artifactId'), groupId: one('groupId'), version: one('version'), name: one('name'), modules, deps: [...new Set(deps)], packaging }
}

function parseGradle(file) {
  const txt = readIf(file) || ''
  const deps = [...txt.matchAll(/(?:implementation|api|compileOnly|runtimeOnly|testImplementation)\s+['"]([^'"]+)['"]/g)].map((m) => m[1])
  return { deps: [...new Set(deps)] }
}

const modules = []
const seenModulePaths = new Set()

function addModule(m) {
  const key = posix(m.path)
  if (seenModulePaths.has(key)) return
  seenModulePaths.add(key)
  modules.push(m)
}

// Maven 多模块
const rootPomRel = 'pom.xml'
const rootPom = readIf(rootPomRel)
if (rootPom) {
  const pom = parsePom(rootPom)
  const rootModule = {
    name: pom.artifactId || meta.dirName, path: '', kind: 'maven', manifest: rootPomRel,
    artifact: pom.artifactId, version: pom.version, deps: pom.deps, declaredModules: pom.modules,
  }
  addModule(rootModule)
  for (const sub of pom.modules) {
    const rel = posix(sub).replace(/\/$/, '')
    const subPom = readIf(join(rel, 'pom.xml'))
    const parsed = subPom ? parsePom(subPom) : { deps: [], artifactId: basename(rel) }
    addModule({
      name: parsed.artifactId || basename(rel), path: rel, kind: 'maven', manifest: join(rel, 'pom.xml').replace(/\\/g, '/'),
      artifact: parsed.artifactId, version: parsed.version, deps: parsed.deps, declaredModules: [],
    })
  }
} else {
  // 没有聚合 pom：把每个带 pom 的目录当一个模块（限 3 层，避免扫进模板工程）
  const poms = files.filter((f) => f.rel.endsWith('pom.xml') && f.rel.split('/').length <= 4)
  for (const f of poms) {
    const rel = dirname(f.rel) === '.' ? '' : dirname(f.rel)
    const parsed = parsePom(readIf(f.rel) || '')
    addModule({ name: parsed.artifactId || basename(rel) || meta.dirName, path: posix(rel), kind: 'maven', manifest: f.rel, artifact: parsed.artifactId, version: parsed.version, deps: parsed.deps, declaredModules: parsed.modules })
  }
}

// npm / pnpm workspaces
if (pkgJson) {
  const ws = pkgJson.workspaces
  const patterns = Array.isArray(ws) ? ws : ws?.packages || []
  const expanded = []
  for (const pat of patterns) {
    const clean = String(pat).replace(/\/\*+$/, '').replace(/\/$/, '')
    if (clean.includes('*')) continue
    expanded.push(clean)
  }
  const rootPkgModule = { name: pkgJson.name || meta.dirName, path: '', kind: 'npm', manifest: 'package.json', deps: Object.keys(pkgJson.dependencies || {}), devDeps: Object.keys(pkgJson.devDependencies || {}), declaredModules: expanded }
  if (!modules.length) addModule(rootPkgModule)
  else if (!modules.some((m) => m.path === '')) addModule(rootPkgModule)
  for (const dir of expanded) {
    const pj = readIf(join(dir, 'package.json'))
    let parsed = null
    try { parsed = pj ? JSON.parse(pj) : null } catch { parsed = null }
    addModule({ name: parsed?.name || basename(dir), path: posix(dir), kind: 'npm', manifest: join(dir, 'package.json').replace(/\\/g, '/'), deps: Object.keys(parsed?.dependencies || {}), devDeps: Object.keys(parsed?.devDependencies || {}), declaredModules: [] })
  }
}

// Gradle
const settingsGradle = readIf('settings.gradle') || readIf('settings.gradle.kts')
if (settingsGradle) {
  const inc = [...settingsGradle.matchAll(/include\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1].replace(/^:/, '').replace(/:/g, '/'))
  for (const dir of inc) {
    addModule({ name: basename(dir), path: posix(dir), kind: 'gradle', manifest: 'build.gradle', deps: parseGradle('build.gradle').deps, declaredModules: [] })
  }
  if (!modules.length) addModule({ name: meta.dirName, path: '', kind: 'gradle', manifest: 'build.gradle', deps: parseGradle('build.gradle').deps, declaredModules: inc })
}

// Go
const goMod = readIf('go.mod')
if (goMod) {
  const modName = /^module\s+(\S+)/m.exec(goMod)?.[1] || meta.dirName
  addModule({ name: modName, path: '', kind: 'go', manifest: 'go.mod', deps: [...goMod.matchAll(/^\s*([\w.\-/]+)\s+v[\w.\-+]+/gm)].map((m) => m[1]), declaredModules: [] })
}

// Python
if (!modules.length) {
  for (const f of ['pyproject.toml', 'setup.py', 'requirements.txt']) {
    if (existsSync(join(args.root, f))) {
      addModule({ name: pkgJson?.name || meta.dirName, path: '', kind: 'python', manifest: f, deps: [], declaredModules: [] })
      break
    }
  }
}

// 兜底：按"含源码的顶层目录"分模块
if (!modules.length) {
  const topDirs = new Map()
  for (const f of files) {
    if (!INDEXABLE.has(f.lang || '') || !f.rel.includes('/')) continue
    const top = f.rel.split('/')[0]
    topDirs.set(top, (topDirs.get(top) || 0) + 1)
  }
  addModule({ name: meta.dirName, path: '', kind: 'dir', manifest: null, deps: [], declaredModules: [...topDirs.keys()] })
  for (const [dir, count] of topDirs) {
    if (count < 3) continue
    addModule({ name: dir, path: dir, kind: 'dir', manifest: null, deps: [], declaredModules: [] })
  }
}

// 把文件归到最长前缀匹配的模块
const sortedModules = [...modules].sort((a, b) => b.path.length - a.path.length)
for (const m of modules) {
  m.files = 0; m.loc = 0; m.testFiles = 0; m.testLoc = 0; m.languages = {}
  m.entrypoints = []; m.endpoints = 0; m.entities = 0
}
for (const f of files) {
  if (!INDEXABLE.has(f.lang || '')) continue
  const owner = sortedModules.find((m) => m.path === '' || f.rel === m.path || f.rel.startsWith(m.path + '/'))
  if (!owner) continue
  owner.files++
  owner.loc += f.lines
  if (f.test) { owner.testFiles++; owner.testLoc += f.lines }
  owner.languages[f.lang] = (owner.languages[f.lang] || 0) + f.lines
}
for (const m of modules) {
  m.languages = Object.entries(m.languages).sort((a, b) => b[1] - a[1]).map(([lang, loc]) => ({ lang, loc }))
}

// 模块间依赖（仓库内坐标匹配）
const artifactIndex = new Map()
for (const m of modules) if (m.artifact) artifactIndex.set(m.artifact, m)
for (const m of modules) {
  m.intraDeps = []
  for (const dep of m.deps || []) {
    const artifact = dep.includes(':') ? dep.split(':')[1] : dep
    const target = artifactIndex.get(artifact)
    if (target && target !== m) m.intraDeps.push(target.name)
  }
}

// ------------------------------------------------------------------ 命令（带出处）

const lockfiles = ['pnpm-lock.yaml', 'yarn.lock', 'package-lock.json', 'bun.lockb', 'bun.lock'].filter((f) => existsSync(join(args.root, f)))
const pm = lockfiles.includes('pnpm-lock.yaml') ? 'pnpm' : lockfiles.includes('yarn.lock') ? 'yarn' : lockfiles.includes('bun.lockb') || lockfiles.includes('bun.lock') ? 'bun' : lockfiles.length ? 'npm' : (pkgJson ? 'npm' : null)
const hasMvnw = existsSync(join(args.root, 'mvnw')) || existsSync(join(args.root, 'mvnw.cmd'))
const hasGradlew = existsSync(join(args.root, 'gradlew')) || existsSync(join(args.root, 'gradlew.bat'))
const mvn = hasMvnw ? './mvnw' : 'mvn'
const gradle = hasGradlew ? './gradlew' : 'gradle'

const commands = []
const addCmd = (id, label, cmd, source, confidence, detail) => commands.push({ id, label, cmd, source, confidence, ...(detail ? { detail } : {}) })

if (pkgJson?.scripts) {
  const scriptIds = ['dev', 'start', 'build', 'test', 'lint', 'typecheck', 'type-check', 'format', 'e2e']
  for (const key of Object.keys(pkgJson.scripts)) {
    if (!scriptIds.includes(key) && !/^(test|build|lint|check)/.test(key)) continue
    const run = key === 'start' || key === 'test' ? `${pm} ${key}` : `${pm} run ${key}`
    addCmd(key, `package.json scripts.${key}`, run, 'package.json scripts.' + key, 'declared', pkgJson.scripts[key])
  }
}
if (rootPom || modules.some((m) => m.kind === 'maven')) {
  addCmd('build', '编译打包', `${mvn} -q -DskipTests package`, 'pom.xml（源码报告：Maven 标准生命周期）', 'convention')
  addCmd('test', '跑测试', `${mvn} -q test`, 'pom.xml（源码报告：Maven surefire）', 'convention')
  addCmd('verify', '完整校验', `${mvn} -q verify`, 'pom.xml（源码报告：Maven verify 阶段）', 'convention')
}
if (modules.some((m) => m.kind === 'gradle')) {
  addCmd('build', '编译打包', `${gradle} build`, 'settings.gradle（Gradle 标准任务）', 'convention')
  addCmd('test', '跑测试', `${gradle} test`, 'settings.gradle（Gradle 标准任务）', 'convention')
}
if (goMod) {
  addCmd('build', '编译', 'go build ./...', 'go.mod', 'convention')
  addCmd('test', '跑测试', 'go test ./...', 'go.mod', 'convention')
  addCmd('vet', '静态检查', 'go vet ./...', 'go.mod', 'convention')
}
if (modules.some((m) => m.kind === 'python')) {
  const hasPytest = files.some((f) => f.rel.endsWith('conftest.py')) || existsSync(join(args.root, 'pytest.ini')) || (readIf('pyproject.toml') || '').includes('pytest')
  addCmd('test', '跑测试', hasPytest ? 'pytest -q' : 'python -m unittest', hasPytest ? 'pytest 配置/约定' : 'Python 标准库', 'convention')
  if (existsSync(join(args.root, 'ruff.toml')) || (readIf('pyproject.toml') || '').includes('ruff')) addCmd('lint', '静态检查', 'ruff check .', 'ruff 配置', 'declared')
}

// ------------------------------------------------------------------ 逐文件特征扫描

const entrypoints = []
const httpEndpoints = []
const uiRoutes = []
const entities = []
const configKeys = new Map()
const todos = []
const markers = { any: 0, console: 0, todo: 0, fixme: 0, hack: 0, dangerWillRobinson: 0 }
let commentLines = 0
let cjkCommentLines = 0

const SECRET_KEY = /(password|passwd|secret|token|api[_-]?key|apikey|private[_-]?key|credential|access[_-]?key|dsn|connection[_-]?string)/i

// 示例代码、文档里贴的代码、脚本工具目录 —— 都不是"这个产品的行为"。
// 把它们算进端点/实体清单，会让 dev-guide 一开始就撒谎（实测：仓库自带技能里的
// controller-example.java 会贡献 8 个根本不存在的 /api/users 端点）。
const SAMPLE_PATH = /(^|\/)(docs?|\.agents|\.vitepress|examples?|samples?|demos?|fixtures?|__fixtures__|__mocks__|script|scripts|tools|benchmarks?)\//i
const scopeOf = (f) => (f.test ? 'test' : SAMPLE_PATH.test(f.rel) ? 'sample' : 'production')

function addConfigKey(key, source, extra = {}) {
  const k = key.trim()
  if (!k) return
  const prev = configKeys.get(k) || { key: k, sources: [], secret: SECRET_KEY.test(k) }
  if (!prev.sources.includes(source)) prev.sources.push(source)
  if (extra.kind) prev.kind = extra.kind
  configKeys.set(k, prev)
}

const javaPkgToFile = new Map()
const javaConsts = new Map()   // String CONST = "字面量"；跨文件解析用
const rawSpring = []           // 未解析的 spring 端点原文

for (const f of files) {
  if (!INDEXABLE.has(f.lang || '')) continue
  let text
  try { text = readText(f.abs, 800_000) } catch { continue }
  const lines = text.split(/\r?\n/)
  const ext = extractFile(f.rel, text, f.lang)
  const scope = scopeOf(f)

  // 压缩/打包产物：单行几十万字符，抽符号只会产出垃圾节点
  if ((f.lang === 'js' || f.lang === 'ts') && f.lines <= 3 && f.size > 20000) {
    skipped.minified = (skipped.minified || 0) + 1
    continue
  }

  // 包名 → 文件，用于 Java 导入解析
  if (ext.package) javaPkgToFile.set(ext.package + '.' + basename(f.rel).replace(/\.[^.]+$/, ''), f.rel)

  // 入口点
  if (f.lang === 'java' || f.lang === 'kotlin') {
    if (/@SpringBootApplication|public\s+static\s+void\s+main\s*\(/.test(text)) {
      const line = lines.findIndex((l) => /@SpringBootApplication|public\s+static\s+void\s+main\s*\(/.test(l)) + 1
      entrypoints.push({ kind: 'java-main', file: f.rel, line, scope, detail: /@SpringBootApplication/.test(text) ? 'Spring Boot 启动类' : 'main 方法' })
    }
  }
  if (/^(ts|tsx|js|jsx|vue)$/.test(f.lang || '')) {
    if (/createApp\s*\(/.test(text) && /\.mount\s*\(/.test(text)) {
      entrypoints.push({ kind: 'frontend-boot', file: f.rel, line: lines.findIndex((l) => /createApp\s*\(/.test(l)) + 1, scope, detail: 'Vue 应用挂载' })
    }
    if (/createServer\s*\(|\.listen\s*\(/.test(text) && /^(ts|js)$/.test(f.lang)) {
      entrypoints.push({ kind: 'node-server', file: f.rel, line: lines.findIndex((l) => /createServer\s*\(|\.listen\s*\(/.test(l)) + 1, scope, detail: 'Node HTTP 服务' })
    }
  }

  // HTTP 端点：Java 注解。
  // 这里**不解析路径表达式**，只记原文——真实项目里 base path 常常是常量
  // （@RequestMapping(XxxConstants.GATEWAY_PATH)）。如果在文件内即时解析，
  // 常量还没被读到，结果是整份端点清单丢掉前缀（`/config` 而不是 `/api/agent/chat/config`）。
  // 所以先收集原文，全部文件读完后统一解析。
  // 常量表要扫**所有** java 文件，不能只在控制器里找：
  // 常量类（XxxConstants）没有 @RestController，但它定义的值正是别处的路径前缀。
  if (f.lang === 'java' || f.lang === 'kotlin') {
    // 值可能是字面量，也可能是别的常量拼出来的（PREFIX + "/agents"），
    // 所以存原文，解析时递归展开。只存字面量会让一整类前缀解析失败。
    // 注意 interface 里的常量没有 static final 修饰符（隐式），
    // 只认 static final 会漏掉整个 XxxConstants 接口 —— 那是路径前缀最常放的地方。
    const cre = /(?:^|[;{}])\s*(?:(?:public|private|protected)\s+)?(?:(?:static|final)\s+){0,2}String\s+([A-Z][A-Z0-9_]{1,60})\s*=\s*(["\w.][^;]{0,300});/gm
    let cst
    while ((cst = cre.exec(text))) if (!javaConsts.has(cst[1])) javaConsts.set(cst[1], cst[2].trim())
  }

  if ((f.lang === 'java' || f.lang === 'kotlin') && /@(RestController|Controller)\b/.test(text)) {

    const classIdx = lines.findIndex((l) => /^\s*(?:public\s+)?(?:final\s+|abstract\s+)?class\s+[A-Za-z_$]/.test(l))
    if (classIdx >= 0) {
      const className = /\bclass\s+([A-Za-z_$][\w$]*)/.exec(lines[classIdx])[1]
      let baseExpr = ''
      for (let i = classIdx - 1; i >= Math.max(0, classIdx - 8); i--) {
        const rm = /@RequestMapping\s*\(([^)]*)\)/.exec(lines[i])
        if (rm) { baseExpr = firstArgExpr(rm[1]); break }
        if (!lines[i].trim()) continue
        if (!/^\s*@/.test(lines[i])) break
      }

      let pending = null
      for (let i = classIdx; i < lines.length; i++) {
        const line = lines[i]
        const mm = /^\s*@(Get|Post|Put|Delete|Patch)Mapping\b/.exec(line)
        const rmx = /^\s*@RequestMapping\b/.exec(line)
        if (mm || rmx) {
          // 注解可能跨行（value 后面跟 produces 换行），拼到括号配平为止
          let ann = line.trim()
          let j = i
          while (!parensBalanced(ann) && j + 1 < lines.length) { j++; ann += ' ' + lines[j].trim() }
          // 裸注解 @PostMapping（不带括号）在真实项目里很常见，直接 slice 会切出 "@PostMappin"
          const args = ann.includes('(') ? ann.slice(ann.indexOf('(') + 1, ann.lastIndexOf(')')) : ''
          if (mm) pending = { method: mm[1].toUpperCase(), exprs: pathExprs(args), line: i + 1 }
          else {
            const mAttr = /method\s*=\s*(?:\{[^}]*)?(?:RequestMethod\.)?([A-Z]+)/.exec(args)
            pending = { method: mAttr ? mAttr[1] : 'ANY', exprs: pathExprs(args), line: i + 1 }
          }
          i = j
          continue
        }
        if (pending) {
          if (/^\s*\}\s*$/.test(line)) { pending = null; continue }
          if (/^\s*(?:\/\/|\*|@)/.test(line)) continue
          const meth = /^\s*(?:public|protected|private)?\s*(?:static\s+)?[\w<>\[\],.?\s]+\s+([A-Za-z_$][\w$]*)\s*\(/.exec(line)
          if (meth) {
            for (const expr of pending.exprs) {
              rawSpring.push({ method: pending.method, baseExpr, pathExpr: expr, handler: className + '#' + meth[1], file: f.rel, line: pending.line, scope })
            }
            pending = null
          }
        }
      }
    }
  }

  // HTTP 端点：Express / Koa / Fastify 风格
  if (/^(ts|js)$/.test(f.lang || '')) {
    const re = /\b(?:router|app|server|api|route)\s*\.\s*(get|post|put|delete|patch|all)\s*\(\s*['"`]([^'"`]+)['"`]/g
    let m
    while ((m = re.exec(text))) {
      httpEndpoints.push({ method: m[1].toUpperCase(), path: m[2], handler: '(匿名 handler)', file: f.rel, line: countLinesBefore(text, m.index), framework: 'express-like', scope })
    }
  }
  // FastAPI / Flask
  if (f.lang === 'python') {
    const re = /@\s*(?:app|router|bp|blueprint)\s*\.\s*(get|post|put|delete|patch|route)\s*\(\s*['"]([^'"]+)['"]/g
    let m
    while ((m = re.exec(text))) {
      httpEndpoints.push({ method: m[1] === 'route' ? 'GET' : m[1].toUpperCase(), path: m[2], handler: 'module-level', file: f.rel, line: countLinesBefore(text, m.index), framework: 'fastapi/flask', scope })
    }
  }

  // 前端路由（Vue Router 记录）
  if (/^(ts|js)$/.test(f.lang || '') && /(router|routes)/i.test(f.rel) && /\bpath\s*:/.test(text)) {
    const re = /\{\s*path\s*:\s*['"]([^'"]+)['"][\s\S]{0,200}?name\s*:\s*['"]([^'"]+)['"]/g
    let m
    while ((m = re.exec(text))) {
      uiRoutes.push({ path: m[1], name: m[2], file: f.rel, line: countLinesBefore(text, m.index), scope })
    }
    if (!uiRoutes.length) {
      const re2 = /path\s*:\s*['"]([^'"]+)['"]/g
      while ((m = re2.exec(text))) uiRoutes.push({ path: m[1], name: null, file: f.rel, line: countLinesBefore(text, m.index), scope })
    }
  }

  // 数据模型
  if ((f.lang === 'java' || f.lang === 'kotlin') && /@Entity|@TableName|@Document\b/.test(text)) {
    for (const s of ext.symbols) {
      if (s.kind !== 'class') continue
      const idx = text.indexOf(s.name)
      const around = text.slice(Math.max(0, idx - 400), idx + 200)
      const table = /@TableName\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']/.exec(around)?.[1]
        || /@Table\s*\([^)]*name\s*=\s*["']([^"']+)["']/.exec(around)?.[1]
        || s.name.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase()
      if (/@Entity|@TableName|@Document\b/.test(around)) entities.push({ name: s.name, table, file: f.rel, line: s.line, source: '@Entity/@TableName', scope })
    }
  }
  if (f.rel.endsWith('.sql')) {
    const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"[]?([\w.]+)[`"\]]?/gi
    let m
    while ((m = re.exec(text))) entities.push({ name: m[1], table: m[1], file: f.rel, line: countLinesBefore(text, m.index), source: 'DDL', scope })
  }
  if (f.rel.endsWith('.prisma')) {
    const re = /^\s*model\s+(\w+)\s*\{/gm
    let m
    while ((m = re.exec(text))) entities.push({ name: m[1], table: null, file: f.rel, line: countLinesBefore(text, m.index), source: 'prisma', scope })
  }
  if (/^(ts|js)$/.test(f.lang || '') && /\bpgTable\s*\(/.test(text)) {
    const re = /(?:const|export\s+const)\s+(\w+)\s*=\s*pgTable\s*\(\s*['"]([^'"]+)['"]/g
    let m
    while ((m = re.exec(text))) entities.push({ name: m[1], table: m[2], file: f.rel, line: countLinesBefore(text, m.index), source: 'drizzle', scope })
  }

  // 配置键：@ConfigurationProperties / @Value
  if (f.lang === 'java' || f.lang === 'kotlin') {
    const cp = scope === 'production' ? /@ConfigurationProperties\s*\(\s*(?:prefix\s*=\s*)?["']([^"']+)["']/g : null
    let m
    if (cp) while ((m = cp.exec(text))) addConfigKey(m[1] + '.*', f.rel, { kind: 'config-props' })
    const v = scope === 'production' ? /@Value\s*\(\s*["']\$\{([^}:]+)/g : null
    if (v) while ((m = v.exec(text))) addConfigKey(m[1], f.rel, { kind: 'value' })
  }
  // 前端环境变量引用
  if (/^(ts|tsx|js|jsx|vue)$/.test(f.lang || '')) {
    const re = /import\.meta\.env\.(\w+)/g
    let m
    while ((m = re.exec(text))) addConfigKey(m[1], f.rel, { kind: 'vite-env' })
  }

  // 技术债与风格信号（只统计源码，不统计测试和文档）
  if (!f.test && /^(java|kotlin|ts|tsx|js|jsx|vue)$/.test(f.lang || '')) {
    const anyCount = (text.match(/:\s*any\b|\bas\s+any\b|<any>/g) || []).length
    const consoleCount = (text.match(/\bconsole\.(log|debug|info)\s*\(/g) || []).length
    markers.any += anyCount
    markers.console += consoleCount
    const todoRe = /\b(TODO|FIXME|HACK|XXX)\b/g
    let tm
    while ((tm = todoRe.exec(text))) {
      const kind = tm[1].toLowerCase()
      markers[kind === 'xxx' ? 'dangerWillRobinson' : kind] = (markers[kind === 'xxx' ? 'dangerWillRobinson' : kind] || 0) + 1
      const ln = countLinesBefore(text, tm.index)
      const snippet = (lines[ln - 1] || '').trim().slice(0, 120)
      todos.push({ kind: tm[1], file: f.rel, line: ln, snippet })
    }
    for (const line of lines) {
      const t = line.trim()
      if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('#')) {
        commentLines++
        if (/[\u4e00-\u9fa5]/.test(t)) cjkCommentLines++
      }
    }
  }
}

function countLinesBefore(text, index) {
  let n = 1
  for (let i = 0; i < index && i < text.length; i++) if (text.charCodeAt(i) === 10) n++
  return n
}

// ------------------------------------------------------------------ 解析 spring 端点表达式

/** 取括号内的第一个参数表达式，去掉 value = / path = 前缀与后续 attributes。 */
function firstArgExpr(args) {
  let a = String(args).trim()
  const kv = /^(?:value|path)\s*=\s*([\s\S]+)$/.exec(a)
  if (kv) a = kv[1].trim()
  a = a.split(/,\s*(?=[a-zA-Z_]+\s*=)/)[0].trim()
  if (!a || /^[a-zA-Z_]+\s*=/.test(a)) return ''
  if (a.startsWith('{')) return a.slice(1, a.lastIndexOf('}')).split(',')[0].trim()
  return a
}

/** 一条注解里的全部 path 表达式（@GetMapping({"/a","/b"}) 会出两条）。 */
function pathExprs(args) {
  let a = String(args || '').trim()
  const kv = /^(?:value|path)\s*=\s*([\s\S]+)$/.exec(a)
  if (kv) a = kv[1].trim()
  a = a.split(/,\s*(?=[a-zA-Z_]+\s*=)/)[0].trim()
  if (!a || /^[a-zA-Z_]+\s*=/.test(a)) return ['""']
  if (a.startsWith('{')) {
    const inner = a.slice(1, a.lastIndexOf('}'))
    const parts = inner.split(',').map((x) => x.trim()).filter(Boolean)
    return parts.length ? parts : ['""']
  }
  return [a]
}

function parensBalanced(str) {
  let d = 0
  for (const ch of str) { if (ch === '(') d++; else if (ch === ')') d-- }
  return d <= 0
}

/** 按引号外的 + 切分字符串拼接表达式。 */
function splitConcat(expr) {
  const out = []
  let cur = ''
  let quote = null
  for (let i = 0; i < expr.length; i++) {
    const c = expr[i]
    if (quote) { cur += c; if (c === '\\') { cur += expr[++i] ?? ''; continue } if (c === quote) quote = null; continue }
    if (c === '"' || c === "'") { quote = c; cur += c; continue }
    if (c === '+') { out.push(cur); cur = ''; continue }
    cur += c
  }
  out.push(cur)
  return out
}

/** 常量表达式 → 实际路径。解析不出来就保留 `<NAME>` 并标 resolved:false，不假装成功。 */
function resolveExpr(expr, seen = new Set()) {
  const t = String(expr || '').trim()
  if (!t) return { value: '', ok: true }
  let value = ''
  let ok = true
  for (const part of splitConcat(t)) {
    const seg = part.trim()
    if (!seg) continue
    if (/^["']/.test(seg)) { value += seg.slice(1, -1); continue }
    const last = seg.split('.').pop()
    if (javaConsts.has(last) && !seen.has(last)) {
      // 常量套常量：递归展开，seen 防循环定义（A = B + A 这种写法真的存在过）
      const inner = resolveExpr(javaConsts.get(last), new Set([...seen, last]))
      if (inner.ok) { value += inner.value; continue }
    }
    ok = false
    value += `<${last}>`
  }
  return { value, ok }
}

let unresolvedEndpoints = 0
for (const r of rawSpring) {
  const base = resolveExpr(r.baseExpr)
  const path = resolveExpr(r.pathExpr)
  const full = ('/' + base.value + '/' + path.value).replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/'
  const resolved = base.ok && path.ok
  if (!resolved) unresolvedEndpoints++
  httpEndpoints.push({
    method: r.method, path: full, handler: r.handler, file: r.file, line: r.line,
    framework: 'spring', scope: r.scope, resolved,
    ...(resolved ? {} : { unresolvedExpr: [r.baseExpr, r.pathExpr].filter(Boolean).join(' + ') }),
  })
}

// .env 与配置文件（只收键名，值一律不落盘）
for (const f of files) {
  const base = basename(f.rel)
  if (/^\.env(\..+)?$/.test(base) || /\.env\.(local|development|production|test)$/.test(base)) {
    try {
      const text = readText(f.abs, 200_000)
      for (const line of text.split(/\r?\n/)) {
        const m = /^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=/.exec(line)
        if (m) addConfigKey(m[1], f.rel, { kind: 'env' })
      }
    } catch { /* 读不了就跳过，记在 caveats 里没有意义 */ }
  }
  if (/^(application|bootstrap)[\w.-]*\.(yml|yaml|properties)$/.test(base)) {
    try {
      const text = readText(f.abs, 300_000)
      if (base.endsWith('.properties')) {
        for (const line of text.split(/\r?\n/)) {
          const m = /^\s*([\w.-]+)\s*=/.exec(line)
          if (m) addConfigKey(m[1], f.rel, { kind: 'properties' })
        }
      } else {
        // yml 只取「键路径」，深度 3，值绝不带出来
        const stack = []
        for (const line of text.split(/\r?\n/)) {
          if (!line.trim() || line.trim().startsWith('#')) continue
          const m = /^(\s*)([\w.-]+)\s*:\s*(.*)$/.exec(line)
          if (!m) continue
          const indent = m[1].length
          const depth = Math.floor(indent / 2)
          stack.length = Math.min(stack.length, depth)
          stack[depth] = m[2]
          if (!m[3].trim() || m[3].trim() === '|' || m[3].trim() === '>') continue
          const key = stack.slice(0, depth + 1).filter(Boolean).join('.')
          if (key) addConfigKey(key, f.rel, { kind: 'yaml' })
        }
      }
    } catch { /* 同上 */ }
  }
}

// ------------------------------------------------------------------ 事实分级

// 示例/测试/工具目录里也有注解、也有 main()，但它们不是"这个产品对外暴露什么"。
// 全部保留在 facts.json 里（带 scope），但在给人看的清单里分开算。
const prod = (arr) => arr.filter((x) => x.scope === 'production')
const nonProd = (arr, kind) => arr.length - prod(arr).length
const prodEndpoints = prod(httpEndpoints)
const prodRoutes = prod(uiRoutes)
const prodEntities = prod(entities)
const prodEntrypoints = prod(entrypoints)

// ------------------------------------------------------------------ 热点与约定

const sourceFiles = files.filter((f) => INDEXABLE.has(f.lang || ''))
const hotspots = sourceFiles
  .filter((f) => !f.test)
  .sort((a, b) => b.lines - a.lines)
  .slice(0, 30)
  .map((f) => ({ file: f.rel, lines: f.lines, lang: f.lang }))

const dirLoc = new Map()
for (const f of sourceFiles) {
  if (f.test) continue
  const parts = f.rel.split('/')
  const key = parts.length > 2 ? parts.slice(0, 2).join('/') : parts.length > 1 ? parts[0] : '(root)'
  dirLoc.set(key, (dirLoc.get(key) || 0) + f.lines)
}
const topDirs = [...dirLoc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([dir, loc]) => ({ dir, loc }))

// 命名约定：Java 类后缀分布（这是"本仓怎么组织代码"最直接的事实）
const javaSuffix = new Map()
for (const f of sourceFiles) {
  if (f.lang !== 'java') continue
  const m = /([A-Z][A-Za-z0-9]*)\.java$/.exec(f.rel)
  if (!m) continue
  const found = /(Controller|ServiceImpl|Service|Repository|Mapper|Entity|DTO|VO|Request|Response|Config|Configuration|Handler|Task|Job|Listener|Filter|Interceptor|Aspect|Util|Utils|Exception|Enum|Converter|Factory|Provider|Manager|Adapter|Client|Test)$/.exec(m[1])
  if (found) javaSuffix.set(found[1], (javaSuffix.get(found[1]) || 0) + 1)
}

const conventions = {
  naming: [...javaSuffix.entries()].sort((a, b) => b[1] - a[1]).map(([suffix, count]) => ({ suffix, count })),
  lintConfigs: ['.eslintrc', '.eslintrc.js', '.eslintrc.cjs', '.eslintrc.json', 'eslint.config.js', 'eslint.config.mjs', '.prettierrc', '.prettierrc.json', 'prettier.config.js', 'biome.json', '.editorconfig', 'checkstyle.xml', 'spotless.xml', '.ruff.toml', '.golangci.yml', '.golangci.yaml', 'tsconfig.json', 'vitest.config.ts', 'jest.config.js', 'jest.config.ts']
    .filter((f) => existsSync(join(args.root, f))),
  packageManager: pm,
  lockfiles,
  markers,
  comments: { total: commentLines, chinese: cjkCommentLines, chineseRatio: commentLines ? +(cjkCommentLines / commentLines).toFixed(3) : 0 },
  todos: todos.slice(0, 40),
  todoCount: todos.length,
  testFrameworks: [
    sourceFiles.some((f) => f.lang === 'java' && /junit/i.test(readIf(f.rel)?.slice(0, 2000) || '')) ? 'junit' : null,
    existsSync(join(args.root, 'vitest.config.ts')) || existsSync(join(args.root, 'vitest.config.js')) ? 'vitest' : null,
    existsSync(join(args.root, 'jest.config.ts')) || existsSync(join(args.root, 'jest.config.js')) || pkgJson?.devDependencies?.jest ? 'jest' : null,
    sourceFiles.some((f) => f.lang === 'python' && f.test) ? 'pytest/unittest' : null,
    goMod ? 'go test' : null,
  ].filter(Boolean),
}

// ------------------------------------------------------------------ 风险与边界

const caveats = []
caveats.push('抽取是 regex 级启发式，不是编译器级：能定位定义与导入，但重载、泛型特化、动态导入的目标会失真。')
caveats.push(`跳过了 ${skipped.binary} 个非文本文件、${skipped.huge} 个超过 1.5MB 的文件${skipped.truncated ? '，并因达到 --max-files 上限提前终止' : ''}。`)
caveats.push(`忽略目录：${[...ignore].slice(0, 24).join(', ')}${ignore.size > 24 ? ' …' : ''}。如果源码确实放在这些名字下（少见），改脚本顶部的 DEFAULT_IGNORE_DIRS——不要用 --ignore 硬加，它是往回加忽略项的。`)
if (!meta.git.head) caveats.push('没有检测到 git 仓库（或 git 不在 PATH），版本信息为空。')
if (unresolvedEndpoints) caveats.push(`${unresolvedEndpoints} 个端点的路径是常量表达式且没在仓库里找到定义，已保留为 \`<NAME>\` 形式（resolved:false）——这些路径需要人工确认，别直接抄进文档。`)
if (httpEndpoints.length) caveats.push(`端点清单排除了 ${nonProd(httpEndpoints)} 个位于示例/测试/工具目录的匹配项；它们仍在 facts.json 里（scope=sample/test），要查全量别只看 FACTS.md。`)
if (!commands.length) caveats.push('没有识别到任何构建/测试命令——这份报告里的"验证方式"需要人工补。')
const untestedModules = modules.filter((m) => m.files > 20 && m.testFiles === 0)
if (untestedModules.length) caveats.push(`以下模块没有测试文件：${untestedModules.map((m) => m.name).join(', ')}。`)

// ------------------------------------------------------------------ 输出

const facts = {
  meta,
  languages,
  modules: modules.map((m) => ({
    name: m.name, path: m.path, kind: m.kind, manifest: m.manifest,
    artifact: m.artifact || null, version: m.version || null,
    files: m.files, loc: m.loc, testFiles: m.testFiles, testLoc: m.testLoc,
    languages: m.languages, intraDeps: m.intraDeps || [], deps: (m.deps || []).slice(0, 40),
    declaredModules: m.declaredModules || [],
  })),
  commands,
  entrypoints,
  httpEndpoints,
  uiRoutes,
  entities,
  configKeys: [...configKeys.values()].sort((a, b) => a.key.localeCompare(b.key)),
  tests: {
    frameworks: conventions.testFrameworks,
    files: sourceFiles.filter((f) => f.test).length,
    loc: sourceFiles.filter((f) => f.test).reduce((a, f) => a + f.lines, 0),
    ratio: meta.totals.sourceLoc ? +(meta.totals.testLoc / meta.totals.sourceLoc).toFixed(3) : 0,
  },
  hotspots,
  topDirs,
  conventions,
  caveats,
  skipped,
}

mkdirSync(args.out, { recursive: true })
writeFileSync(join(args.out, 'facts.json'), JSON.stringify(facts, null, 2), 'utf8')

// ------------------------------------------------------------------ FACTS.md

const md = []
const esc = (s) => String(s ?? '').replace(/\|/g, '\\|')
md.push(`# 仓库事实：${meta.name}`)
md.push('')
md.push(`> 由 \`scan-repo.mjs\` 生成于 ${meta.scannedAt}。**这是机器读的清单，不是介绍文档** ——`)
md.push('> 每条都能回到源文件核对。写给人看的说明在 dev-guide 里，不在这一份。')
md.push('')
md.push(`- 路径：\`${meta.root}\``)
md.push(`- 版本：${meta.git.branch || '?'} @ ${meta.git.head || '?'}（最后提交 ${meta.git.lastCommitDate || '?'}）`)
md.push(`- 规模：${meta.totals.files} 个文本文件 / ${meta.totals.loc.toLocaleString()} 行；其中源码 ${meta.totals.sourceFiles} 个 / ${meta.totals.sourceLoc.toLocaleString()} 行`)
md.push('')

md.push('## 语言分布')
md.push('')
md.push('| 语言 | 文件 | 行数 | 测试文件 |')
md.push('|---|---:|---:|---:|')
for (const l of languages.slice(0, 15)) md.push(`| ${l.lang} | ${l.files} | ${l.loc.toLocaleString()} | ${l.tests} |`)
md.push('')

md.push('## 模块')
md.push('')
if (modules.length) {
  md.push('| 模块 | 路径 | 类型 | 文件 | 行数 | 测试 | 依赖（仓内） |')
  md.push('|---|---|---|---:|---:|---:|---|')
  for (const m of facts.modules) {
    md.push(`| ${esc(m.name)} | \`${m.path || '.'}\` | ${m.kind} | ${m.files} | ${m.loc.toLocaleString()} | ${m.testFiles} | ${m.intraDeps.map(esc).join(', ') || '—'} |`)
  }
} else md.push('_未识别到模块结构。_')
md.push('')

md.push('## 构建与验证命令（带出处）')
md.push('')
if (commands.length) {
  md.push('| 用途 | 命令 | 出处 | 可信度 |')
  md.push('|---|---|---|---|')
  for (const c of commands) md.push(`| ${esc(c.label)} | \`${esc(c.cmd)}\` | ${esc(c.source)} | ${c.confidence} |`)
  md.push('')
  md.push('`declared` = 从配置里读出来的；`convention` = 按生态惯例推断的，**没跑过就不算数**（`verify-skillpack --run-commands` 会实跑 `--version` 级检查）。')
} else md.push('_没有识别到构建命令。_')
md.push('')

if (prodEntrypoints.length) {
  md.push('## 入口点')
  md.push('')
  md.push(`（另有 ${nonProd(entrypoints)} 个在示例/测试/工具目录，未计入）`)
  md.push('')
  for (const e of prodEntrypoints) md.push(`- \`${e.file}:${e.line}\` — ${e.detail}`)
  md.push('')
}

if (prodEndpoints.length) {
  md.push(`## HTTP 端点（${prodEndpoints.length} 个）`)
  md.push('')
  md.push('| 方法 | 路径 | 处理器 | 位置 |')
  md.push('|---|---|---|---|')
  md.push(`另有 ${nonProd(httpEndpoints)} 个位于示例/测试/工具目录，已排除。`)
  md.push('')
  for (const e of prodEndpoints.slice(0, 200)) md.push(`| ${e.method} | \`${esc(e.path)}\` | ${esc(e.handler)} | \`${e.file}:${e.line}\` |`)
  if (prodEndpoints.length > 200) md.push(`\n_只列前 200 个，完整清单在 facts.json 的 \`httpEndpoints\`（含 scope）。_`)
  md.push('')
}

if (prodRoutes.length) {
  md.push(`## 前端路由（${prodRoutes.length} 个）`)
  md.push('')
  for (const r of prodRoutes.slice(0, 120)) md.push(`- \`${r.path}\`${r.name ? ` (${r.name})` : ''} — \`${r.file}:${r.line}\``)
  md.push('')
}

if (prodEntities.length) {
  md.push(`## 数据模型（${prodEntities.length} 个）`)
  md.push('')
  md.push('| 名称 | 表 | 来源 | 位置 |')
  md.push('|---|---|---|---|')
  for (const e of prodEntities.slice(0, 200)) md.push(`| ${esc(e.name)} | ${e.table ? '`' + esc(e.table) + '`' : '—'} | ${e.source} | \`${e.file}:${e.line}\` |`)
  md.push('')
}

if (facts.configKeys.length) {
  md.push(`## 配置项（${facts.configKeys.length} 个，**只收键名，值一律不落盘**）`)
  md.push('')
  md.push('| 键 | 类型 | 出现位置 | 疑似敏感 |')
  md.push('|---|---|---|---|')
  for (const k of facts.configKeys.slice(0, 200)) md.push(`| \`${esc(k.key)}\` | ${k.kind || '—'} | ${esc(k.sources.slice(0, 2).join(', '))} | ${k.secret ? '是' : ''} |`)
  if (facts.configKeys.length > 200) md.push(`\n_只列前 200 个。_`)
  md.push('')
}

md.push('## 热点文件（行数 Top 30）')
md.push('')
md.push('| 文件 | 行数 |')
md.push('|---|---:|')
for (const h of hotspots) md.push(`| \`${h.file}\` | ${h.lines} |`)
md.push('')

if (topDirs.length) {
  md.push('## 目录体积（源码行数）')
  md.push('')
  for (const d of topDirs) md.push(`- \`${d.dir}\` — ${d.loc.toLocaleString()} 行`)
  md.push('')
}

md.push('## 约定信号')
md.push('')
if (conventions.naming.length) {
  md.push(`- Java 命名后缀分布：${conventions.naming.map((n) => `${n.suffix}(${n.count})`).join('、')}`)
}
md.push(`- 包管理器：${conventions.packageManager || '未识别'}${conventions.lockfiles.length ? `（${conventions.lockfiles.join(', ')}）` : ''}`)
md.push(`- 静态检查/格式化配置：${conventions.lintConfigs.length ? conventions.lintConfigs.join(', ') : '未发现'}`)
md.push(`- 测试框架：${conventions.testFrameworks.join(', ') || '未识别'}；测试/源码行数比 **${facts.tests.ratio}**`)
md.push(`- 注释语种：${conventions.comments.total} 行注释中 ${conventions.comments.chinese} 行含中文（${(conventions.comments.chineseRatio * 100).toFixed(0)}%）`)
md.push(`- 技术债标记：TODO ${markers.todo} / FIXME ${markers.fixme} / HACK ${markers.hack}`)
md.push(`- 类型逃逸：\`any\` 出现 ${markers.any} 次；\`console.log\` 类调用 ${markers.console} 次`)
md.push('')

if (conventions.todos.length) {
  md.push('### 技术债标记清单（前 40 条）')
  md.push('')
  for (const t of conventions.todos) md.push(`- \`${t.file}:${t.line}\` ${t.kind} — ${t.snippet}`)
  md.push('')
}

md.push('## 已知边界')
md.push('')
for (const c of caveats) md.push(`- ${c}`)
md.push('')

writeFileSync(join(args.out, 'FACTS.md'), md.join('\n'), 'utf8')

warn(`完成：${join(args.out, 'facts.json')}`)
warn(`      ${join(args.out, 'FACTS.md')}`)
if (!args.quiet) {
  console.log(JSON.stringify({
    ok: true,
    out: args.out,
    modules: modules.length,
    languages: languages.slice(0, 5).map((l) => l.lang),
    commands: commands.length,
    endpoints: prodEndpoints.length,
    endpointsExcluded: nonProd(httpEndpoints),
    routes: prodRoutes.length,
    entities: prodEntities.length,
    configKeys: facts.configKeys.length,
    todoCount: conventions.todoCount,
  }, null, 2))
}
