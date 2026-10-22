# SaaS 底座竞品对比

核对日期：2026-10-21（Asia/Shanghai）。价格为当次公开页面显示的美元金额，可能变化，未进入结账页核对税费。功能来自官方公开材料；私有商业代码未审计，所有项目均未在本轮安装运行。

## 商业模板：功能对标

| 产品                                     | 当次公开价格                                        | 主要路线                                                         | 强项                                           | 对我们意味着什么                                                                   |
| ---------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| [TanStarter](https://tanstarter.dev/)    | $139，一次性                                        | TanStack Start / Cloudflare Workers / D1 / Drizzle / Better Auth | Cloudflare 全栈整合，含 AI 图片模板            | 当前已选同类 CF 技术路线；重点对标初始化、实际业务闭环与更新，不以框架差异作为优势 |
| [MkSaaS](https://www.mksaas.com/)        | $129，一次性促销                                    | Next.js / Better Auth / Drizzle                                  | AI、内容、营销页面和多个示例代码库             | 借鉴从定价到用户后台的完整路径，不以组件数量竞争                                   |
| [ShipFast](https://shipfa.st/)           | Starter $199，All-in $249                           | Next.js / MongoDB 或 Supabase / Stripe 或 Lemon Squeezy          | 个人开发者快速启动，文档与社区                 | 借鉴短路径上手；不照搬私有代码，也不接受“几天盈利”等营销承诺作为证据               |
| [supastarter](https://supastarter.dev/)  | Solo $349；Startup $799；Agency $1,499              | 主页提供 Next.js、Nuxt、TanStack Start 选择                      | 组织、多租户、多支付、离线开发、E2E 与部署指南 | 完整度上限参考；首版不会追求多框架与组织计费的同等范围                             |
| [Makerkit 商业版](https://makerkit.dev/) | 主页入口显示促销 $299、划线 $349；具体 kit/席位另选 | Next.js，提供不同数据栈                                          | 多租户、计费、升级流程、Agent 规则及 MCP       | “支持 AI”已经是行业常见卖点；需要用实际项目和升级演练证明我们的价值                |

维护边界：商业站展示更新与支持承诺，但本轮没有私有仓库权限。ShipFast 页面当次显示“8 months ago”，supastarter 显示“12 days ago”；这些是厂商页面信号，不能换算成漏洞数或稳定性排名。TanStarter 与 MkSaaS 显示的提交数量也未在私有仓库独立验证。

## 开源项目：可考虑的复用与参考来源

选型修订：前版遗漏 TanStack 的开源项目，不能由此前表格得出“TanStack 没有开源底座”。以下补入一个已读取 README、LICENSE 与仓库元数据的同栈参考；这不是穷尽清单。

| 项目                                                                      | 核对许可 | 官方主要能力                                                                       | 最近默认分支提交（UTC） | 取舍                                                                                                   |
| ------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------ |
| [oakoss/open-saas-kit](https://github.com/oakoss/open-saas-kit)           | MIT      | TanStack Start / Better Auth / Drizzle / PostgreSQL，React Aria UI，pnpm/Turborepo | 2026-01-26              | 同栈集成参考；本轮未运行，README 未列出完整计费闭环，不推定其“fully featured”覆盖全部 SaaS 能力        |
| [Open SaaS](https://github.com/wasp-lang/open-saas)                       | MIT      | Wasp / React / Node / Prisma，认证、支付、邮件、后台任务、S3、E2E、AI 开发支持     | 2026-10-19              | 最值得对标“免费完整 SaaS”；完整采用意味着选择 Wasp，而不是普通 Next.js 项目                            |
| [Next.js SaaS Starter](https://github.com/nextjs/saas-starter)            | MIT      | Next.js / PostgreSQL / Drizzle / shadcn，Stripe、基础团队角色、活动日志            | 2025-12-11              | 数据与支付流程的精简参考；当前框架推荐改为 TanStack，路由不能照搬；README 明确是学习资源               |
| [Makerkit Lite](https://github.com/makerkit/nextjs-saas-starter-kit-lite) | MIT      | Next.js / Supabase / Turborepo，认证、设置、营销页、i18n、基础 Playwright          | 2026-10-15              | 结构与约定有参考价值；完整支付、团队、后台等属于商业版，不可当成 Lite 免费能力                         |
| [Saasfly](https://github.com/nextify-limited/saasfly)                     | MIT      | Next.js / PostgreSQL / Stripe / Resend，Bun 工作流；README 说明默认认证改用 Clerk  | 2025-08-04              | 中文与整合经验可参考；README 仍有新旧认证说明混杂，管理员页标注 alpha/static，不能据列表声称全链路可用 |

上表已读取各仓库 LICENSE。MIT 须保留版权与许可通知；并不代表所有图像、第三方资源及依赖都由这一份许可覆盖。实际采用应锁定 commit 并单独建来源记录。

维护信号采用默认分支最近提交，避免把 GitHub `updated_at`（可能受 star 等活动影响）当作开发更新；`pushed_at` 也可能反映其他分支，不能直接当作主干版本时间。提交新旧仅帮助评估升级工作量，不单独证明代码质量、安全性或可用性。[结构化快照](research/repositories.json)

## 不能混为一谈的许可

- [MkSaaS License](https://mksaas.com/license)：禁止将其代码制作成免费或收费的衍生 starter kit。
- [ShipFast License](https://shipfa.st/license)：禁止作为独立 boilerplate 再分发。
- [supastarter License](https://supastarter.dev/legal/license)：禁止未经允许再分发或销售代码本身；其有条件 fair-code 描述不等于可直接 MIT 开源。
- [Makerkit 商业 EULA](https://makerkit.dev/license)：明确禁止开源商业版及其衍生作品，禁止用作 starter kit。**Makerkit Lite 仓库自己的 MIT 与商业版 EULA 分开判断。**
- [TanStarter Terms](https://tanstarter.dev/terms)：读取到的是一般服务条款，未发现明确的开源再分发授权，因此不纳入可复制的源码来源；也不把其他产品的许可推定适用于它。

开源版本应独立实现业务连接，合法复用开源组件。购买商业模板获得应用开发授权，不代表可以将该模板换品牌后公开。

## 结论与竞争方向

**不以免费、AI 友好、多提供商、开源本身作为独有优势。** Open SaaS、Makerkit 等已经覆盖其中多项。

建议先兑现四个可验证目标：

1. 无真实付费账户可启动核心流程，开发者能从中文文档复现。
2. 支付、权益、额度、用户隔离有实际测试与可追溯结果。
3. 两个独立项目持续使用，并完成一次真实升级。
4. 依赖、可选服务、源码许可和不支持的环境说明清楚，首版保持可读规模。

这些是拟建立的优势，不是已有成果。若愿意接受 Wasp，直接基于 Open SaaS 定制会减少自行整合工作；本方案当前选择 TanStack Start，以贴合交互型 Web/AI 工具和自有底座的目标。TanStack 本身已有开源 starter，不能把“框架 + 开源”当作空白市场；承担的整合与维护成本必须承认。

## 来源冲突与未知

- MkSaaS 搜索缓存显示 $139，当前实际页面显示 $129；对比表采用当次浏览器页面。
- supastarter 个别旧框架页或缓存显示 $299、早期折扣，当前主页 Solo 显示 $349；不把旧价作为当前统一售价。
- Makerkit Lite README 同时出现较新和较旧的框架/工具描述，因此不据 README 罗列精确运行时版本；实现前看 package/lockfile 并实测。
- Cloudflare Next.js 的旧文档/预览域仍可看到 OpenNext 首选叙述；正式当前域推荐 vinext 并标 beta。本方案引用正式页面。
- 私有模板的幂等、隔离、升级体验和“production-ready”仅有公开表述，未完成源码审计与运行验收。
- 公开用户数、收入案例、节省工时都不是本轮独立验证数据，不用于选型评分。
