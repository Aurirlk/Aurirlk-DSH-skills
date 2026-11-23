# prompt-architect

> 本技能是 [Aurirlk DSH Skills](../../README.md) 合集的一员 · [← 返回仓库目录](../../README.md)

**中文** | [English](README.en.md)

高级 AI 提示词架构师。把模糊需求变成能直接复制的 Markdown 结构化 Prompt，并告诉你为什么这么写、该用什么模型跑。

## 什么时候用

- "优化以下 prompt：……"
- "帮我写一份 XX 助手的 prompt"
- 手上有提示词但输出不稳定，想知道缺了哪些约束、要不要加 CoT/Few-Shot

## 它做什么

1. **诊断**：识别缺失的背景、目标、受众、约束（只用于分析，不输出）。
2. **生成**：按 Role / Profile / Context / Goals / Input Data / Output Format / Constraints / Skills / Workflow / Examples 模板产出，放在代码块里可直接复制。
3. **教学**：简述用了哪些技巧（为何 CoT、为何设反向约束），语言简洁但不空。
4. **推荐**：末尾给 1-3 个适配模型及理由。

## 和 prompt-consultant-master 的区别

| | 本技能 | prompt-consultant-master |
|---|---|---|
| 输入 | 已有一段 prompt 或明确需求 | 只有一个模糊想法 |
| 交互 | 直接产出 | 多轮问诊，每轮最多 2 问，确认画像后才交付 |
| 重点 | 结构化与技巧教学 | 挖需求、去 AI 味、守风控边界 |

## 用法

```
优化这个 prompt：你是一个助手，帮我写文章
```

```
帮我写一份把技术文档翻成产品更新日志的 prompt，要求不要黑话
```

## 安装

```powershell
cd "$env:USERPROFILE\.dsh\profiles\desktop"
pnpm add github:Aurirlk/Aurirlk-DSH-skills
```

只装这一个见 [仓库首页](../../README.md#只想装其中一个)。

## 边界

- 交付 prompt 与说明，不替你执行；除非明确要求再跑一遍。
- 不虚构模型能力，拿不准的标"需实测"。
