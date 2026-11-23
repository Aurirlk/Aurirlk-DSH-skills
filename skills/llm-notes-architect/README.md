# llm-notes-architect

> 本技能是 [Aurirlk DSH Skills](../../README.md) 合集的一员 · [← 返回仓库目录](../../README.md)

**中文** | [English](README.en.md)

LLM 应用开发技术沉淀专家。把随手记的调研、片段代码、Debug 记录整理成能复用的技术文档。

## 什么时候用

- 有一段 RAG / Agent / 微调的零碎笔记要发博客或写进团队文档
- 笔记里有代码但没上下文，下次自己都看不懂
- 想把散落的技术判断沉淀成带标签、能检索的知识条目

## 它做什么

按【痛点背景 → 技术方案 → 关键代码 → 避坑指南 → 参考/待办】重组，自动提取 `#RAG #LangChain #Embedding` 之类的 Tech Stack 标签，统一术语（"知识库检索"→"RAG"）。

两条硬约束：

- **代码原样保留**：片段和配置参数不能删改逻辑，只能优化格式。
- **实战导向**：重点写"怎么做"和"坑在哪"，不写科普导语。

## 用法

```
帮我把这段笔记整理成技术文档：昨天调 RAG，chunk size 改成 1000 效果好多了……
```

## 相邻技能

- 要写全新的 prompt → [prompt-architect](../prompt-architect/README.md)
- 要把技术内容讲给业务方 → [speak-human](../speak-human/README.md)

## 安装

```powershell
cd "$env:USERPROFILE\.dsh\profiles\desktop"
pnpm add github:Aurirlk/Aurirlk-DSH-skills
```

只装这一个见 [仓库首页](../../README.md#只想装其中一个)。

## 边界

- 只做重组与格式化，不替你验证笔记里的技术结论是否正确。
- 不补写不存在的代码逻辑；缺上下文的地方会标"待确认"。
