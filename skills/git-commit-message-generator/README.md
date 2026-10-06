# git-commit-message-generator

> 本技能是 [Aurirlk DSH Skills](../../README.md) 合集的一员 · [← 返回仓库目录](../../README.md)

**中文** | [English](README.en.md)

按[约定式提交](https://www.conventionalcommits.org/)（Conventional Commits）生成 git 提交信息，
重点在**主题写得像样**——不出现「修改了」「更新了」这种说了等于没说的句子。

## 什么时候用

用户说「帮我写一下提交信息」「commit message 怎么写」时。

## 类型集合

从这七个里选一个，**没有合适的就问用户确认或从上下文推断**：

| 类型 | 用于 |
|---|---|
| `feat` | 新功能 |
| `fix` | 修 bug |
| `docs` | 文档 |
| `style` | 格式调整（不改行为） |
| `refactor` | 重构（不改对外行为） |
| `test` | 测试 |
| `chore` | 构建/辅助工具 |

## 主题写法

- 简洁、**动作明确**，避免"做了/修改了/更新了"这类空话
- 长度 12~30 个字符
- 默认只输出一行 `type:主题`，不加 body

```
feat:完成对话页面
fix:修复SSE滚动不自动到底部
refactor:重构时间线渲染以支持流式报告
docs:更新ECharts渲染说明文档
chore:调整lint/format脚本配置
```

## 安装

见[仓库根 README 的安装章节](../../README.md#怎么装)。

## 来源与许可

二开自 [Spring AI Alibaba DataAgent](https://github.com/spring-ai-alibaba/DataAgent) 的
`data-agent-frontend-nuxt/.cursor/skills/git-commit-message-generator`（Apache License 2.0，
原作者 [SmileSnow819](https://github.com/SmileSnow819)，PR #485）。

本仓库的改动：frontmatter 适配 DSH、补写本 README、正文未改。
详见 [`ATTRIBUTIONS.md`](../../ATTRIBUTIONS.md)。