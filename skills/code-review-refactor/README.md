# code-review-refactor

> 本技能是 [Aurirlk DSH Skills](../../README.md) 合集的一员 · [← 返回仓库目录](../../README.md)

**中文** | [English](README.en.md)

对 Nuxt 4 + Vue 3 + Vuetify 3 代码做**可落地的** Code Review 与重构——不是"这里可以更好"这种废话，而是给出**抽取到哪里、函数签名长什么样、怎么验证没回归**。

## 什么时候用

- 用户说「代码很乱」「帮我 review 一下」「重构一下」
- 组件/页面冗长（超过 500 行还在长）
- **CSS 重复**：多个组件里同一套 `markdown-body`、卡片间距、按钮样式
- **相似页面靠复制**：几个管理页面只有按钮和列定义不同
- 你改代码时发现自己要重复造轮子——**应该先提取**

## 它产出什么

固定四段结构，按顺序给：

1. `## 最关键问题（按严重度从高到低）` —— 每条一句话 + 影响范围（渲染/性能/可维护性/正确性）
2. `## 重构/复用建议（可落地）` —— 抽取目标（`utils` / `composables` / `services` / 组件 / CSS）、原因、预计收益
3. `## JSON 驱动复用方案` —— 如果存在重复页面，给出最小配置 schema + 示例
4. `## 验证与回归（Test Plan）` —— 最少的手动验证清单

## 核心原则

| 原则 | 含义 |
|---|---|
| **行为优先** | 只优化结构，**不改变既有功能、接口与交互语义** |
| **小步可验证** | 先提取再替换，避免一次大改导致难排查 |
| **优先提取** | 纯函数 → `utils`；与生命周期/状态联动 → `composables`；请求与数据转换 → `services` |
| **优先组件化** | 重复 UI 结构 → 公共组件；相似页面 → 配置/JSON 驱动，**而不是拷贝页面** |

**允许**：提取公共逻辑、拆子组件、CSS 合并、加必要 wrapper。
**禁止**：仅为"看起来更漂亮"改交互语义或数据结构；大而全的重写。

## 安装

见[仓库根 README 的安装章节](../../README.md#怎么装)。本技能无脚本依赖，装上即可用。

## 来源与许可

二开自 [Spring AI Alibaba DataAgent](https://github.com/spring-ai-alibaba/DataAgent) 的
`data-agent-frontend-nuxt/.cursor/skills/code-review-refactor`（Apache License 2.0，
原作者 [SmileSnow819](https://github.com/SmileSnow819)，PR #485）。

本仓库的改动：frontmatter 适配 DSH（`name` 对齐目录名、`description` 改双语、新增 `whenToUse`）、
补写本 README、正文未改。详见 [`ATTRIBUTIONS.md`](../../ATTRIBUTIONS.md)。