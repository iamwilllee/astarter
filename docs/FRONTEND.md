# 前端约定

Aster 使用 React、TanStack Router / Query、Tailwind CSS、shadcn/ui base-nova（Base UI）与 Lucide。复用现有组件和主题，不为同一种能力同时引入多套方案。

## 组件与品牌

- `src/components/ui/` 保存可维护的基础组件源码；通用页面组件位于 `src/components/common.tsx`。
- `src/styles.css` 管理颜色、圆角、字体和深浅主题；品牌名称与描述位于 `src/config/site.ts`。
- Logo、favicon 与使用说明见 [品牌文档](BRAND.md)。业务图标统一使用 Lucide，品牌图形独立管理。
- 常规布局使用 CSS Grid / Flex；动效、可拖动面板、拖拽和复杂本地状态库只在实际业务需要时添加。

## 状态归属

| 状态                         | 归属                          |
| ---------------------------- | ----------------------------- |
| 搜索、筛选、分页与可分享状态 | 校验后的 URL 参数             |
| 服务端记录与异步缓存         | Route loader / TanStack Query |
| 表单、弹窗、局部交互         | React 组件状态                |
| 会话与权限、订阅权益         | 服务端认证与数据库            |

避免同时维护多个权威数据副本。SSR 的缓存与语言按请求隔离；退出账户后清理私有客户端状态。保存结果以服务端返回为准。

## 页面验收

每个业务页面处理加载、空数据、错误重试、禁用和成功状态；检查键盘操作、焦点、可访问名称、手机布局与深浅主题。保存后刷新验证恢复结果，不能只凭构建或截图判断业务通过。

英文默认，中文 URL 使用 `/zh`；新增界面文案维护 `src/i18n/en.json` 与 `zh.json` 并执行 `pnpm locale:check`。供应商错误通过已有公共错误映射展示，不直接输出内部错误。

修改后运行 `pnpm check` 与 `pnpm format:check`；涉及界面或用户流程时，补 `pnpm test:e2e` 与实际渲染检查。
