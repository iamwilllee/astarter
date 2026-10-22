# Cloudflare 架构

Aster 使用 TanStack Start / React / Vite，由 Cloudflare Workers 承载 SSR、服务端函数和 HTTP API。Drizzle 管理 D1 schema 与迁移。

| 能力                | 当前实现                                                       |
| ------------------- | -------------------------------------------------------------- |
| Web、API 与静态资源 | Workers + Cloudflare Vite plugin                               |
| 数据                | D1：用户、会话、私有项目、限流与测试订阅状态                   |
| 邮件                | 本地收件箱；可选 Cloudflare 发信适配，需独立配置与真实投递验收 |
| 文件                | 根配置预留 R2 binding，尚无文件业务                            |
| AI、队列与定时任务  | 尚未接入，按具体产品需求增加                                   |

## 隔离与一致性

每个产品独立配置 Worker、D1、域名和密钥；本地使用自身目录的 `.wrangler`，不复制源模板的开发数据。预发布与生产使用独立环境配置。数据库配置名 `starter-db` 为兼容标识，不代表多个产品共用数据库。

Cloudflare bindings 仅从服务端模块导入。认证按请求构建，私有 SQL 限定当前用户。项目上限通过原子条件写入保证；测试支付事件验签、去重并以提供商当前状态同步，不能依赖成功跳转或进程内变量授予权益。

KV 不能作为余额、权限或锁的唯一权威来源。文件业务接入时需要额外完成归属、访问控制与失败处理。

## 成本与部署

实际用量、套餐和资格以账户及官方文档为准；多个项目需汇总账户成本。动态请求、CPU、D1 扫描行数、存储、邮件与模型调用分别评估，不能只凭免费请求数判断正式业务容量。

- [Workers 定价](https://developers.cloudflare.com/workers/platform/pricing/)
- [D1 定价](https://developers.cloudflare.com/d1/platform/pricing/)
- [R2 定价](https://developers.cloudflare.com/r2/pricing/)
- [Email Service](https://developers.cloudflare.com/email-service/)

本地模拟不代表云端能力或真实供应商已通过。部署、资源配置与远端验收步骤见 [部署手册](DEPLOYMENT.md)。
