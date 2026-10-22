# 官方来源与证据边界

访问日期：2026-10-21（Asia/Shanghai）。仅记录本轮实际访问的一手来源，不将宣传承诺当作运行验收。

## 商业产品

| 来源                                                                     | 本轮观察                                     | 使用边界                           |
| ------------------------------------------------------------------------ | -------------------------------------------- | ---------------------------------- |
| [TanStarter](https://tanstarter.dev/)                                    | $139；TanStack Start / Workers；公开功能范围 | 页面事实，私有源码未验             |
| [TanStarter codebase](https://docs.tanstarter.dev/codebase)              | 主模板及 MkImage 模板说明                    | 前序本会话已读；不代表访问私有仓库 |
| [TanStarter payment](https://docs.tanstarter.dev/payment)                | 公开订单关联、回调与支付扩展说明             | 本会话前序已读，不是实现审计       |
| [TanStarter Terms](https://tanstarter.dev/terms)                         | 一般条款，无明确开源再分发授权               | 不纳入代码采用来源                 |
| [MkSaaS](https://www.mksaas.com/)                                        | $129 促销，Next.js 路线及公开能力            | 现场页面优先于搜索缓存             |
| [MkSaaS License](https://mksaas.com/license)                             | starter 再分发及衍生产品限制                 | 功能对标                           |
| [ShipFast](https://shipfa.st/)                                           | Starter $199 / All-in $249；页面更新信号     | 厂商陈述，非代码质量结论           |
| [ShipFast License](https://shipfa.st/license)                            | 禁止独立 boilerplate 再分发                  | 不采用私有代码                     |
| [supastarter](https://supastarter.dev/)                                  | Solo $349；组织、E2E、离线开发等公开能力     | 按当前主页，不采用旧价             |
| [supastarter TanStack 文档](https://supastarter.dev/docs/tanstack-start) | SaaS 与 marketing 应用拆分、商业许可说明     | 对标较大规模结构，不原样照搬       |
| [supastarter License](https://supastarter.dev/legal/license)             | 限制未经允许的再分发                         | 非通用开源许可                     |
| [Makerkit](https://makerkit.dev/)                                        | 入口 $299 促销；商业功能与 AI 规则说明       | 具体 kit 与席位价格仍可不同        |
| [Makerkit EULA](https://makerkit.dev/license)                            | 商业版禁止开源和制作 starter                 | 不套用到单独 MIT 的 Lite 仓库      |

## 开源仓库

以下通过 GitHub 连接器读取仓库元数据、README、LICENSE 和默认分支最新提交；未 clone、安装、测试或执行仓库提供的脚本。

| 仓库                                                                      | README                                                                                 | LICENSE                                                                           | 默认分支提交                                                                                                        |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| [oakoss/open-saas-kit](https://github.com/oakoss/open-saas-kit)           | [README](https://github.com/oakoss/open-saas-kit/blob/main/README.md)                  | [MIT](https://github.com/oakoss/open-saas-kit/blob/main/LICENSE)                  | [31598e6](https://github.com/oakoss/open-saas-kit/commit/31598e63e8ed1fb2dafd7a0b6712595cc3268938)                  |
| [Open SaaS](https://github.com/wasp-lang/open-saas)                       | [README](https://github.com/wasp-lang/open-saas/blob/main/README.md)                   | [MIT](https://github.com/wasp-lang/open-saas/blob/main/LICENSE)                   | [5859df7](https://github.com/wasp-lang/open-saas/commit/5859df70e93ddd04d183323934e9c9e2ae1c81c5)                   |
| [Next.js SaaS Starter](https://github.com/nextjs/saas-starter)            | [README](https://github.com/nextjs/saas-starter/blob/main/README.md)                   | [MIT](https://github.com/nextjs/saas-starter/blob/main/LICENSE)                   | [6e33e58](https://github.com/nextjs/saas-starter/commit/6e33e58b1e553a41fe22e6b941a7229a002de361)                   |
| [Makerkit Lite](https://github.com/makerkit/nextjs-saas-starter-kit-lite) | [README](https://github.com/makerkit/nextjs-saas-starter-kit-lite/blob/main/README.md) | [MIT](https://github.com/makerkit/nextjs-saas-starter-kit-lite/blob/main/LICENSE) | [9ff430d](https://github.com/makerkit/nextjs-saas-starter-kit-lite/commit/9ff430df9c58516add0136bd01ed800ce551675e) |
| [Saasfly](https://github.com/nextify-limited/saasfly)                     | [README](https://github.com/nextify-limited/saasfly/blob/main/README.md)               | [MIT](https://github.com/nextify-limited/saasfly/blob/main/LICENSE)               | [49f7e28](https://github.com/nextify-limited/saasfly/commit/49f7e28f69eae9cd9eed84221e13a3dbae87da67)               |

README / LICENSE 的文件 SHA 和元数据见 [repositories.json](research/repositories.json)。这些是调研定位信息，不代表本项目已采用相应源码。

## 技术决策

- [Next.js 部署](https://nextjs.org/docs/app/getting-started/deploying)：Node.js / Docker 与静态导出的能力区别。
- [TanStack Start 部署](https://tanstack.com/start/latest/docs/framework/react/guide/hosting)：当前推荐框架的 Node / Cloudflare 等部署路线。
- [TanStack Start 认证](https://tanstack.com/start/latest/docs/framework/react/guide/authentication)：服务端数据边界授权与认证库职责。
- [Better Auth Drizzle 适配](https://better-auth.com/docs/adapters/drizzle)：集成能力依据，具体 API 实现时再核对固定版本。
- [AI SDK](https://ai-sdk.dev/docs/introduction)：TypeScript、多模型接口和流式应用能力依据。
- [Cloudflare Next.js](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)：浏览器核对，当前推荐 vinext，页面明确 beta，并保留其他部署路径说明。
- [Cloudflare TanStack Start](https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/)：当前默认全栈 Cloudflare 路线。

## 事实、判断与未知

- **事实**：页面显示的价格、许可文件内容、仓库提交和 README 自述。
- **厂商陈述**：production-ready、节省工时、用户与收入数量、支持质量和速度。
- **用户已确定**：采用 TanStack 与 Cloudflare 全栈。方案据此改为 Workers / D1 / R2，保持单应用和有限模块；前版 PostgreSQL / Node 部署建议已被替代。
- **未验证**：任何竞品全链路质量、真实支付账户资格、本底座运行与部署、跨项目升级成本、固定月度成本。

## Cloudflare 当前配额与运行依据

以下本轮实时核对，详细数值、范围及使用建议见 [Cloudflare 全栈方案](CLOUDFLARE.md)。当前账户的服务开通状态尚未检查。

- [Workers 价格](https://developers.cloudflare.com/workers/platform/pricing/)
- [Workers 限制](https://developers.cloudflare.com/workers/platform/limits/)
- [D1 价格](https://developers.cloudflare.com/d1/platform/pricing/)
- [D1 限制](https://developers.cloudflare.com/d1/platform/limits/)
- [D1 batch](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)
- [R2 价格](https://developers.cloudflare.com/r2/pricing/)
- [KV 价格](https://developers.cloudflare.com/kv/platform/pricing/)
- [KV 一致性](https://developers.cloudflare.com/kv/concepts/how-kv-works/)
- [Workers AI 价格](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [Email Service 价格](https://developers.cloudflare.com/email-service/platform/pricing/)
- [Email Sending 域名与发送](https://developers.cloudflare.com/email-service/get-started/send-emails/)

本方案沿用过往项目的一项工作原则：软件底座、具体产品业务与服务交付分开处理；任何未接通的服务都明确标注。过往支付政策笔记不作为当前政策结论，实际启用支付提供商时重新核对其要求。
