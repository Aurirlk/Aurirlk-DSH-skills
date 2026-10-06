# create-interviewer

> 本技能是 [Aurirlk DSH Skills](../../README.md) 合集的一员 · [← 返回仓库目录](../../README.md)

**中文** | [English](README.en.md)

**把一位面试官蒸馏成一个会持续进化的 AI 角色。** 导入那位面试官的公开材料——面试对话记录、
招聘 JD、学术论文、代码仓库——生成三样东西：

| 产物 | 内容 |
|---|---|
| **TechMap** | 技术背景图谱：他关心哪些技术栈、深度到什么程度 |
| **BehaviorArchive** | 行为档案：怎么追问、什么时候施压、什么信号会让他满意 |
| **Persona** | 人格画像：提问风格、语气、关注点 |

然后这个角色可以**持续进化**——每复盘一次真实面试，就把新观察合并进去。

## 什么时候用

- 想根据某位面试官的公开材料建立画像
- 想复盘某场已经面过的面试（尤其是被问住的那些点）
- 想要一个**会一直追着你的薄弱点问下去**的面试官角色，而不是一次性出题

## 工作流（`prompts/` 里的阶段）

```
intake.md              入口：收集材料
  ├─ techmap_analyzer.md   → techmap_builder.md   技术背景分析 → 建图
  ├─ behavior_analyzer.md  → behavior_builder.md  行为分析 → 建档
  └─ persona_analyzer.md   → persona_builder.md   人格分析 → 画像
correction_handler.md  纠偏：当画像判断错了，如何修正
merger.md              合并：把新观察并进已有画像
techprofiles.md        技术画像模板
```

配套脚本在 `tools/`：

| 脚本 | 用途 |
|---|---|
| `skill_writer.py` | 把生成的画像写成 skill |
| `social_parser.py` | 解析公开资料 |
| `version_manager.py` | 画像版本管理（支持进化） |

## 依赖

`requirements.txt`（Python）。首次使用前：

```bash
pip install -r requirements.txt
```

## 安装

见[仓库根 README 的安装章节](../../README.md#怎么装)。

## 来源与许可

二开自 [`Bughouse1024/interviewer-skill`](https://github.com/Bughouse1024/interviewer-skill)
（**MIT License**，作者 Bughouse1024）。技能内的 `name` 由 `create-interviewer` 保持，
目录名与之对齐。

本仓库的改动：frontmatter 适配 DSH（`description` 改双语、新增 `whenToUse`、
清掉 `allowed-tools` / `argument-hint` / `version` 这类 Claude/Codex 专有字段）、补写本 README。
正文、`prompts/`、`tools/` 保持原样。详见 [`ATTRIBUTIONS.md`](../../ATTRIBUTIONS.md)。