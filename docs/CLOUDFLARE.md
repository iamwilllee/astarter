# Cloudflare 全栈决定与成本边界

核对日期：2026-10-21（Asia/Shanghai）。状态：v0.1 已在本地 Workers/D1 模拟运行；尚未创建云资源、启用付费套餐或部署。R2 目前仅预留 binding，KV/AI/后台任务未接入。

## 1. 默认架构

**TanStack Start / React / Vite → Cloudflare Workers → D1 / R2**。沿用 pnpm、TypeScript、shadcn/ui、Lucide、Better Auth 与 Drizzle。

| 部分       | 默认方案                                         | 职责                                                       |
| ---------- | ------------------------------------------------ | ---------------------------------------------------------- |
| Web 与 API | Workers + Cloudflare Vite plugin                 | SSR、server functions、HTTP API、支付回调                  |
| 静态资源   | Workers Static Assets                            | JS、CSS、字体和公开静态文件，不让每个静态请求执行动态应用  |
| 数据库     | D1 + Drizzle SQLite/D1 方言                      | 用户、会话、业务记录、订单、权益、额度流水                 |
| 文件       | R2                                               | 私有用户文件；D1 存元数据、归属与访问规则                  |
| 缓存       | KV / Cache API，按需启用                         | 公开配置和可容忍陈旧的数据；不承载强一致扣费               |
| 邮件       | Cloudflare Email Service 优先，提供商接口可替换  | 验证、重置密码与事务邮件；需要对应账户计划和域名配置       |
| AI         | Workers AI 优先评估，可接外部供应商              | 先做一个文本能力样例；模型质量、接口与用量实测决定是否适用 |
| 后台任务   | 先满足明确业务，再评估 Cron / Queues / Workflows | 不把无限等待或请求结束后的内存任务当作可靠任务队列         |

不并行维护 PostgreSQL、Docker 服务端和多云部署。保留清楚的业务模块和 SQL 来源，后续如需迁出另做工程与验收，不承诺零成本可移植。

## 2. 当前免费额度

| 服务             | 当前免费额度                                                                      | 来源                                                                   |
| ---------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Workers Free     | 动态请求 100,000/日；每次调用 CPU 10ms                                            | [价格](https://developers.cloudflare.com/workers/platform/pricing/)    |
| D1 Free          | 读取 500 万行/日，写入 10 万行/日；账户总存储 5GB                                 | [价格](https://developers.cloudflare.com/d1/platform/pricing/)         |
| D1 Free 容量限制 | 单库 500MB，每账户 10 个数据库                                                    | [限制](https://developers.cloudflare.com/d1/platform/limits/)          |
| R2 Standard      | 10 GB-month 存储/月，100 万次 Class A、1,000 万次 Class B 操作/月，出站流量无费用 | [价格](https://developers.cloudflare.com/r2/pricing/)                  |
| KV Free          | 读 10 万次/日，写/删/列举各 1,000 次/日，1GB 存储                                 | [价格](https://developers.cloudflare.com/kv/platform/pricing/)         |
| Workers AI       | 10,000 Neurons/日；不是固定 token 或请求数                                        | [价格](https://developers.cloudflare.com/workers-ai/platform/pricing/) |

额度按产品和账户规则计算，不能通过给每个项目创建新 Worker 或新 D1 就假设得到一份独立免费套餐。D1 以扫描/写入的行数计量，不以一次 SQL 请求算一次读取；索引与查询策略必须一起设计。免费配额耗尽可能返回错误，不等于自动无限续用。

## 3. 付费边界

Workers Paid 当前最低 **$5/账户/月**，按用量可能增加。首版支持先在免费计划评估，同时为正式业务保留升级路径；不自动开通或购买。价格与额度均是本次官方快照，发布前再核对。

免费版 10ms 是 CPU 执行时间，不是用户等待的总时间。SSR、密码哈希等可能先触及 CPU 限制；需要用实际版本和场景验证，不能只用“每天 10 万请求”判断可用容量。不会降低密码哈希强度来追求免费计划。

Cloudflare Email 向任意收件人发送需要 Workers Paid，目前含每账户每月 3,000 封，超出 $0.35/1,000 封。免费向账户内已验证目的地址发送不等于能免费给所有注册用户发送验证码。Email Sending 当前标注 beta，且要求 Cloudflare DNS 与发送域名配置；接入时核对账户实际可用性。[邮件价格](https://developers.cloudflare.com/email-service/platform/pricing/)、[接入说明](https://developers.cloudflare.com/email-service/get-started/send-emails/)

域名、外部 AI、支付处理费等单独预算。R2 出站流量免费仍有存储和操作计量；Workers AI 额度也不能抵扣其他模型供应商的费用。

## 4. D1 与一致性

采用 D1 不是把 PostgreSQL 连接串换掉：从 schema 开始使用 SQLite/D1 约束、类型和迁移。Better Auth 的表结构与插件需要按固定版本生成并验收。

- 支付事件使用提供商事件标识与唯一约束去重；事件处理、权益更新与完成标记保证失败可恢复。
- 额度采用条件更新、请求幂等标识与流水，避免应用层“先读余额再无条件写回”。
- 多语句原子操作评估 D1 `batch()`，按条件写入语义设计并发测试；不假设它等价于任意 PostgreSQL 交互式事务。[batch 文档](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)
- KV 是最终一致缓存，不能作订单真相、余额、强一致锁或敏感权限撤销的唯一依据。[一致性说明](https://developers.cloudflare.com/kv/concepts/how-kv-works/)
- 业务正确性不能只依赖同一个 Worker 实例中的内存变量。确有单实体协调需求时再评估 Durable Objects。
- 首版以 D1 主库路径为准；若以后启用读副本，需要按 Sessions / bookmark 语义处理写后读，而不是让支付和权益读取到陈旧状态。

## 5. 开发、隔离与验收

本地通过 Cloudflare Vite / Wrangler 的运行时、D1 和 R2 模拟完成核心开发，不要求先提供生产密钥。邮件使用本地测试收件箱；本地模拟结果不视为真实投递。

每个项目拥有独立 Worker、D1 与 bucket；本地、预发布、生产不共用敏感数据。配置只提交 binding 名称与示例，账户标识和资源绑定按环境生成，密钥通过 secrets 管理。多个项目仍需汇总账户成本。

首批验收包括：本地迁移及重启后数据恢复、跨用户隔离、测试支付重复/乱序事件、额度并发、私有文件权限、云端预发布 bindings、身份流程 CPU 与延迟、D1 查询行数、数据库导出恢复和代码发布回退。数据迁移恢复与代码回退分别验证。

部署时检查账户计划、域名和已存在资源。本轮仅更新文档，未创建云资源、修改 DNS、启用付费套餐或发送邮件。
