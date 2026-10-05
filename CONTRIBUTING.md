# 参与开发

先读 [`skills/disk-butler/references/维护与踩坑.md`](skills/disk-butler/references/维护与踩坑.md)——
里面是 12 个真实踩过的坑，绝大多数**只在运行时才暴露**，光看代码看不出来。

---

## ⚠️ 最重要的一条：BOM

本项目的运行环境是 **Windows PowerShell 5.1**，它对编码很敏感：

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
.\skills\disk-butler\scripts\Test-SkillHealth.ps1 -Deep  # 1. 30 项自检
node scripts/self-test.mjs                               # 2. 插件入口 + 解析器单测
```

再真实跑一次（第 3 步不能省——有一类**静默错误**只能靠实跑发现，见踩坑文档第 12 条）：

```powershell
$plan = Join-Path $env:TEMP 'smoke.json'
.\skills\disk-butler\scripts\Find-Junk.ps1 -Days 30 -JsonOut $plan
.\skills\disk-butler\scripts\Invoke-Cleanup.ps1 -Plan $plan        # 预演，不会删东西
```

CI 会跑上面全部（`.github/workflows/verify.yml`）。

---

## 不要破坏的约定

1. **`auto\` 是脚本生成的**，会被整体覆盖。任何"让用户往里写东西"的设计都是错的——人工内容属于 `kb\`。
2. **扫描器不许有删除路径**。删除只能出现在 `Invoke-Cleanup.ps1`。
3. **执行器默认预演**。任何让"不加参数就动手"的改动都是破坏性变更。
4. **安全规则要双层校验**。只在校验扫描时查一遍，就等于信任计划文件——它可能过期或被篡改。
5. **日志与运行产物不许写进技能目录**。技能目录在别人的安装环境里是只读的，而且会被 npm 打包。
6. **技能布局不能动**。`skills/<名字>/SKILL.md` 这个层级同时满足 DSH 的技能发现（只扫一层）和 Codex 的 `plugin.json#skills` 要求。

---

## 加一类新的清理目标

改 `Find-Junk.ps1` 前逐条确认：

- [ ] 这个目标**会不会命中某个环境变量**？会的话，整体删除必须被拒绝
- [ ] 里面**有没有可能出现 `backup` / `recover` / `备份` / `恢复` 子目录**？
- [ ] 有没有**正在运行的程序**会占用它？
- [ ] 需要管理员权限吗？需要就标 `NeedsAdmin`
- [ ] 安全等级选对了吗？**拿不准就选 `Confirm`**
- [ ] 汇总会不会因为目标重复而重复计费？（同类同目标只保留一项）
- [ ] 新增的字符串有没有引入**新的编码风险**？
- [ ] 更新 `references/垃圾分类判据.md`（人类可读的版本要与代码同步）
- [ ] 跑「改完必做」的全部三步

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
