# 前端约定

Aster 使用 React、TanStack Router / Query、Tailwind CSS、shadcn/ui base-nova（Base UI）与 Lucide。复用现有组件和主题，不为同一种能力同时引入多套方案。

## 组件与品牌

- `src/components/ui/` 保存可维护的基础组件源码；通用页面组件位于 `src/components/common.tsx`。
- `src/styles.css` 管理颜色、圆角、字体和深浅主题；品牌名称与描述位于 `src/config/site.ts`。
- Logo、favicon 与使用说明见 [品牌文档](BRAND.md)。业务图标统一使用 Lucide，品牌图形独立管理。
- 常规布局使用 CSS Grid / Flex；动效、可拖动面板、拖拽和复杂本地状态库只在实际业务需要时添加。

## 组件样板

启动本地开发服务后访问 `/dev/ui` 或 `/zh/dev/ui`，对照三档尺寸、禁用、错误、加载、Textarea、Badge 和弹窗内 Select。示例只维护当前页面的临时状态，刷新即重置，不创建项目或调用提供商。该页在预发布/生产及非匹配回环来源返回 404。

新增或调整公共组件后先更新样板，再检查桌面/手机、深浅主题、键盘焦点和实际渲染尺寸。新增 Base UI 子路径时同时维护 `vite.config.ts` 中客户端/SSR 的预打包列表，验证首次路由加载与水合。

## 控件与尺寸契约

业务页面从 `@/components/ui/` 导入 Button、Input、Select 与 Textarea。Select 使用 Base UI 的可访问弹层，统一触发器、选项、焦点与主题；不能用页面里的原生 `<select>` 代替。组件底层最终渲染原生 DOM 是正常行为，限制针对业务层绕过封装。

| 档位      | 单行高度 | 用途               |
| --------- | -------- | ------------------ |
| `sm`      | 32px     | 紧凑工具栏         |
| `default` | 36px     | 默认表单与筛选     |
| `lg`      | 44px     | 突出操作与触摸场景 |

Button、Input、SelectTrigger 使用相同的 `size` 属性；图标按钮对应 `icon-sm`、`icon`、`icon-lg`。尺寸源是 `src/styles.css` 的 `--control-sm/md/lg` 与 `src/components/ui/control.ts`，同一行的单行控件选同一档。字段容器使用 `grid gap-2`，避免 Base UI 的隐藏表单输入被 `space-y-*` 计入尾部间距；Input/Textarea 使用块级显示，避免行内基线空隙。控件文字在桌面为 14px、手机为 16px；Textarea 为多行输入，默认三行、最小 96px，不套用单行高度。

```tsx
<Input size="default" aria-label="Search" className="w-full" />
<Button size="default">Search</Button>
```

Select 在 Root 的 `items` 中提供标签映射，使受控值、初次渲染与翻译一致；`name` 放在 Root 以参与 FormData，标签关联 Trigger。普通固定选项使用 Select，长列表搜索能力需另加合适的组件。

```tsx
<Label htmlFor="status">Status</Label>
<Select name="status" defaultValue="idea" items={{ idea: 'Idea', live: 'Live' }}>
  <SelectTrigger id="status">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="idea">Idea</SelectItem>
    <SelectItem value="live">Live</SelectItem>
  </SelectContent>
</Select>
```

页面的 className 负责宽度、定位、外部间距等布局；控件高度、纵向内边距、字号、圆角由组件决定。改全站密度时调整 tokens，新增视觉用途时在 UI 层增加 variant。按钮式 Link 复用 `buttonVariants({ variant: 'outline', size: 'default' })`，保留真正的链接语义；普通文本链接与导航按各自语义设计。Input 的原生字符宽度参数改用 `htmlSize`。

`pnpm lint`（已包含在 `pnpm check`）拒绝业务 TSX 的原生 button/input/select/textarea、直接 Base UI 导入，以及共享控件的高度、字号、圆角和纵向内边距覆盖。规则支持导入别名、响应式 class、cn/clsx 与有限条件表达式；无法判断的动态控件 className/style 要移到 UI 层维护。全屏关闭遮罩等特殊交互可用带原因的单行例外，不能整文件豁免。静态规则不能代替浏览器布局、键盘和焦点验收，也不能保证任意全局 CSS 不改变组件。

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
