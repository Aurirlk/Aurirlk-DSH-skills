# interview-skills

> 本技能是 [Aurirlk DSH Skills](../../README.md) 合集的一员 · [← 返回仓库目录](../../README.md)

**中文** | [English](README.en.md)

**大厂 AI 模拟面试官。** 给出目标公司、岗位和 JD，上传简历，Agent 就扮演**那家公司那个岗位的
面试官**——不是出一份通用题库，而是结合 JD 要求与你的简历，问该问的问题、追该追的点。

## 什么时候用

- 用户要做面试准备、要模拟面试
- 要针对**某家公司某个岗位**出题（而不是泛泛的"面试常考题"）
- 要练 **HR 面**、**薪资谈判**、**离职原因**这类软性问题
- 要**多轮连贯**模拟（一面接二面接三面，而不是每次都从头开始）

## 产出什么

| 产出 | 说明 |
|---|---|
| **10 道面试题** | 每道含**难度**、**参考答案要点**、**追问方向** |
| **好答案 vs 差答案** | 同一个问题的两种回答对比，让你看到差距在哪 |
| **HR 面专项** | 离职原因、职业规划、薪资期望这类问题的应对 |
| **薪资谈判话术** | offer 谈判的具体表达 |
| **多轮连贯模拟** | 一面 / 二面 / 三面串起来，带上下文 |

## 覆盖的公司

阿里、腾讯、字节跳动、百度、美团、京东、华为、滴滴、拼多多，
以及 Google、Meta、Amazon（含 AWS）、Microsoft 等海外大厂。

## 配套文档（按需加载）

```
references/
├── company-profiles.md              各公司的面试风格与偏好
├── jd-parser.md                     JD 解析：从岗位描述提取真正的要求
├── resume-parser.md                 简历解析：提取可被追问的经历 Claim
├── question-design.md               出题方法论
├── bei-framework.md                 BEI（行为事件访谈）框架
├── chatbox-senior-ai-chatbot.md     对话式面试官的设计
└── github-similar-repos-research.md 同类项目调研
```

## 用法示例

```
我想面阿里的 AI 应用开发岗。
JD 是：<粘贴 JD>
我的简历在 resume.pdf。
先出 10 道题，每题标难度和追问方向。
```

或者：

```
模拟一次完整的 HR 面，重点问离职原因和职业规划。
```

## 安装

见[仓库根 README 的安装章节](../../README.md#怎么装)。

## 来源与许可

二开自 [`jennifer88huang/interview-skills`](https://github.com/jennifer88huang/interview-skills)
（362 star）。作者在 README 与徽章中声明为 **MIT License** 并写明 "fully open-source under the
MIT license and free to use"，但**仓库里缺少 `LICENSE` 文件**。

本仓库的改动：frontmatter 适配 DSH（`description` 改双语、新增 `whenToUse`、
移除 `metadata.openclaw` 与 `allowed-tools` 这类 OpenClaw / Claude 专有字段）、补写本 README。
正文与 `references/` 保持原样。详见 [`ATTRIBUTIONS.md`](../../ATTRIBUTIONS.md)。