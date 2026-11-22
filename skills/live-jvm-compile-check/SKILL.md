---
name: live-jvm-compile-check
description: "服务正在运行时验证 Java 改动能否编译：从运行中的 JVM 里取出真实 classpath，用 javac 只编到临时目录，全程不碰 target/classes，不触发 mvn compile / clean / IDE Build。解决「改完代码但要等用户重启才能编译，怕让他白重启一次」的问题。也用于确认某个类在当前依赖版本下是否真有某方法签名。Compile-check Java edits against a live JVM without touching target/classes. Triggers: 不停服编译 / 运行中验证 / 不能 mvn compile / javac 校验 / 编译不过先别重启。"
whenToUse: "目标服务正在运行（Spring Boot 的 java.exe 还在 tasklist 里），你刚改了若干 .java，想在用户重启前先确认没有编译错误；或想知道当前运行版本里某个类/方法到底存不存在。"
---

# 不停服验证 Java 改动能否编译

`mvn compile` 会重写 `target/classes`。运行中的 JVM 之后再加载类，拿到的是新字节码配旧状态 —— 表现是 `NoClassDefFoundError`、`ClassNotFoundException`，前端则只看到一句 `System exception`。

**所以：对运行中的服务，永远不要 compile / clean / 触发 IDE Build。** 但"不能编译"不等于"没法验证"。可以借用运行中 JVM 的真实 classpath，只往临时目录编。

## 铁律

1. **只编到临时目录**（`-d <tmp>`），绝不写 `target/classes`。
2. **必须带 `-proc:full`**。用 `-proc:none` 时 Lombok 不生成 `log` 字段，满屏"找不到符号"全是假错误。
3. **每个改动的文件都要显式列在命令行上**。靠 `-sourcepath` 隐式带进来的兄弟类不走注解处理，同样冒假的"找不到符号"。
4. **改完必须重编再跑结论**。拿旧 class 得出的"没问题"是假的。
5. **结论只覆盖"能编译"**，不代表行为正确，也不替代真实打包。

## 步骤

### 0. 找到 PID

```bash
jps -l | grep -i your-app        # 最直接
```

Windows 上如果 `jps` 不在 PATH，用绝对路径（IDEA 自带 JBR 里通常也有 `jbr\bin\jcmd.exe`）。也可以从端口反查进程。

### 1. 取运行 JVM 的真实 classpath（只读）

```powershell
$jcmd = "C:\path\to\jdk\bin\jcmd.exe"
& $jcmd <PID> VM.system_properties > $tmp\props.txt

$line = Select-String -Path "$tmp\props.txt" -Pattern "^java.class.path=" | Select-Object -First 1
$line.Line.Substring("java.class.path=".Length) | Set-Content "$tmp\app_cp.txt" -Encoding ASCII
```

**注意两个陷阱：**

- **IDEA 启动的 JVM，`java.class.path` 往往不含第三方 jar**（IDEA 用自定义 classloader 加载）。
  这时改从 fat jar 里取：解出 `BOOT-INF/lib/*` 的路径列表，或直接用 `hmsz-ai-server-exec.jar` 的 lib 目录拼。
- `Set-Content -Encoding UTF8` 在 Windows PowerShell 5.1 会写 BOM，**BOM 会污染第一个 classpath 条目**。用 ASCII，或读回来 `TrimStart([char]0xFEFF)`。

### 2. 还原转义，写 javac argfile

`VM.system_properties` 会把 `:` 和 `\` 转义成 `\:` 与 `\\`；而 **javac 的 `@argfile` 里 `\` 本身又是转义符**。所以最终必须全换成正斜杠：

```powershell
$cp  = (Get-Content "$tmp\app_cp.txt" -Raw).TrimStart([char]0xFEFF).Trim()
$cp2 = $cp.Replace('\\','\').Replace('\:',':').Replace('\','/')
('-cp "' + $cp2 + '"') | Set-Content "$tmp\javac_args.txt" -Encoding ASCII
```

**顺带一条**：classpath 里如果含资源目录（比如 `src/main/resources`），路径也要写 `D:/...` 而不是 `/d/...`。
Java 是原生 Windows 程序，读不懂 MSYS 风格的路径 —— 曾因此报"读取模板失败"，排查半天。

### 3. 只编到临时目录

```powershell
$javac = "C:\path\to\jdk\bin\javac.exe"
& $javac "@$tmp\javac_args.txt" -proc:full -encoding UTF-8 -nowarn -d "$tmp\ct_check" `
    path1\A.java path2\B.java path3\C.java
"EXIT=$LASTEXITCODE"
```

- `-encoding UTF-8` 必加：源码含中文注释，Windows 默认 GBK 直接报错。
- 兄弟模块如果还没编过，把它们的 `target/classes` 也加进 classpath。
- 提示词/模板之类的 `*.txt` 在 `src/main/resources` 下时，把该目录也加进 classpath，否则运行期才炸。

### 4. 判读结果

- **`EXIT=0`** → 这些文件在当前依赖版本下语法与符号都成立。
- **非 0** → **只看第一条 error**。后面的多半是级联噪声，修完第一条重跑。
- 如果报"程序包 xxx 不存在"且数量巨大 —— 八成是 classpath 整条失效（反斜杠或 BOM），不是代码问题。

## 坑（都踩过）

| 坑 | 症状 | 解法 |
|---|---|---|
| argfile 里保留 `\` | 所有 import 报"程序包不存在"，classpath 静默失效 | 统一改正斜杠 `/` |
| cp 文件带 BOM | 第一个条目失效，往往是主源码目录 | `-Encoding ASCII` 或 `TrimStart([char]0xFEFF)` |
| `-proc:none` | Lombok 的 `log` / getter 全找不到 | 用 `-proc:full` |
| 只传入口文件 | 同包兄弟类不走注解处理，冒假错 | 每个改动文件显式列出 |
| 用 `mvn dependency:build-classpath` | 离线仓库没装插件 → `PluginResolutionException` | 从 JVM 里取，不依赖插件 |
| `mvn -pl <路径>` | `Could not find the selected project in the reactor` | 加 `-f <root pom>`，或 `-pl :<artifactId>` |
| 用 `/d/...` 写 classpath | Java 读不到（原生 Windows 程序） | 全部 `D:/...` |
| 编完不重跑 | 拿旧 class 得"没问题"的错结论 | 改一次编一次 |

## 边界（必须讲清）

- 只证明**能编译**。打包、字节码增强、资源拷贝、Spring 装配仍然要等真实构建。
- classpath 取的是**当前运行版本**。若刚升级了依赖，结论只对旧版本有效。
- 编译通过 ≠ 逻辑正确。要验证行为，得重启后跑真实请求。

## 交付时怎么说

不要只说"编译通过"。说清三件事：

1. 编了哪些文件（数量 + 路径）
2. 用的哪套 classpath（运行中 JVM / fat jar）
3. 没做、还需要用户做的：**重启或重建**才能生效

最后一条不能省 —— 用户下一步就是点 Run，你替他想在前面。
