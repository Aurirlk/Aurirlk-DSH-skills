// Aurirlk DSH Skills —— 合集插件入口
//
// 把仓库 skills/ 下的**每一个技能**注册为按需加载的 agent skill。
// 新增技能只需在 skills/<名字>/ 放一个 SKILL.md，本文件无需改动。
//
// 目录约定（同时满足两套规范，所以不能随意改）：
//   * DSH 的文件系统技能发现只扫一层：<根>/<名字>/SKILL.md
//   * Codex/OpenAI 插件规范要求 plugin.json 的 skills 字段指向名为 `skills` 的目录
//   ⇒ 技能本体放 skills/<名字>/，DSH 安装时把 <根> 指向 skills/<名字>
//
// 本文件不从 harness 导入任何东西，只在 apply 时消费 `skills` 服务，
// 因此不引入 cordis 副本；对 @deepseek-ai/dsh 的 peer 依赖只是元数据（可选）。
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = 'aurirlk-dsh-skills'

// 需要 skills 服务；注册表未挂载时本插件不会被激活
export const inject = ['skills']

const packageRoot = dirname(fileURLToPath(import.meta.url))
const skillsRoot = join(packageRoot, 'skills')

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
 * 发现 skills/ 下的全部技能。
 * 只认「有 SKILL.md 的直接子目录」，忽略隐藏目录与没有 SKILL.md 的目录。
 *
 * @returns {Array<{name: string, dir: string, skillFile: string}>} 按名称排序
 */
export function discoverSkills() {
  if (!existsSync(skillsRoot)) return []

  return readdirSync(skillsRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => {
      const dir = join(skillsRoot, e.name)
      return { name: e.name, dir, skillFile: join(dir, 'SKILL.md') }
    })
    .filter((s) => existsSync(s.skillFile))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * 注册 skills/ 下的全部技能。
 *
 * 每次注册都是一个 effect：ctx.skills.register() 返回的 disposer 会在插件卸载时
 * 移除该贡献，所以卸载本插件会干净地撤掉全部技能。
 *
 * @param {import('@deepseek-ai/dsh').Context} ctx 注入了 skills 服务的 Cordis 上下文
 */
export function apply(ctx) {
  const skills = discoverSkills()

  if (skills.length === 0) {
    throw new Error(
      `Aurirlk DSH Skills: ${skillsRoot} 下没有找到任何技能。` +
      '每个技能应当是一个含 SKILL.md 的直接子目录。',
    )
  }

  for (const skill of skills) {
    const { description, body } = splitSkillDocument(readFileSync(skill.skillFile, 'utf8'))

    ctx.effect(() =>
      ctx.skills.register({
        name: skill.name,
        source: 'bundled',
        // 没有可用描述时给一个明确的占位，而不是空字符串——
        // 空描述在模型目录里等于"看不见这个技能"
        description: description ?? `（${skill.name}：SKILL.md 缺少 description 字段）`,
        content: body,
        resourceBase: { kind: 'directory', path: skill.dir },
      }),
    )
  }
}

// 导出给单元测试用（scripts/self-test.mjs 会直接验证发现与解析）
export { splitSkillDocument }
