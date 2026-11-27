---
name: publish
description: 在 Tabyard 仓库执行正式发版。用户说“发版”“发个版本”“按上次流程发布”、要求提交推送打包并发 changelog，或调用 $publish 时使用。默认交付 GitHub Release、Chrome ZIP 和已部署的官网中英文更新日志。用户明确限定“只打包”“只推送”“先预演”时按限定范围执行。
---

# 发布 Tabyard

在仓库根目录使用 npm。用户发出完整发版指令，就已授权发布本次改动、推送 `main` 与版本标签、上传 GitHub Release 附件，以及部署官网更新日志。直接完成这些步骤，已有授权无需逐项重问。用户本次给出的版本、渠道或范围优先。Chrome 应用商店提交、远程数据库迁移、生产数据修改和真实支付各自需要单独的明确请求。

用户只要本地 ZIP 时，沿用当前版本，构建并校验后交付本地路径。用户要求预演时，只列出将执行的步骤。

## 选定本次版本

1. 查看 `git status --short --branch`、暂存区、工作区差异及上次发布以来的提交。核对 `origin`、远端 `main`、标签及 GitHub Release。只收录此次要发布的改动；同一文件混有其他工作时按 hunk 暂存。若暂存区已有无关工作，用独立 worktree 准备发布，保留原暂存区。
2. 使用用户指定或已准备好的版本。普通修复默认递增 patch；明确的功能版或不兼容版本按用户指定或项目约定处理。先检查是否为中断后的续发，复用对应提交和版本。若没有待发布改动且最近版本已交付，直接给出现有链接。
3. 对齐 `apps/extension/package.json` 和根 `package-lock.json` 中 `packages["apps/extension"].version`。在 `packages/shared/src/changelog.ts` 的 `CHANGELOG` 顶部写入当天日期、面向用户的中英文标题和条目。官网、扩展更新提示和 GitHub Release 共用这一份文案。

## 构建并核对交付物

从本次发布的源码快照构建，避免无关工作区改动混入 ZIP 或官网。检查扩展构建实际使用的 `WXT_API_URL` 指向项目公开生产地址；只报告校验结果，本地环境文件和凭据留在机器上。运行仓库要求的功能验证，以及以下命令：

```sh
npm run compile
node --test scripts/collection-sync.test.cjs
npm run build:ext
npm run build:web
npm run zip -w @tabyard/extension
```

完整发版时用支持直接导入 TypeScript 的 Node.js（如 Node 24）运行随附脚本。它使用 `unzip` 校验 ZIP 完整性、Manifest V3 版本和双语条目，向 stderr 输出附件路径和 SHA-256，向 stdout 输出同一条 changelog 的 Markdown。脚本只读本地文件。

```sh
notes_file=$(mktemp)
node .agents/skills/publish/scripts/release-files.mjs > "$notes_file"
```

## 推送、发布和上线

1. 检查 `git diff --cached --check` 和暂存清单。提交后核对发布 SHA，创建轻量标签 `v<version>`。使用 `git push --atomic origin HEAD:refs/heads/main "refs/tags/$tag"` 同步主分支与标签，其中 `tag` 是带 v 的标签。如远端已前进，先整合并重新验证。已有标签指向其他提交时，保留标签并报告冲突。
2. 将 `zip` 设为脚本核对过的 `apps/extension/dist/tabyardextension-<version>-chrome.zip`。运行 `gh release create "$tag" "$zip" --verify-tag --title "$tag" --notes-file "$notes_file"`。若 Release 已存在，核对目标 SHA、发布状态、双语说明和附件摘要；补上缺失项。已有同名附件摘要不同时，先核实差异，保留已发附件。
3. 官网 changelog 和 API 位于同一个 Cloudflare Worker。先比对待部署配置和当前生产版本的路由与绑定，包括正在使用的 Durable Object。工作区含额外网站改动时，用能保留已上线功能的源码准备部署；仅凭绑定同名不足以确认代码一致。若构建会带上无关的新功能或撤掉线上功能，先完成独立可交付部分，说明具体差异。确认发布快照后，执行 `npm run deploy -w @tabyard/web`，记录返回的 Worker 版本。
4. 在远端核对标签指向发布 SHA、`main` 包含该提交、GitHub Release 已公开且附件摘要匹配。实际 GET 官网 `/zh/changelog` 和 `/changelog`，核对两种语言的版本条目、文案和 Release 链接。线上更新有延迟时重试读取。某一步中断后，核实现有结果并从缺失步骤继续。
5. 用中文给出版本、短 SHA、Release、ZIP 下载及官网中英文链接，列出实际验证和仍有阻塞的步骤。区分 GitHub 发布与 Chrome 应用商店上架状态。
