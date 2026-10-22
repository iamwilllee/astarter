# Skill 与单命令初始化验收

日期：2026-10-22（Asia/Shanghai）。本轮为源码内未发布更新，不是 npm CLI 发布或云端部署。

## 已实现

- `pnpm skill:install`：将仓库 Skill 链接到用户级 `~/.agents/skills/starter-new`，同目标可重复执行，不覆盖其他 Skill。
- `$starter-new`：交给 Agent 的需求入口，初始化后按用户要求继续实现本地首版。Skill 已安装到本机，当前聊天不承诺热加载新目录；新会话可发现，未出现时可直接读取源码入口。
- `pnpm starter:new <target> --name <name> --brief <brief>`：干净复制、产品品牌、需求文档、独立随机密钥、冻结安装、本地迁移和生成文件格式化。`--no-install` 跳过安装与迁移。
- 新项目移除底座专用初始化/安装命令；不把已有产品当成下一份模板。云资源 ID、域名路由、外部 binding 与提供商开关均重置；不建 Git 历史、不部署、不自动启动服务。

## 本轮实际验证

1. `pnpm check` 通过：语言字典、build、ESLint、TypeScript，17 项原有单元/集成测试及 7 项新增初始化/安装测试。
2. `pnpm format:check` 通过。
3. 官方 `skill-creator` 的 `quick_validate.py` 通过。系统 Python 缺少 PyYAML，仅在临时目录安装校验依赖后运行；未增加项目或系统依赖。
4. `pnpm skill:install` 在本机实际成功，链接目标为本仓库 `skills/starter-new`。未修改其他 Skill。
5. 在临时目录真实执行默认初始化命令，创建 Snippet Shelf 骨架，完成依赖安装和全部三份本地迁移；没有只使用 `--no-install` 代替完整验证。
6. 在生成项目运行 `pnpm check` 和 `pnpm format:check`，构建、lint、类型及 17 项单元/集成测试通过。
7. 生成项目的 `pnpm test:production` 五项全部通过：中英文 SSR、开发入口关闭/私有访问、页面水合与手机导航、假 Google 授权请求和错误回调。使用隔离 D1 和假凭据，不占用原项目的 3100 预览。

新增测试覆盖：许可与锁文件保留、独立密钥、云配置/提供商重置、私有文件和 npm 凭据排除、拒绝覆盖/源目录内目标/路径别名、拒绝源码软链接、已有产品不能作为模板、参数字面值传递、Skill 安装幂等与冲突保护。

## 边界

初始化只生成可开发的底座骨架；示例业务保留，片段库并未作为真实产品开发。Skill 的自主业务开发流程尚未用一个独立真实产品完成端到端演练，本轮验证了 Skill 结构、安装、确定性脚本与生成应用运行时。

未创建远程仓库、Git 提交或云资源，没有部署、真实 Google 登录、发真实邮件、Stripe 托管结账或模型调用。底座应用页面未修改；本轮没有重新执行开发服务器 E2E 或新增人工 UI 截图。生成项目通过了生产构建浏览器测试，不等于具体业务已验收。

构建仍有既有的 CSS sourcemap 警告，不影响本轮构建结果。
