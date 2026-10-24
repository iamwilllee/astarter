# Aster

**给 Agent 一个可靠的起点。** 基于 TanStack Start 和 Cloudflare 的开源产品底座，MIT 许可，中文文档，适合独立开发与 AI 辅助开发。

主要服务**海外 Web / AI 工具，兼顾国内**。先验证 Cloudflare 部署与 Stripe 测试订阅；国内访问、登录和支付按具体产品适配。已有项目不强制迁移。

源码仓库为 [iamwilllee/aster](https://github.com/iamwilllee/aster)。当前版本 **v0.2.0，本地预览版**：已实现并验证本地流程，尚未部署到 Cloudflare。Stripe 仅允许测试密钥，未完成真实测试账户的托管结账验收。

![Aster Logo](public/brand/aster-logo.svg)

## 开始使用

需要 Node.js 24、pnpm 12.11.2。不需要 Cloudflare、Stripe 或邮件账户即可运行本地核心功能。

```bash
git clone https://github.com/iamwilllee/aster.git
cd aster
pnpm install --frozen-lockfile
pnpm setup
pnpm dev
```

打开 http://127.0.0.1:3100（英文）或 http://127.0.0.1:3100/zh（中文）→ 注册 → 从「本地测试收件箱」打开验证链接 → 登录。不要把开发服务器暴露到公网。本地收件箱含验证/重置链接，只在本地模式、匹配的回环地址开放。

`pnpm setup` 自动生成未入库的 `.dev.vars` 和随机密钥、生成 Workers 类型并迁移本地 D1；重复执行保留已有配置和数据。数据库位于 `.wrangler/state/`。没有预置管理员或共享默认密码。

## 首版能力

| 模块                                       | 状态                                              |
| ------------------------------------------ | ------------------------------------------------- |
| 邮箱注册、验证、重发、登录、退出、重置密码 | 已实现；本地邮件收件箱已验收                      |
| 私有项目增删改查、筛选、状态               | 已实现；D1 持久化、账户隔离                       |
| 个人资料、会话、管理员只读用户列表         | 已实现；管理员需显式授予                          |
| 示例 Free / Pro 权益                       | 服务端强制项目上限，原子检查并发创建              |
| Stripe 测试订阅、账单门户、Webhook         | 代码及签名/D1 测试已通过；托管结账待测试账户验收  |
| Cloudflare 发信                            | binding 适配已实现；真实投递未验收                |
| 首页、套餐页、工作台、中英切换、深浅主题   | 英文默认，中文 URL；SSR、邮件、错误、SEO 已本地化 |
| Google OAuth                               | 默认不展示；可选接入，真实账户回调待验收          |
| 预发布隔离、私有写入限流                   | 独立 staging 配置；每用户每分钟 30 次私有写入     |
| R2 文件、AI、消费额度账本                  | 功能未接入；按真实产品需要增加                    |

前端：React、TanStack Router / Query、Tailwind CSS、shadcn/ui base-nova、Base UI、Lucide。服务端：Workers、Better Auth、Drizzle、D1。没有同时引入另一套 UI、表单或全局状态框架；拖拽/动画按真实需求再引入。

基础控件包含 Button、Input、Select、Textarea；单行尺寸统一为 32/36/44px，默认 36px。业务页面的原生控件、直接 Base UI 导入与共享控件尺寸覆盖由 ESLint 检查；新增控件先在 UI 层封装。具体 API、布局边界与验收要求见 [前端约定](docs/FRONTEND.md)。

组件样板：[本地英文](http://127.0.0.1:3100/dev/ui) · [本地中文](http://127.0.0.1:3100/zh/dev/ui)。包含基础组件、列表/详情/设置组合及两种视觉排版方向，仅匹配的本机开发来源开放；演示不保存业务数据，生产路径返回 404。

内置 Tabs、DropdownMenu、Checkbox、Switch、Tooltip、Skeleton、Toast 与语义 Table。项目页示范卡片/表格切换、详情与分页，设置页示范分组布局。Agent 在 `PROJECT.md` 记录产品视觉方向与页面结构，复用组件和组合；新产品可以调整品牌与排版，无需沿用绿色工作台。入口和使用边界见 [前端约定](docs/FRONTEND.md)。

## 开发与检查

```bash
pnpm check                 # plan → locale → build → lint → typecheck → tests
pnpm exec playwright install chromium
pnpm test:e2e              # 本地浏览器与 API 验收，自动启动开发服务
pnpm test:production       # 隔离 D1 / 假 OAuth 配置 / HTTPS 生产构建验收
pnpm format:check
pnpm admin:grant you@example.test    # 仅本地 D1；账户须先注册
pnpm admin:revoke you@example.test
```

`test:production` 不读取开发库或开发密钥，不访问 Google 登录页；会临时占用 3110 端口。Google、邮件和 Stripe 的真实供应商验收仍需另做。

登录方式默认称呼 + 邮箱 + 密码，Google 按需选择，未配置时不向访客展示占位按钮。公开注册发布前须完成所选邮箱和/或 OAuth 的配置与真实验收；公开展示站不要求注册能力；未就绪的数据预览先使用 staging。发布检查会校验当前项目认证验收记录，实际部署还只读核对远端 secret 名称。详见 [认证发布时序](docs/DEPLOYMENT.md#认证选择与发布时序)。

邮件支持本地收件箱、Cloudflare、Brevo 和 Resend。优先用户选择或已有服务；没有既有选择且已核实适用的 Workers Paid 时默认优先 CF，否则按偏好与环境比较 Brevo / Resend 免费档。两种外部适配已实现，真实账号/域名及收信仍待产品各自验收。配置与已有产品增量接入见 [邮件指南](docs/MAIL.md)。

首次 `typecheck` 前先运行 `setup` 与 `build`，生成 bindings 和路由类型。测试使用独立 fixture 用户，不调用实际 Stripe 或发真实邮件；浏览器测试会在本地 D1 留下测试账户。源码、迁移、测试、锁文件和生成的类型均可查看。

## 用于自己的项目

按需求选择能力：公开展示站可关闭认证、D1、邮件和支付；普通数据应用选择 web-app；AI 不默认启用。初始化支持 `--profile showcase|web-app|billing-test`，已有产品用 `project:modules` 预览并增量调整。页面、接口、配置和发布检查遵循同一份公开能力配置，见 [按需组合](docs/MODULES.md)。

在底座源目录一次安装 Skill：

```bash
pnpm skill:install
```

安装后，在已经打开的站点项目里直接说：

```text
$aster-new 在当前项目做 Snippet Shelf：
做一个私人代码片段库，支持新建、搜索、编辑和删除，中英文和手机可用。
完成本地首版，暂不部署。
```

不通过 Agent，也可以一个终端命令初始化：

```bash
pnpm aster:new ../snippet-shelf --name "Snippet Shelf" --brief "私人代码片段库"
```

目标可以是未创建的目录、已建好的空目录，或只有 Git/说明/编辑器配置的项目根目录；缺失的父目录会创建。命令原地补齐底座、替换产品名、生成 `PROJECT.md` 和独立密钥、安装依赖、迁移本地 D1。它保留示例业务，不会替你实现需求；业务开发由 Skill 中的 Agent 继续完成。只需要复制文件时加 `--no-install`。

已有 README 保留，新说明写 ASTER.md；已有 AGENTS/.gitignore 追加底座约定，Git 与编辑器配置保留。已有 Aster 或其他应用只返回检查结果，由 Skill 复用原项目继续开发。可加 `--inspect` 只读查看判断结果；目标省略时使用命令当前目录，底座源目录仍受保护。

新产品不继承开发库、真实云 ID、密钥或发信/支付开关；保留许可、迁移和底座版本。初始化不建 Git 仓库、不创建云资源、不自动启动服务。生成项目的命令在新目录执行，Agent 的写入权限仍由当前工具决定。

详见 [Agent 使用指南](docs/AGENT-GUIDE.md)；[产品需求模板](docs/templates/PROJECT-BRIEF.md) 由命令自动生成到新项目的 `PROJECT.md`。Skill 安装为指向此底座的链接；保留底座目录。当前未发布 npm 包，其他 Agent 可克隆本仓库后直接使用 CLI 或读取仓库中的 [Skill](skills/aster-new/SKILL.md)。

- `src/config/site.ts`：品牌名、描述与服务端项目上限。页面示例文案和套餐说明也需相应调整。
- `src/styles.css`、`public/favicon.svg`：主题与图标。
- `src/modules/`：认证、邮件、支付及项目校验；按业务增加模块。
- `src/db/schema.ts` + `migrations/`：数据模型和可追溯 SQL。
- `AGENTS.md`：供 AI 协作时遵守的目录与边界。
- `starter-version.json` + `CHANGELOG.md`：记录底座版本；`.aster/baseline.json` 保存产品哈希基线和逐文件采用记录。

新项目现在还提供：

```bash
pnpm project:doctor         # 检查环境、端口和缺失配置，不显示密钥
pnpm project:status         # 查看任务、验收和下一步
pnpm project:resume         # 初始化中断后继续，保留业务与密钥
pnpm project:check --ready  # 检查必需业务验收记录，未完成时拒绝通过
pnpm project:upgrade scan --source /path/to/aster  # 只读扫描来源与产品差异
```

Skill 根据上下文填写机器计划并保留判断依据，Agent 按业务步骤实测并保存证据。源码底座不填虚构产品计划；生成项目中的 `starter.project.json` 才是该产品的状态记录。基础检查与实际业务验收分开，详细格式见 [流程说明](skills/aster-new/references/workflow.md)。

已有产品可以直接说 `$aster-new 检查当前底座更新，接入适合本项目的改进并完成回归`。工具识别同版本内容变化，对未定制文件提供带备份的更新/回退；业务冲突、品牌配置、迁移和无基线旧项目由 Agent 审查合并。局部采用不改整个来源版本，不继承上游验收。旧项目可直接运行源目录脚本，无需先安装新命令。详见 [升级指南](docs/UPGRADING.md)。

## 文档

- [交给 Agent 使用](docs/AGENT-GUIDE.md) · [产品需求与交接模板](docs/templates/PROJECT-BRIEF.md)
- [已有产品升级与回退](docs/UPGRADING.md)
- [开发手册](docs/DEVELOPMENT.md) · [前端约定](docs/FRONTEND.md)
- [Cloudflare 架构](docs/CLOUDFLARE.md) · [部署手册](docs/DEPLOYMENT.md)
- [数据库隔离、迁移发布与恢复](docs/DATABASE.md)
- [免费起步与按需升级](docs/COSTS.md)
- [品牌与 Logo](docs/BRAND.md) · [更新记录](CHANGELOG.md)
- [贡献](CONTRIBUTING.md) · [安全说明](SECURITY.md) · [MIT 许可](LICENSE)

开源许可免费；运行 Agent、云服务、域名、邮件、模型及支付服务的费用分别计算。Skill 默认免费优先，先评估 Workers Free + D1，再独立选择邮件和其他能力；不会因 CF 外发邮件需 Paid 就将整个项目默认设为付费。新项目记录成本偏好，不自动开通计费。Cloudflare 免费额度不等于完整 SaaS 可永久零成本运行；真实部署和发信需要按账户能力单独验收，详见 [成本清单](docs/COSTS.md)。

外部邮件与 Google 配置支持 [断点续做](docs/SERVICE-WORKFLOW.md)：Agent 通过 `project:service` 记录阶段、脱敏证据与最小人工接力，保留仍有效的进度，重新核验过期步骤。
