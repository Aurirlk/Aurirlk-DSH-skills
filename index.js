// disk-butler 插件入口：把仓库里打包的技能注册为一个按需加载的 agent skill。
//
// 设计取舍：
//   * 本文件不从 harness 导入任何东西，只在 apply 时消费 `skills` 服务，
//     因此不引入 cordis 副本；对 @deepseek-ai/dsh 的 peer 依赖只是元数据。
//   * 技能正文（SKILL.md）与相对引用（scripts/、references/）通过 directory 型的
//     resourceBase 解析到包目录，做到渐进式披露——只有任务真的需要时才加载。
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = 'disk-butler'

// 需要 skills 服务；注册表未挂载时本插件不会被激活
export const inject = ['skills']

const packageRoot = dirname(fileURLToPath(import.meta.url))

// 技能本体位于 skills/disk-butler/。这个布局同时满足两套规范：
//   * Codex/OpenAI 插件规范要求 plugin.json 的 skills 字段指向名为 `skills` 的目录
//   * DSH 的文件系统技能发现只扫一层（<根>/<名字>/SKILL.md），所以 <根> 必须正好是
//     skills/disk-butler
const skillRoot = join(packageRoot, 'skills', 'disk-butler')

const FALLBACK_DESCRIPTION =
  'Windows 电脑管家：查清 C/D/E 盘空间去向，识别垃圾、过期文件、Agent 运行脚本残余与各类缓存，' +
  '按安全等级产出清理计划并执行；用 NTFS Junction 把写死在 C 盘的缓存透明迁移到其他盘；' +
  '并把结论留档成本机档案。'

/**
 * 把 SKILL.md 拆成 frontmatter 与正文。
 *
 * 按行解析而不是用 `startsWith('---\n')` 之类的判断——后者在 **CRLF 行尾**的文件上
 * 会直接失效：Windows 编辑器默认保存 CRLF，frontmatter 解析不出来，技能描述会被
 * 静默丢弃（不报错，只是目录里少了一行描述）。所以这里对三种行尾都做处理。
 *
 * frontmatter 缺失或格式异常时退回整篇文本作为正文，不抛错。
 *
 * @param {string} raw SKILL.md 的原始内容
 * @returns {{description?: string, body: string}}
 */
function splitSkillDocument(raw) {
  const text = String(raw)
  const lines = text.split(/\r\n|\n|\r/)

  // 允许首行前后有空白，也允许文件开头就是正文
  if (lines[0].trim() !== '---') return { description: undefined, body: text }

  let closing = -1
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') { closing = i; break }
  }
  if (closing < 0) return { description: undefined, body: text }

  let description
  for (let i = 1; i < closing; i++) {
    const m = /^description\s*:\s*(.*)$/.exec(lines[i])
    if (!m) continue
    // YAML 允许把值写成带引号的形式，这里顺手去掉成对的首尾引号
    description = m[1].trim().replace(/^(['"])([\s\S]*)\1$/, '$2').trim()
    break
  }

  const body = lines.slice(closing + 1).join('\n').replace(/^\n+/, '')
  return { description: description || undefined, body }
}

/**
 * 注册技能。注册是一个 effect：ctx.skills.register() 返回的 disposer 会在插件
 * 卸载时移除该贡献。
 *
 * @param {import('@deepseek-ai/dsh').Context} ctx 注入了 skills 服务的 Cordis 上下文
 */
export function apply(ctx) {
  const skillPath = join(skillRoot, 'SKILL.md')
  if (!existsSync(skillPath)) {
    throw new Error(`disk-butler: 找不到技能正文 ${skillPath}`)
  }

  const { description, body } = splitSkillDocument(readFileSync(skillPath, 'utf8'))

  ctx.effect(() =>
    ctx.skills.register({
      name: 'disk-butler',
      source: 'bundled',
      description: description ?? FALLBACK_DESCRIPTION,
      content: body,
      resourceBase: { kind: 'directory', path: skillRoot },
    }),
  )
}

// 导出给单元测试用（scripts/self-test.mjs 会直接验证这个解析器）
export { splitSkillDocument }
