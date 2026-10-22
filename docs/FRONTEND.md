# 前端约定与 AI 开发规则（建议）

日期：2026-10-21。状态：方案补充，未安装依赖或实现组件。依据用户提供的前端提示词截图，结合当前 TanStack Start 方案整理。

## 1. 要吸收的原则

优先复用成熟组件；主题和交互遵循同一套约定；同一种能力保持一个主要实现；新增依赖需要说明现有方案为何不够。将这些约定落实到组件示例、配置和检查入口，不能只依赖一次性提示词。

统一规则服务于稳定的体验。不同产品仍可通过品牌 token、字体、配色和内容布局建立自己的视觉，不要求所有项目长得一样。组件源码可控，意味着能阅读、修改、升级，不意味着自己重写所有基础交互。

## 2. 默认能力与按需能力

| 能力         | 建议                                            | 启用范围                                                              |
| ------------ | ----------------------------------------------- | --------------------------------------------------------------------- |
| 基础 UI      | shadcn/ui + Tailwind CSS，Nova 作为候选默认风格 | 首版；先用一个页面样板验证密度和响应式，再固定 components.json 与主题 |
| 底层交互原语 | 固定一套 shadcn preset 对应的底层体系           | 不随意混装另一套 Dialog/Menu/Select 来实现相同能力                    |
| 图标         | Lucide                                          | 首版统一尺寸和描边；品牌商标及产品插画单独管理                        |
| 常规布局     | CSS Grid / Flex                                 | 首版；栅格、响应式和侧栏无需分栏拖动库                                |
| 动效         | CSS 处理简单状态；复杂布局与进出场统一选 Motion | 复杂动画出现后再安装，不额外混入其他动画引擎                          |
| 可调整面板   | react-resizable-panels                          | 编辑器、聊天工作台等需要拖动分隔条时接入；它不是通用布局库            |
| 拖拽排序     | dnd-kit                                         | 看板、素材排序等真实需求出现时接入，服务端另做持久化与权限控制        |
| 状态         | Router / Query / React 各自负责适合的状态       | 首版明确归属；Zustand 留给跨组件的复杂本地编辑状态                    |

Nova 是组件风格选择，不是另一套必须并存的 UI 库。具体 preset 与版本在实现时固定，不复制与本项目不相符的 Next.js / RSC 配置。当前官方手动安装文档有 `base-nova` 和 `rsc: false` 示例，仅作为选择依据。[shadcn 文档](https://ui.shadcn.com/docs/installation/manual)

Lucide 支持按图标组件导入和样式属性配置；按需使用，不引入整个图标集合来动态查找所有图标。[官方文档](https://lucide.dev/guide/react)

## 3. 状态归属

| 状态                                 | 归属                                                            | 示例                                     |
| ------------------------------------ | --------------------------------------------------------------- | ---------------------------------------- |
| 可分享、刷新、前进后退恢复的页面状态 | TanStack Router 的路径/搜索参数，并进行校验                     | 搜索、过滤、排序、分页                   |
| 服务端数据与异步缓存                 | TanStack Query（需缓存/失效时）；简单一次性数据可由 loader 管理 | 项目列表、订单、保存后的记录             |
| 单个组件临时状态                     | React 本地状态                                                  | 弹窗开关、展开状态                       |
| 表单输入与校验                       | 一套表单方案，避免重复存储                                      | 登录、资料、业务编辑表单                 |
| 跨区域、复杂的本地编辑状态           | 需要时使用 Zustand                                              | 编辑器选区、尚未提交的多面板草稿、撤销栈 |

同一份服务器记录不同时维护 Query 和 Zustand 两个权威副本。用户会话由认证方案管理，支付权益最终由服务端判断。SSR 的缓存和 store 处理必须避免跨请求共享用户数据；客户端持久化要处理恢复阶段和退出账户时的数据清理。

Query 官方明确区分服务器状态和客户端状态，也说明复杂同步编辑应用仍可能需要独立客户端状态管理。[官方说明](https://tanstack.com/query/latest/docs/framework/react/guides/does-this-replace-client-state)

## 4. 统一设计和组件复用

- 颜色、圆角、间距、字体、阴影、图标尺寸和动画时长通过主题与 token 管理；页面不随意硬编码一套新风格。
- 首批公共模式包括页面标题、表单项、空状态、加载/错误/重试、确认操作、列表与移动端替代布局。
- 优先使用现有 UI 和业务组件；出现真实重复后再提炼公共模式，不预先创建万能组件。
- 每个交互考虑 hover、focus、disabled、loading、error，以及键盘与触屏操作。
- 动画尊重系统减少动态效果设置；采用 Motion 时显式配置用户偏好，不能以为默认已处理。[MotionConfig](https://motion.dev/docs/react-motion-config)
- 拖动面板/排序需要键盘操作和替代操作，且窄屏能切换为合理布局。dnd-kit 旧文档已迁移到 legacy 区，实际接入先核对固定版本对应的新旧 API，不混用教程。

## 5. 依赖约束

约束的是能力重叠和无意版本漂移：不同时引入两套同用途 UI、全局状态或动画方案。保留单一 pnpm lockfile，使用包管理器检查依赖关系与兼容的去重机会。

不强行要求所有传递依赖只能有一个版本，不用未经验证的 overrides 压平不兼容版本，也不把“去重”当成删除上游必要依赖。新增依赖前检查当前代码、已有组件、安装版本和服务端兼容性。

## 6. 未来写入 AGENTS.md 的规则草案

以下是待实施时采用的开发规则，本轮不创建生效中的项目 AGENTS.md：

> 开始前阅读项目地图、前端约定和相关目录中的现有组件。使用 TanStack Start / Router；保持当前 shadcn preset、主题 token 与 Lucide 图标规则。优先复用已有组件与依赖，同一能力不引入第二套实现。搜索/筛选/分页放入经过校验的 URL 状态；异步服务端数据按 loader/Query 约定管理；局部 UI 用 React 状态；只有复杂跨组件本地状态才使用 Zustand。普通布局使用 Grid/Flex，拖动分栏和拖拽库只在业务需要时接入。所有页面处理加载、空数据、错误、禁用、键盘与移动端状态。核对当前依赖版本对应的官方 API；完成后运行相关检查，并在浏览器验证真实交互和刷新恢复。

实施时配套一个参考页面，覆盖列表筛选、编辑表单、保存、错误重试和移动端布局。规则文件、示例代码和自动检查一起维护；不承诺 oneshot 一次生成即可验收。

## 来源

用户提供的截图用于理解原则与候选库，不将帖文里的效果评价视为独立验证。

- [shadcn 主题](https://ui.shadcn.com/docs/theming)
- [shadcn 手动安装](https://ui.shadcn.com/docs/installation/manual)
- [Lucide React](https://lucide.dev/guide/react)
- [TanStack Query 与客户端状态](https://tanstack.com/query/latest/docs/framework/react/guides/does-this-replace-client-state)
- [MotionConfig](https://motion.dev/docs/react-motion-config)
- [react-resizable-panels 官方仓库](https://github.com/bvaughn/react-resizable-panels)
- [dnd-kit 可访问性旧版指南](https://dndkit.com/legacy/guides/accessibility/)
