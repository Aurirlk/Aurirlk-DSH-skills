# db-pool-forensics

> Part of the [Aurirlk DSH Skills](../../README.en.md) collection · [← Back to index](../../README.en.md)

[中文](README.md) | **English**

```
CannotGetJdbcConnectionException
total=20  active=20  idle=0
```

Your first instinct should **not** be "the database is down".

`active = total` and `idle = 0` means the application borrowed every connection and returned none. The database may be perfectly healthy — your code just won't let go.

Guess wrong here and everything downstream is wrong: slow-query hunting, index tuning, paging the DBA — while the bottleneck is in your own process.

## When to use

- `CannotGetJdbcConnectionException`, connection acquisition timeouts, random 500s
- Someone proposes "just raise the pool size" and you need a verdict
- Configuring pool thresholds or adding rate limiting before a release
- Logs full of leak warnings — real leak or false positives?

## Four steps

```
1. Identify the shape   → idle=0 means borrowed dry; idle>0 with failed connects is a DB-side problem
2. Find the holders     → unbounded concurrency / zombie tasks / background jobs / long transactions
3. Throttle at the choke point → the single service method, not every handler
4. Produce evidence     → pool returns to normal + throttle counters + startup log of effective values
```

## Three things people get wrong

1. **`orTimeout` does not cancel the underlying task.** The caller returns early; the task keeps queuing for a connection. No errors in logs — just "getting slower".
2. **`leak-detection-threshold` must be ≥ `connection-timeout`.** Set it lower and every normal slow query reports a leak, drowning the real one.
3. **If `maximum-pool-size` is hardcoded in the deployed jar, environment variables do nothing.** "Change config and restart" is theatre — you must rebuild the jar.

## ⚠️ Risk notice

This skill guides changes to **production connection-pool configuration**.

- A restart frees connections but fixes nothing
- Stop the service with an exact PID — never `pkill -f <app-name>` (it takes neighbours down)
- Enlarging the pool buys time only; it must be paired with throttling

## Usage

```
Production is out of connections: total=20 active=20 idle=0. Help me locate it.
```

```
Someone wants to raise maximum-pool-size to 50. Is that the right fix?
```

## Boundaries

- HikariCP + MySQL focused; the diagnostics apply equally to Druid and Tomcat JDBC
- Sharding and read/write routing strategies are out of scope
- The "don't copy generic templates" section generalises: **locate the lines the proposal assumes, in your repo**
