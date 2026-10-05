# 参与开发

这是 **Aurirlk 的 DSH 技能合集**——每个技能一个顶层目录，共用一套仓库级校验。
新增技能前先读 [`skills/disk-butler/references/维护与踩坑.md`](skills/disk-butler/references/维护与踩坑.md)：
里面是 12 个真实踩过的坑，绝大多数**只在运行时才暴露**，光看代码看不出来。

---

## 新增一个技能

这是本仓库最主要的工作。**四步，不用改任何仓库级代码**：

```powershell
# 1. 建目录（名字即技能名，必须 kebab-case）
New-Item -ItemType Directory -Path skills\<名字>

# 2. 写技能正文（frontmatter 必填 name 与 description）
#    文件头必须是 --- 包围的 YAML，name 必须与目录名完全一致
New-Item -ItemType File -Path skills\<名字>\SKILL.md

# 3. 写给人看的文档（合集要求，自测会检查它存在）
New-Item -ItemType File -Path skills\<名字>\README.md

# 4. 在仓库根 README 的「技能目录」表格里加一行
```

**`index.js` 不需要改**——它遍历 `skills/` 注册所有含 `SKILL.md` 的目录。
**CI 也不需要改**——它同样遍历所有技能。

### `SKILL.md` 的 frontmatter

```yaml
---
name: <与目录名完全一致，kebab-case>
description: <必填。这是**技能目录里唯一被模型看到的一行**，写清"什么时候该用它">
whenToUse: <可选，进一步说明触发场景>
---
```

`description` 的质量直接决定技能会不会被正确加载：

- **写场景，不要写功能**。「用户询问磁盘空间、清理垃圾、迁移缓存时」比「一个磁盘管理工具」有用得多
- 把用户可能说的**原话**放进去（「C盘满了」「这个能删吗」），模型是按语义匹配的
- 别写成一段宣传语

### `README.md` 要包含什么

1. **一句话说明**它解决什么问题
2. **⚠️ 风险声明**（如果它会改动或删除用户的东西——这类技能必须写）
3. **用法**（具体命令或对 agent 说的话）
4. **安装方式**（合集安装 / 单独挂载 / 其它 agent）
5. **已知边界**（平台限制、需要管理员权限的操作等）

---

## ⚠️ 最重要的一条：BOM

技能脚本主要以 **Windows PowerShell 5.1** 为运行环境，它对编码很敏感：

| 文件 | 要求 | 违反的后果 |
|---|---|---|
| `.ps1` | **必须**是 UTF-8 **带** BOM | PS 5.1 按 ANSI(GBK) 解释，中文全乱、**脚本直接解析失败** |
| `SKILL.md` | **必须**是 UTF-8 **无** BOM | frontmatter 的 `---` 判定失效，**技能描述被静默丢弃**（不报错） |

两个要求方向相反，很容易弄反。`.editorconfig` 已经声明了正确取值，支持的编辑器会自动遵守。

**如果你的编辑工具会剥掉 BOM**（很多工具都会），改完 `.ps1` 后必须跑：

```powershell
.\scripts\Fix-Bom.ps1
```

这个坑在开发过程中犯了三次，别靠记性。

---

## 改完必做

```powershell
.\scripts\Fix-Bom.ps1                                    # 0. 修 BOM（必须先跑）
node scripts\self-test.mjs                               # 1. 合集注册 + 解析器单测
.\skills\<名字>\scripts\Test-SkillHealth.ps1 -Deep        # 2. 该技能自检（若有）
```

再真实跑一次（第 3 步不能省——有一类**静默错误**只能靠实跑发现，见踩坑文档第 12 条）：

```powershell
$plan = Join-Path $env:TEMP 'smoke.json'
.\skills\disk-butler\scripts\Find-Junk.ps1 -Days 30 -JsonOut $plan
.\skills\disk-butler\scripts\Invoke-Cleanup.ps1 -Plan $plan        # 预演，不会删东西
```

CI 会跑上面全部（`.github/workflows/verify.yml`），并且**遍历所有技能**。

---

## 不要破坏的约定

### 仓库级

1. **技能布局不能动**。`skills/<名字>/SKILL.md` 这个层级同时满足 DSH 的技能发现（只扫一层）
   和 Codex 的 `plugin.json#skills`（必须指向名为 `skills` 的目录）要求。改成 `skills/` 之外
   的任何位置都会让其中一套失效。
2. **`index.js` 必须保持"遍历注册"**。硬编码技能列表会让新增技能需要改代码，
   失去合集的意义。
3. **`.npmignore` 里只能写 `/scripts/` 不能写 `scripts/`**。后者会连
   `skills/*/scripts/`（技能本体）一起排除掉。
4. **日志与运行产物不许写进技能目录**。技能目录在别人的安装环境里是只读的，而且会被 npm 打包。

### 单个技能内（以 disk-butler 为例的通用原则）

5. **生成的目录与人工目录必须分开**（disk-butler 里的 `auto\` 与 `kb\`）。
   任何"让用户往会被脚本覆盖的目录里写东西"的设计都是错的。
6. **扫描/读取类脚本不许有删除路径**。删除只能出现在明确的执行器里。
7. **执行器默认预演**。任何让"不加参数就动手"的改动都是破坏性变更。
8. **安全规则要双层校验**。只在扫描时查一遍，就等于信任计划文件——它可能过期或被篡改。

---

## 维护 disk-butler

### 加一类新的清理目标

改 `Find-Junk.ps1` 前逐条确认：

- [ ] 这个目标**会不会命中某个环境变量**？会的话，整体删除必须被拒绝
- [ ] 里面**有没有可能出现 `backup` / `recover` / `备份` / `恢复` 子目录**？
- [ ] 有没有**正在运行的程序**会占用它？
- [ ] 需要管理员权限吗？需要就标 `NeedsAdmin`
- [ ] 安全等级选对了吗？**拿不准就选 `Confirm`**
- [ ] 汇总会不会因为目标重复而重复计费？（同类同目标只保留一项）
- [ ] 新增的字符串有没有引入**新的编码风险**？
- [ ] 更新 `references/垃圾分类判据.md`（人类可读的版本要与代码同步）
- [ ] 跑「改完必做」的全部步骤

---

## 提交与 PR

- 提交信息说明**为什么**，而不只是做了什么
- 修 bug 的 PR 请带上复现方式
- 新增分类请说明**为什么它安全**，以及删了会有什么后果
- 涉及删除行为的改动请特别标注

## 语言

代码注释与文档目前以中文为主。**欢迎英文 PR**，尤其是：

- `README.en.md`（国际读者的第一入口）
- `skills/disk-butler/SKILL.md` 的英文版——它的 `description` 是技能目录里**唯一被模型看到的一行**，中文会直接让非中文用户跳过

## 平台

目前**仅 Windows**。依赖 `robocopy`、NTFS Junction、PowerShell 与一批 Windows 路径约定。
Linux / macOS 支持欢迎贡献，但需要另写实现而不是改分支。
