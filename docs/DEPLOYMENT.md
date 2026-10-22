# Cloudflare 部署手册

Aster v0.1.2 提供本地开发与隔离生产构建测试。部署前检查操作者的 Cloudflare 账户、D1 与发信权限，并完成下文的远端验收。不要把密钥发送到聊天或写入仓库。

## 1. 先隔离预发布

`wrangler.jsonc` 根配置用于 production，`env.staging` 用于预发布；两者使用不同 Worker、D1、域名与密钥。命名环境的 vars/bindings 需要独立声明。staging 默认不声明 R2 和发信 binding，需要时再添加；D1 是必需资源。

```bash
pnpm exec wrangler login
pnpm exec wrangler d1 create starter-staging-db --env staging
```

将返回的数据库 ID 填到 `env.staging.d1_databases`，不要替换正式环境 ID。设置 staging 的 Worker 名和精确 `APP_ORIGIN`，可以使用自己的 workers.dev HTTPS 域名；不带路径或末尾斜杠。

保留 `ENVIRONMENT=staging`、`PUBLIC_INDEXABLE=false`、`BILLING_ENABLED=false`。未接邮件时保持 `MAIL_MODE=disabled`，注册/验证重发/重置接口会返回服务未配置，页面也会显示提示。`MAIL_MODE=local` 只允许开发，不能部署。

不使用文件业务时删除根配置预留的 R2 项，不使用发信时删除根配置预留的 `send_email` 项。若要保留则必须创建真实资源并配置。改动 binding 后运行 `pnpm cf:typegen`。邮件模块检查可选 EMAIL binding，不凭模式标记宣称已发信。

兼容日期固定 `2026-10-19`，升级 Wrangler/Vite 插件和运行时后统一调整并回归。本版不自动绑定 DNS 或自定义域名。

## 2. 密钥与迁移

通过 Wrangler 交互输入密钥；值不出现在命令历史、JSON 或 Git。预发布使用独立、至少 32 字符的随机认证密钥。

```bash
pnpm exec wrangler secret put BETTER_AUTH_SECRET --env staging
pnpm exec wrangler d1 migrations apply starter-staging-db --remote --env staging
```

迁移前导出已有远端库，在预发布验证并演练恢复。禁止上传开发库、测试用户或 `.wrangler`。这里的命令是说明，不表示已经执行远端操作。

启用 Google：在 Google 控制台注册 Web OAuth 客户端，回调精确为 `https://你的预发布域名/api/auth/callback/google`，分别保存密钥，再设置 staging 的 `GOOGLE_AUTH_ENABLED=true`。

```bash
pnpm exec wrangler secret put GOOGLE_CLIENT_ID --env staging
pnpm exec wrangler secret put GOOGLE_CLIENT_SECRET --env staging
```

只有开关与两个密钥齐备才显示可用按钮。已测试构造授权请求与本地错误反馈，真实 Google 登录、同意页和回调尚待验收。不同环境分别注册允许来源/回调；测试模式下还需配置允许的测试用户。

启用邮件前确认 [Cloudflare Email Service](https://developers.cloudflare.com/email-service/) 账户资格、发信域名和对应 EMAIL binding；免费 Email Routing 转发不能视为任意外发邮件能力。配置 `MAIL_MODE=cloudflare` 与已验证的 `MAIL_FROM`，完成中英文验证/重置邮件真实收信、链接和失败检查。模板同时提供纯文本和 HTML。供应商接受发送不等于收件成功。

Stripe 仅限测试账户，依次保存 `STRIPE_SECRET_KEY`、`STRIPE_WEBHOOK_SECRET`、`STRIPE_PRICE_ID`（都使用同样的 `--env staging`）。启用测试 Portal，Webhook 指向 `/api/billing/webhook`，再打开 `BILLING_ENABLED=true`。禁用新结账不会停止已配置的门户与事件同步。live key 不受支持。

## 3. 检查与部署

```bash
pnpm check
pnpm test:e2e
pnpm test:production
pnpm run deploy:check --env staging
pnpm run deploy --env staging
```

请使用 `pnpm run deploy`，避免与 pnpm 自带的 deploy 命令混淆。脚本先检查配置，再选择对应环境构建并运行 Wrangler；不自动建资源或迁移。它拒绝占位 D1、不匹配的环境名、共用 D1、本地邮件、无效 origin、明文秘密和允许索引的 staging。检查通过仅代表配置形状合格，不能证明远端密钥或供应商可用。

脚本构建后删除 `dist/server/.dev.vars` 再部署。源 `.dev.vars` 和 `.wrangler` 始终私有。只公开 `dist/client` 静态资源；不要把 `dist/server` 配成公开目录。认证、私有 API、server functions 和 `/app` 不能配置公共缓存。

正式环境独立创建 D1 与密钥，更新根配置，省略命令中的 `--env staging` 即选择 production。确认内容准备好后再显式开启 `PUBLIC_INDEXABLE=true`；仅首页和套餐页的中英文地址进入 sitemap，私有页面保持 noindex。

云端管理员需在正确的远端 D1 显式授予，用户必须先正常注册/验证：

```sql
INSERT INTO admin_user (user_id) VALUES ('目标用户ID') ON CONFLICT(user_id) DO NOTHING;
-- 撤销：DELETE FROM admin_user WHERE user_id = '目标用户ID';
```

首个用户不会自动成为管理员。保留操作记录，不在浏览器可编辑资料中存角色。

## 4. 云端验收

在真实 HTTPS 域名完成：英文/中文直接访问和刷新；邮箱注册、收信、重发冷却、验证、登录与重置撤销旧会话；Google 登录/失败回调；项目创建刷新持久化；跨账户隔离；普通用户管理员 403；两种语言的开发收件箱与开发邮件 API 均不可用。

Stripe 测试账户需要真实托管测试结账、取消/门户改套餐、失败/重试和 Webhook 数据核对。返回 success 页面不能直接授予权益。另检查日志、CPU 时间、D1 扫描行数、备份/恢复与资源用量；套餐选择依据实际负载测量。

目前仍未完成这些远端验收。真实收费、退款、争议、税务、账户删除、数据保留与隐私策略由后续具体产品补齐。
