# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repository Is

This is a **fork** of [pionxzh/chatgpt-exporter](https://github.com/pionxzh/chatgpt-exporter) — a Tampermonkey/Greasemonkey userscript that adds export functionality to ChatGPT's UI. This fork adds custom image handling for `sediment://` asset pointers and has a standardized CI/CD setup.

**Upstream:** `https://github.com/pionxzh/chatgpt-exporter.git` (configured as `upstream` remote)

## Build & Development Commands

```bash
pnpm install          # Install dependencies
pnpm run dev          # Dev server with hot reload (vite + vite-plugin-monkey)
pnpm run build        # Production build → dist/chatgpt.user.js
pnpm run test         # Type-check (tsc --noEmit)
pnpm run lint         # ESLint
pnpm run lint:fix     # ESLint with auto-fix
```

The project uses **pnpm** (pinned to 8.14.1 via `packageManager` in package.json). Node.js 20+ required.

## Architecture

The userscript is built with **Vite** + **vite-plugin-monkey** and renders UI with **Preact**. The build produces a single `dist/chatgpt.user.js` file (~890 KB) that injects into ChatGPT's page.

### Source Layout (`src/`)

| Path | Purpose |
|---|---|
| `main.tsx` | Entry point. DOM observer (sentinel-js) injects the menu and timestamps into ChatGPT's sidebar |
| `api.ts` | All ChatGPT API interactions: fetch conversations, projects, images. Contains image asset replacement logic |
| `page.ts` | Page utilities: extract chat ID from URL, get user avatar, detect share pages |
| `constants.ts` | API base URLs, storage key constants (prefixed `exporter:`) |
| `type.ts` | Shared TypeScript types |
| `i18n.ts` | i18next initialization |
| `exporter/` | Export engines: `html.ts`, `markdown.ts`, `json.ts` (JSON/Tavern/Ooba), `text.ts`, `image.ts` (PNG via html2canvas) |
| `ui/` | Preact components: `Menu.tsx` (main menu), `ExportDialog.tsx` (bulk export), `SettingDialog.tsx`, `MenuItem.tsx`, `CheckBox.tsx` |
| `utils/dom.ts` | Image utilities: `getBase64FromImageUrl`, `blobToDataURL`, `getCompressedBase64FromImageUrl` |
| `utils/` | Other utilities: clipboard, download, markdown processing, storage (GM_setValue/getValue wrappers) |
| `locales/` | i18n translation files (en, es, fr, id, jp, ru, tr, zh-Hans, zh-Hant) |

### Key Data Flow

1. Sentinel observer detects ChatGPT's sidebar DOM → injects export menu
2. User clicks export → `api.ts` fetches conversation via ChatGPT's internal API
3. `replaceImageAssets()` converts image pointers to data URIs (see custom changes below)
4. Exporter engine (html/markdown/json/etc.) transforms conversation data → file download

### External Dependencies (loaded via CDN at runtime)

- **JSZip** 3.9.1 — bulk export ZIP creation
- **html2canvas** 1.4.1 — PNG screenshot export

## Our Custom Changes (vs. upstream)

All custom changes are in two files:

### `src/utils/dom.ts`
- **Error fallback in `getBase64FromImageUrl`**: try/catch wrapping `getBase64FromImg` with a fetch+blob fallback when canvas conversion fails (e.g., CORS issues)
- **`getCompressedBase64FromImageUrl`** + **`blobToCompressedBase64`**: Fetches an image and re-encodes it as JPEG at 0.95 quality via canvas. Used for scraped DOM images to reduce file size.

### `src/api.ts`
- **`formatFileId`**: Converts a hyphen-less file ID string into UUID format (8-4-4-4-12)
- **`scrapeRenderedImage`**: DOM scraping approach for `sediment://` image pointers. Finds the high-res rendered image in the page by matching the file ID against `div[aria-label="Generated image"]` containers, specifically targeting `div.relative.z-1` for the sharp/full-resolution version.
- **Dual asset pointer support in `isMultiModalInputImage`**: Accepts both `file-service://` (legacy) and `sediment://` (current) pointers
- **Dual fetch path in `replaceImageAssets`**: Routes `file-service://` through the API-based `fetchImageFromPointer`, and `sediment://` through DOM-based `scrapeRenderedImage`
- **`fetchImageFromPointer`** strips both `file-service://` and `sediment://` prefixes for compatibility

### Why DOM scraping instead of API?

Upstream's approach fetches `sediment://` images via the OpenAI file download API. Our approach scrapes the already-rendered high-res image directly from the page DOM. This gets the sharp/full-quality version and applies JPEG compression to reduce exported file size.

## CI/CD & Releasing

### Workflows (`.github/workflows/`)

| Workflow | Trigger | What it does |
|---|---|---|
| `ci.yml` | Every push and PR | Lint + type-check + build |
| `release.yml` | GitHub Release published | Build + upload `chatgpt.user.js` as release asset |

**No release-please** — it doesn't work correctly on forks (scans entire upstream history). Releases are manual.

### Creating a Release

```bash
gh release create v2.31.0 --title "v2.31.0" --generate-notes --repo ductai199x/chatgpt-exporter
```

This publishes a GitHub Release, which triggers `release.yml` to build and attach `chatgpt.user.js` as a downloadable asset.

### `dist/` is NOT in version control

Build output is gitignored. The built userscript only exists as a GitHub Release asset.

## Syncing with Upstream

```bash
git fetch upstream
git merge upstream/master
# Resolve conflicts (likely in src/api.ts and src/utils/dom.ts)
git push
```

If upstream re-adds `dist/` (they commit build artifacts), clean it up:

```bash
git rm --cached dist/chatgpt.user.js
git commit -m "chore: remove dist/ from tracking"
git push
```

Then create a new release when ready.

## Lint Rules to Know

- **`no-console`**: `console.error` and `console.warn` are allowed; `console.log` is not. Use `console.warn` for diagnostic messages.
- **Commit messages**: Conventional commits enforced by commitlint (`feat:`, `fix:`, `chore:`, etc.)
- **Pre-commit hook** (husky + lint-staged): Runs eslint on staged `.ts`/`.tsx` files
- **Pre-push hook**: Runs `tsc --noEmit` (full type-check)
