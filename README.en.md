# Tabyard

[中文](README.md)

A browser extension that files tabs into Chrome's native tab groups by rule, with a site for sharing rule packs and Pro cloud sync. Only cloud sync is paid.

[Website](https://tabyard.jayden0.com) · [Chrome Web Store](https://chromewebstore.google.com/detail/lnmhlchecohhbmpioimnfdhblolnflec)

![Automatic grouping](img/auto-group.webp)

## Features

- **Automatic grouping**: Tabs are filed into Chrome's native tab groups. New tabs and navigations are grouped as they happen.
- **Four match types**: domain (including subdomains), path, keyword (URL or title), and regex. When several rules match, path beats domain, domain beats keyword, and keyword beats regex. Within the same type, the more specific rule wins, so `chrome.com/docs` beats `chrome.com`.
- **Unmatched tabs**: send them to an "Other" group, group each by domain, or leave them ungrouped.
- **Rule packs**: import, export, publish, and share rules. A short code imports a pack in one paste. The site lists official packs.
- **Web collection**: save the current page from the popup (title, description, and cover image are filled in automatically), organize by folder, and search, edit, move, or delete in bulk. There is no folder limit.
- **X bookmarks**: fetch bookmarks through X's own API into a local cache, then import a selection in bulk. You can also save from a post's action bar. That needs permission for x.com and is off by default.
- **AI organize**: connect your own OpenAI-compatible model to file unsorted items into existing folders and suggest new ones. Preview before applying. You can undo.
- **Page clipper**: extract the current page as clean Markdown, then copy or download it. Optionally save into a vault through the Obsidian Local REST API (turn it on from the Clip tab in settings).
- **Pro**: only cloud sync across devices is paid (rules, settings, and collections). Everything else is free.
- **Languages**: Chinese and English. The UI and the default group name follow the language.

## Screenshots

Website home:

![Website home](img/website.webp)

Extension settings:

![Extension settings](img/extension.webp)

Web collection:

![Web collection](img/collection.webp)

X bookmark import and AI organize:

| X bookmarks | AI organize |
| --- | --- |
| ![X bookmarks](img/x-bookmarks.webp) | ![AI organize](img/ai-organize.webp) |

Rule pack list and detail:

| Pack list | Pack detail |
| --- | --- |
| ![Pack list](img/rule-pack.webp) | ![Pack detail](img/rule-pack-2.webp) |

## Repository layout

An npm workspaces monorepo:

| Path | What it is |
| --- | --- |
| `apps/extension` | The extension. WXT, Manifest V3, React 19, Tailwind v4, shadcn/ui, i18next |
| `apps/web` | Site and API. TanStack Start on Cloudflare Workers, D1, Better Auth, Creem |
| `packages/shared` | Types, rule matching, and zod validation shared by both apps |

## Local development

Node.js 20 or newer.

```bash
npm install

npm run dev:web    # site and API
npm run dev:ext    # extension; WXT opens Chrome with it loaded
```

Point the extension at the API with `WXT_API_URL`, set in `.env.*` under `apps/extension`.

Local secrets for the site go in `apps/web/.dev.vars` (gitignored): Better Auth, GitHub and Google OAuth, and Creem.

Initialize the local database:

```bash
cd apps/web
npx wrangler d1 migrations apply DB --local
```

## Build and deploy

```bash
npm run compile                          # typecheck every workspace
npm run build:ext                        # build the extension
npm run zip -w @tabyard/extension        # zip for store upload

cd apps/web
npx wrangler d1 migrations apply DB --remote
npm run deploy                           # build and deploy to Cloudflare Workers
npm run cf-typegen                       # regenerate types after editing wrangler.jsonc
```

Set production secrets with `wrangler secret put`. Do not commit them.

## How cloud sync works

Sync covers group rules, settings, and collections (web pages, imported X posts, and folders). Language preference and the X fetch cache stay on the device. Pro only. The server and the extension both check the plan.

- Every save records a monotonically increasing `modifiedAt`. If both sides changed, group rules and collections are merged. Bookmarks are deduped by URL and compared by update time. Delete markers stop an offline copy from coming back.
- The extension pulls on startup, when the settings page opens, and every 30 minutes. Local edits are pushed automatically.
- The first sync keeps and merges collections already stored locally. An older client that uploads rules without a collection does not clear the collection stored on the server.
- A sync request may be at most 512,000 bytes. Over that limit, sync fails and the local data stays.
- `/api/sync`: 401 when signed out, 403 when not Pro, 413 when the body is over the limit, 409 when the cloud copy is already newer.

## Other

- `/admin` is limited to emails listed in `ADMIN_EMAILS`. It shows orders and manages discount codes and redeem codes.
- Official packs are multi-group packs split by topic. The seed data is in `apps/web/migrations/0008_official_multi_group.sql`. After deploy, edit them in `/admin`.
- Pricing is at `/pricing`. The price is read live from the Creem product (`CREEM_PRODUCT_ID`).
