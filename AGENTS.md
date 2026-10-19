# 仓库协作指南

本文件适用于整个仓库。默认用中文沟通；代码标识符沿用英文。修改前先阅读相关实现，不要仅根据 README 推断行为。

## 项目与目录

Tabyard（归处）是按规则自动整理 Chrome 原生标签组的扩展，附带规则包分享网站和 Pro 云同步。仓库使用 npm workspaces、TypeScript 和 React。

- `apps/extension`：WXT / Manifest V3 扩展。`entrypoints/background.ts` 负责标签事件与分组；`entrypoints/options` 和 `entrypoints/popup` 是设置页与弹窗；`utils` 包含配置存储、匹配、权限和同步逻辑。
- `apps/web`：TanStack Start 网站及 API，部署到 Cloudflare Workers。`src/routes` 是文件路由，`src/server` 是服务端逻辑，`migrations` 是 D1 数据库迁移。认证使用 Better Auth，支付使用 Creem。
- `packages/shared/src`：两端共享的类型、规则解析与匹配、Zod 校验。公共导出集中在 `index.ts`，通过 `@tabyard/shared` 引用。
- `img`：README 使用的产品截图，不是应用构建产物。

## 常用命令

默认在仓库根目录执行，使用 npm，保持 `package-lock.json` 为唯一依赖锁文件。

```bash
npm install
npm run dev:ext                         # 启动 WXT 扩展开发
npm run dev:web                         # 启动网站及 API
npm run compile                         # 所有 workspace 的 TypeScript 检查
npm run build:ext                       # 构建扩展
npm run build:web                       # 构建网站
npm run zip -w @tabyard/extension        # 打包扩展
npm run cf-typegen -w @tabyard/web       # 重新生成 Cloudflare 绑定类型
```

扩展需要在 `apps/extension/.env.*` 中配置有效的 `WXT_API_URL`；WXT 配置会据此生成 host permissions。网站本地密钥放在 `apps/web/.dev.vars`。缺少配置时应说明阻塞项，不要伪造凭据或改用生产密钥。

本地数据库初始化或升级：

```bash
cd apps/web
npx wrangler d1 migrations apply DB --local
```

## 修改约定

- 保持改动聚焦，不顺手重构、格式化无关文件或覆盖用户已有修改。
- 沿用附近代码的风格：通常为两空格缩进、单引号、分号、ES modules。尽量明确类型，外部数据先校验再使用。
- 跨端类型、规则语义和数据校验放在 `packages/shared`，不要在两端复制实现。共享包不得依赖浏览器扩展 API、DOM 或 Cloudflare 运行时。
- Chrome API 通过 `wxt/browser` 使用；后台按 Service Worker 环境处理，不依赖页面 DOM 或永久存活的内存状态。
- 服务端密钥、数据库访问和支付校验留在服务端，不能经客户端模块或构建变量泄露。API 权限必须在服务端检查，不能只隐藏 UI。
- UI 修改沿用现有 Tailwind、组件和视觉风格。扩展优先复用 `components/ui`，不要为局部需求引入另一套 UI 框架。
- 用户可见文案同时维护中英文：扩展在 `apps/extension/locales/{en,zh-CN}.json`，网站在 `apps/web/src/i18n.ts`。注意网站使用 `zh`，扩展使用 `zh-CN`。
- 不手工修改 `apps/web/src/routeTree.gen.ts`、`apps/web/worker-configuration.d.ts` 或 `.wxt`、`.wrangler`、`dist`、`.output` 中的生成内容。路由和绑定变化后用对应工具生成。
- 数据库变更新增顺序编号的 SQL 迁移，不改写已部署迁移；涉及现有数据时考虑兼容性和数据保留。

## 需要保留的业务约束

- 规则语法由 `packages/shared/src/pattern.ts` 识别。匹配优先级为路径、域名、关键词、正则，同类再按具体程度排序；域名匹配包含子域名。改动时覆盖空规则、无效 URL、无效正则和多规则命中情况。
- 免费版最多启用 3 个分组；按域名兜底与云同步属于 Pro。修改相关功能时同时检查扩展的权限处理和服务端鉴权，不能只修改展示文案。
- 配置存储使用 `browser.storage.local`。普通配置写入复用 `utils/rules.ts` 的保存接口，保持 `modifiedAt` 单调递增，避免绕过锁直接写入。
- `CONFIG_LOCK` 只保护短小的本地读改写，网络请求必须在锁外；`SYNC_LOCK` 串行化跨上下文同步。保持快照版本语义，避免推送期间的新编辑被标记为已同步。
- 同步包含规则、设置和收藏集，不包含语言偏好与 X 抓取缓存。收藏集按记录更新时间和删除标记合并。当前实现会在本地和云端都变化时合并分组，并处理服务端 409 冲突重试；不要按 README 中“不做合并”的旧说明退回覆盖逻辑。以 `apps/extension/utils/sync.ts` 和 `apps/web/src/server/sync.ts` 为准。
- 标签事件可能并发发生，也可能在异步操作期间关闭标签或窗口。修改后台时保留必要的并发串行化与异常处理，并验证不重复创建分组、不误动用户已有分组。

## 验证与交付

当前 package scripts 未配置自动化测试或 lint 命令，不要声称已运行不存在的检查。

- 代码修改至少运行 `npm run compile`；扩展或网站改动分别运行对应构建，共享包改动验证两端构建。
- 规则或分组修改手动覆盖新开标签、URL 跳转、不同匹配方式、多规则优先级、未命中兜底及已有分组。
- 存储或同步修改检查并发编辑、初次同步、离线或请求失败、401/403/409 响应，以及同步期间再次编辑的场景。
- UI 修改检查中英文、窄屏和桌面布局；API、认证或支付修改检查成功路径及未授权、无效输入、重复请求等相关失败路径。
- 仅文档修改可不运行代码构建，但应核对路径和命令，并运行 `git diff --check`。
- 完成后简要说明改了什么、实际运行的验证、尚未验证的部分及原因。发现既有问题时与本次改动区分，不隐瞒失败。

## 安全边界

- 不提交密钥、令牌、Cookie、用户数据或本地环境文件。`.env.*` 不一定被现有 `.gitignore` 覆盖，提交前务必检查暂存内容。
- 未经用户明确要求，不执行生产部署、远程 D1 迁移、生产数据修改、真实支付操作或扩展商店发布。`npm run deploy -w @tabyard/web` 会构建并部署到生产，不是本地验证命令。
- 不擅自增加扩展权限、改动生产域名或扩大跨域访问范围；确有需要时说明原因和影响。
