# v0.1 本地验收

验收时间：2026-10-21 至 2026-10-22，Asia/Shanghai。工作名 Starter，未提交 Git、推送、建立远端仓库或部署。

## 运行环境

- 本机实际执行：Node.js 23.11.0、pnpm 12.11.2、macOS。项目推荐 Node.js 24；CI 已配置 Node 24，但尚未在 GitHub 执行。
- TanStack Start 1.169.3、React 19.3.1、Vite 8.3.5；Wrangler 4.151.3、Cloudflare Vite plugin 1.64.0。
- Workers 兼容日期 2026-10-19，本地 D1 迁移成功。真实 Cloudflare 账户未使用。

## 已完成的检查

| 检查 | 结果与范围 |
| --- | --- |
| `pnpm setup` | 已生成独立本地密钥、bindings 类型、应用本地迁移；没有默认管理员或默认密码 |
| `pnpm check` | build、ESLint、TypeScript、Vitest 全通过 |
| Vitest | 3 文件 / 11 测试通过，含真实本地 Miniflare D1 |
| `pnpm test:e2e` | 2 个 API/浏览器综合流程通过 |
| `pnpm format:check` | 通过 |
| `pnpm audit --prod` | 核对时 info/low/moderate/high/critical 均为 0；不是独立安全审计 |
| Wrangler deploy dry-run | 本地打包成功，未上传；bundle gzip 约 700 KiB |
| Wrangler startup profile | 本地 workerd 加载成功，active 约 22.6ms；不能据此推断云端 CPU/延迟或免费套餐适用性 |
| `pnpm deploy:check` | 在当前占位配置下按预期拒绝：本地 origin、全零 D1 ID |

Vite 输出 CSS sourcemap 警告：vite:css-post 未提供准确变换 sourcemap。应用构建成功，但 CSS 调试映射可能不准确。

## API / 浏览器行为

- 注册新账户；邮箱未验证时登录 403；通过本地邮件链接验证后可登录。
- 创建、编辑、按名称/状态筛选项目；刷新后恢复；删除确认后项目消失。
- 修改个人称呼，刷新后保留。
- 第二个账户不能列出、更新或删除第一个账户的项目；越权更新/删除返回 404。
- 四个并发创建请求在仅剩两个名额时，恰好两个成功、两个 409；数量没有超过 Free 上限。
- 普通用户访问管理员接口 403；本地脚本授予验收账户后 200，撤销后恢复 403。
- 非受信任 Origin 的写操作 403；未配置支付的结账 503；其他账户的 checkout ID 不可读取。
- 密码重置后已有会话不可继续访问项目；浏览器退出后项目 API 返回 401。
- Stripe SDK 验签拒绝伪造签名及 live 事件；事件重复只处理一次；取消状态同步后旧事件不能恢复权益；并发修订冲突会重读供应商当前状态；关闭新结账不阻断事件同步。
- 本地开发收件箱在生产模式、不匹配地址或非回环地址不可用；流式请求体按字节限制大小。
- 手机导航、未配置支付按钮、深浅主题及主流程英语切换通过。测试期间没有浏览器 pageerror。
- 重启本轮开发服务器后，已有会话仍有效、示例项目仍可读取，验证了本地持久化而非仅页面内状态。

## 视觉检查

已实际查看以下渲染图：

- [首页桌面](home-desktop.png)：深色主题，1920px。
- [工作空间桌面](workspace-desktop.png)：浅色主题，1920px。
- [手机项目](projects-mobile.png)：390 × 844，无横向滚动；article 右边界 370px。
- [手机导航](navigation-mobile.png)：抽屉导航，390px。

本地验收 fixture 使用 `@example.test` 地址，不代表真实邮箱、客户或付费用户。截图不含密钥、验证链接或真实用户数据。

## 尚未验收 / 未接入

- 真实 Cloudflare 远端 bindings、域名、资源配额、邮件投递、备份恢复、生产性能：未验收。
- 真实 Stripe 测试账户的托管结账、支付门户与远端事件投递：未验收。代码测试使用模拟供应商响应，不产生真实扣款。
- 生产支付、退款/争议/税务：不支持；当前服务端拒绝 live key / live event。
- R2 文件操作、AI 推理、消费额度账本：未实现；UI 标记为预留或未启用。
- 多租户团队、列表分页、跨产品账号共用、自动升级 CLI：未实现。
- GitHub CI：配置已提供、Actions 版本已按官方 release 核对，尚未远端运行。

CI 版本来源：[checkout v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1)、[setup-node v7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0)、[upload-artifact v7.0.2](https://github.com/actions/upload-artifact/releases/tag/v7.0.2)、[pnpm/action-setup v6.1.0](https://github.com/pnpm/action-setup/releases/tag/v6.1.0)。
