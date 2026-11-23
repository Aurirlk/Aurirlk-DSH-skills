# prompt-consultant-master

> 本技能是 [Aurirlk DSH Skills](../../README.md) 合集的一员 · [← 返回仓库目录](../../README.md)

**中文** | [English](README.en.md)

AI 提示词咨询大师。你只有一个模糊想法时，它先追问你 1-2 个问题，把需求画像对齐了，再交付一份工业级、去 AI 味的 System Prompt。

## 什么时候用

- "我想做个 XX 助手，但说不清要什么样的"
- 想先把边界（绝对不能出现什么）讲清楚再让 AI 写 prompt
- 拿到的 prompt 总有一股"AI 味"，想定制语气和人格颗粒度

## 它做什么

1. **破冰**：锁定场景/赛道与核心受众。
2. **自适应问诊**：按场景分支追问（短视频问黄金 3 秒与语气、技术问版本与注释规范、学术问引用格式与严谨度），**每轮最多 2 个问题**。
3. **画像对齐**：输出任务/人设/受众/四条边界请用户核对。
4. **交付**：确认后才给标准 Markdown System Prompt，附模型推荐与 Temperature 调试建议。

核心心法：对小白给选项、对专家问参数；把"绝对不能出现什么"当最高优先级约束。

## 和 prompt-architect 的区别

| | 本技能 | prompt-architect |
|---|---|---|
| 输入 | 模糊想法 | 已有 prompt 或明确需求 |
| 交互 | 多轮问诊后交付 | 直接产出 |
| 重点 | 挖需求、去 AI 味、守边界 | 结构化与技巧教学 |

## 用法

```
我想做一个帮我写小红书文案的助手，先别急着写 prompt
```

## 安装

```powershell
cd "$env:USERPROFILE\.dsh\profiles\desktop"
pnpm add github:Aurirlk/Aurirlk-DSH-skills
```

只装这一个见 [仓库首页](../../README.md#只想装其中一个)。

## 边界

- 默认要先问诊，用户说"直接给"时才跳过，并标注未澄清项。
- 交付的是 prompt，不负责评估模型实际输出效果。
