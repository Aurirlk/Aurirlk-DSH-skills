---
name: db-change-report
description: "数据库变更必须单独报备的五项内容：脚本文件名与类型、TEST 是否已执行、PROD 待执行清单与顺序、是否需重启或重建 jar、备份与回滚方式。配套给出幂等 SQL 写法、历史表替代备份表、两端一致性验证与不可回滚动作的确认纪律。适用于任何要改库结构的交付：DDL、数据 UPDATE、建备份表、给运维执行脚本。Database change reporting protocol: five mandatory disclosures plus idempotent SQL and rollback patterns. Triggers: 建表 / 改表 / DDL / 跑 SQL / 数据修复 / 数据库变更 / 上线脚本 / 备份表 / 回滚。"
whenToUse: "你写了或要执行 DDL、数据订正 UPDATE、建备份表、给运维一份待执行脚本时；或交付里涉及任何库改动、需要让另一个人去执行时。"
---

# 数据库变更报备

库改动和代码改动不是一回事。代码推错了可以再推一次，**库改错了往往只能靠备份**。

所以凡动库，交付里必须有**单独、明确**的一段报备 —— 不是顺带提一句"另外我改了张表"。

原因很现实：执行的人不是你。他需要知道的不是"你改了什么"，而是**他要做什么、按什么顺序、出错怎么办**。

## 一、五项必答（缺一项就是没报备）

| # | 必答项 | 写成什么样才算说清 |
|---|---|---|
| 1 | **脚本文件名与类型** | `script/sql/v1_9_33_xxx.sql` — DDL / 数据 UPDATE / 建备份表，逐条标明 |
| 2 | **TEST 是否已执行** | 「TEST 已执行，RC=0，列结构逐字核对一致」或「TEST 未执行」 |
| 3 | **PROD 待执行清单与顺序** | 按顺序编号列出；**有依赖关系必须写明谁先谁后** |
| 4 | **是否需重启 / 重建 jar** | 「立即生效，无需重启」或「需先重部署后端，再跑 DDL」 |
| 5 | **备份与回滚方式** | 备份表名 / 历史行 id；回滚用哪条 SQL；**不可回滚的要单独标注** |

第五条最容易糊过去。**「有备份」不是回滚方案** —— 得说出"用哪张表、哪一列、什么条件"。

## 二、顺序不是小事

有两种典型的顺序陷阱，方向相反：

### 1. 加列 / 建表 → 先库后码

新代码依赖新列。先跑 DDL，再部署。

### 2. 删列 / 改语义 → 先码后库

旧字节码还在读被删的列，先跑 DDL 会让**整个服务报错**。

> 真实事故：精简版本删了几列，DDL 先执行 → 旧 jar 启动即崩。
> 正确顺序是「先重部署后端 → 再跑 DDL」。

报备里必须明确写出这类方向，不能只给一个文件清单。

## 三、脚本要能重复执行

线上脚本经常会被"再跑一次确认"。所以默认按幂等写：

```sql
-- 建表
CREATE TABLE IF NOT EXISTS xxx (...);

-- 加列（MySQL 8 不支持 IF NOT EXISTS 时，用信息模式判断）
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='t' AND COLUMN_NAME='c');
SET @s := IF(@c = 0, 'ALTER TABLE t ADD COLUMN c INT NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- 数据订正：用一个哨兵条件保证只生效一次
UPDATE t SET ... WHERE id IN (...) AND status <> 'NEW_VALUE';
```

**哨兵条件要单一、可读、可验证**。比如「字段里还不含版本标记」。复跑后应当影响 0 行 —— 这是最直观的正确性证据。

**别在 `INSERT ... SELECT` 里子查询同一张表**：MySQL 会报 1093。要么先落临时表，要么拆两条语句。

## 四、历史表优于备份表

数据订正（尤其是提示词、配置、文案这类长文本）优先用**既有历史表**，而不是新建 `*_bak_*`：

```sql
-- 1. 改前整条落历史
INSERT INTO t_history (target_id, prompt, source, creator_id, create_dt)
SELECT id, instruction, 2, 1, NOW() FROM t WHERE id = ?;

-- 2. 再改本体
UPDATE t SET instruction = ? WHERE id = ? AND instruction NOT LIKE '%v1.9.29%';

-- 3. 回填改后内容（全文只写一遍）
UPDATE t_history h JOIN t a ON a.id = h.target_id
SET h.optimized_prompt = a.instruction
WHERE h.id = ?;
```

好处：

- **回滚 = 从历史行的旧值反向 UPDATE**，不需要额外的表
- 历史本身就是业务资产（谁在什么时候改成了什么）
- 少一张需要长期维护的备份表

代价：历史表必须有足够的列（改前 / 改后 / 来源 / 操作者），且 `NOT NULL` 列要照顾到 —— 新建对象的初版可能必须写空串而不是 NULL。

## 五、验证要有证据

报备里说"已执行"要附上证据，至少一条：

| 验证 | 命令 / 判据 |
|---|---|
| 结构一致 | `SHOW CREATE TABLE` 两端逐字对比，或列集合比对 |
| 数据一致 | 关键字段 MD5 两端相同 |
| 幂等 | 复跑后影响行数为 0 |
| 无残留 | 事务 rollback 后零脏数据；探针脚本全绿 |

**两端一致 ≠ 业务一致。** 如果两边行数不同，先确认是"脚本漏跑"还是"业务本身不同"。别把业务差异当脚本问题去"补齐"。

## 六、安全边界

- **禁止从本机直连生产库写数据**，除非用户明确授权，且当轮单独确认。
- 读写生产库只做只读排查（`SHOW`、`SELECT`、`SHOW PROCESSLIST`）。
- **`KILL` 连接、`DROP`、`TRUNCATE` 必须单独确认**，不能和"顺手清理"混在一次执行里。
- 测试基建只写在 `src/test` + 内存库（H2 之类），**不要为了让测试跑通去改生产 DDL**。
- DDL 脚本统一放 `script/sql/vX_Y_Z_*.sql`，并同步 schema 全量文件（新环境建库靠它，漏了就是"新环境静默缺表"）。

## 七、报备模板（可以直接抄）

```markdown
### 数据库变更报备

1. **脚本**：`script/sql/v1_9_33_xxx.sql`（DDL：新建 2 表 + 6 索引）
2. **TEST**：已执行，RC=0；`SHOW CREATE TABLE` 逐字核对一致；复跑影响 0 行
3. **PROD 待执行**（按顺序）：
   1. 先重部署后端（旧 jar 读不到新列）
   2. 执行 `v1_9_33_xxx.sql`
   3. 执行 `v1_9_34_xxx.sql`（依赖上一步的表）
4. **生效方式**：DDL 立即生效；后端需重建 jar（配置项无环境变量占位符，改 yml 无效）
5. **备份与回滚**：
   - 备份：`t_history` 新增 2 行（id=218/219），存改前全文
   - 回滚：`UPDATE t SET instruction = (SELECT prompt FROM t_history WHERE id=218) WHERE id=18`
   - ⚠️ 不可回滚：`DROP TABLE old_x`（已确认数据已迁出）
```

## 八、自检

- [ ] 五项都写了，不是"顺带一提"
- [ ] 顺序写清了，含"先部署还是先跑 DDL"
- [ ] 脚本幂等，复跑影响 0 行
- [ ] 回滚写到了表名 + 列 + 条件，不只是"有备份"
- [ ] 不可回滚的动作单独标了出来
- [ ] TEST 执行结果附了证据
- [ ] 没有本机直连生产写库
