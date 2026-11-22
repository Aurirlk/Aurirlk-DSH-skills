# db-pool-forensics

> 本技能是 [Aurirlk DSH Skills](../../README.md) 合集的一员 · [← 返回仓库目录](../../README.md)

**中文** | [English](README.en.md)

```
CannotGetJdbcConnectionException
total=20  active=20  idle=0
```

看到这三个数，**第一反应不该是"数据库挂了"**。

`active = total` 且 `idle = 0` 的意思是：**池子被应用自己借空了**。数据库可能好好的 —— 是你的代码不肯松手。

判断错方向，后面全错：查慢查询、加索引、找运维，而瓶颈在自己代码里。

## 什么时候用

- 报 `CannotGetJdbcConnectionException` / 连接等待超时 / 接口随机 500
- 「把池调大」这个方案到底对不对，需要有人给判断
- 上线前要配连接池阈值、加限流
- 日志里一堆泄漏警告，分不清是真泄漏还是误报

## 四步定位

```
1. 分清形态   → idle=0 是借空；idle>0 建连失败才是 DB 侧问题
2. 找到持有者 → 无上限并发 / 超时不取消的僵尸 / 后台批处理 / 长事务
3. 挂在汇入口 → 限流加在唯一 Service 方法，不是每个 Handler
4. 给证据     → 池回落 + 闸门降级计数 + 启动日志打出实际值
```

## 三个最容易被搞错的点

1. **`orTimeout` 不会取消底层任务**。等待方早返回了，底层还在排队等连接 —— 日志里没有报错，只有"越来越慢"。
2. **`leak-detection-threshold` 必须 ≥ `connection-timeout`**。设小了，每次正常慢查询都报泄漏，真问题被淹没。
3. **旧 jar 里 `maximum-pool-size` 是硬编码时，环境变量不生效**。"改配置 + 重启"是假动作，必须换 jar。

## ⚠️ 风险声明

这个技能会指导 agent **排查并修改生产连接池配置**，属于高危操作。

- 应急重启能释放连接，但不修复根因
- 停服只 `kill` 精确 PID，禁止 `pkill -f 应用名`（会连坐其它服务）
- 扩池只能争取时间，必须同时限流

## 用法

```
线上报连接池耗尽了，total=20 active=20 idle=0，帮我定位
```

```
有人建议把 maximum-pool-size 调到 50，这个方案对不对
```

完整判据表和配置陷阱见 [SKILL.md](SKILL.md)。

## 安装

```powershell
cd "$env:USERPROFILE\.dsh\profiles\desktop"
pnpm add github:Aurirlk/Aurirlk-DSH-skills
```

## 边界

- 以 HikariCP + MySQL 为主，判据对 Druid / Tomcat JDBC 同样适用
- 不覆盖分库分表、读写分离路由策略
- 「外部方案要不要照抄」这一段是通用的：**先在代码里定位方案假设的那几行**
