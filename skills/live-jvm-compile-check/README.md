# live-jvm-compile-check

> 本技能是 [Aurirlk DSH Skills](../../README.md) 合集的一员 · [← 返回仓库目录](../../README.md)

**中文** | [English](README.en.md)

服务正在跑，你刚改完几个 `.java`，想确认「没写错」——但又不能 `mvn compile`，因为那会把运行中的 JVM 打爆。

这个技能让你**借运行中 JVM 的 classpath，只编到临时目录**，不碰 `target/classes`。

## 什么时候用

- Spring Boot 服务还开着（`tasklist` 里有 `java.exe`），你改了代码，想让用户放心重启
- 想知道「当前这个依赖版本里，`XxxClient` 到底有没有 `doSomething()` 这个方法」
- 上次重启后报 `NoClassDefFoundError`，怀疑是编译产物被改坏

**不适合**：要验证行为是否正确、要打包发版。这个技能只回答一个问题 —— **能编译吗**。

## 它解决的具体麻烦

| 你现在的处境 | 不用它 | 用它 |
|---|---|---|
| 改完 20 个文件，让用户重启 | 重启 → 报错 → 再改 → 再重启 | 一次编过，用户只重启一次 |
| 猜某个 API 存不存在 | 读 jar、翻文档、凭记忆 | 30 秒给出确定答案 |
| 怕 `mvn compile` 弄坏运行中的服务 | 只能冒险或干脆不验证 | classpath 只读，编译产物进临时目录 |

## 用法

直接跟 agent 说：

```
服务还开着，别 compile。帮我验证一下刚改的这几个文件能不能编过。
```

它会走完五步：找 PID → 从 JVM 取 classpath → 写 argfile → `javac -proc:full` 编到临时目录 → 报结论。

想手动跑，完整命令在 [SKILL.md](SKILL.md)。

## 几条容易摔的坑

- **`-proc:none` 会让 Lombok 失效**，满屏"找不到符号"全是假的。必须 `-proc:full`
- **argfile 里的反斜杠要换成正斜杠**，否则整条 classpath 静默失效（不报错，只是所有 import 都找不到）
- **classpath 写 `D:/` 不能写 `/d/`** —— Java 是原生 Windows 程序
- **IDEA 起的 JVM，`java.class.path` 常常不含三方 jar**，得改从 fat jar 的 `BOOT-INF/lib` 取

## ⚠️ 边界

- 只证明**能编译**。打包、资源拷贝、Spring 装配、真实行为都要等重启后验证
- classpath 是**当前运行版本**，刚升级依赖的话结论不对新版本负责
- 编过了也要告诉用户「需要重启才生效」——别让他以为改完就上线了

## 安装

```powershell
# 合集（推荐）
cd "$env:USERPROFILE\.dsh\profiles\desktop"
pnpm add github:Aurirlk/Aurirlk-DSH-skills

# 只装这一个
git clone https://github.com/Aurirlk/Aurirlk-DSH-skills.git D:\Dev\Aurirlk-DSH-skills
New-Item -ItemType Junction `
  -Path   "$env:USERPROFILE\.dsh\skills\live-jvm-compile-check" `
  -Target "D:\Dev\Aurirlk-DSH-skills\skills\live-jvm-compile-check"
```

不依赖 DSH：把 `skills/live-jvm-compile-check/` 整个目录拷进任何认 `SKILL.md` 的 agent 技能目录即可。

## 平台

Windows（PowerShell + `jcmd`/`javac` 绝对路径）。Linux / macOS 把 `$jcmd <PID> VM.system_properties` 那段换成 shell 管道即可，其余逻辑一致。
