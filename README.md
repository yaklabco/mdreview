<p align="center">
  <img src="pics/logo.png" alt="Design Review" width="200" />
</p>

<h1 align="center">Design Review</h1>

<p align="center">A viewer and review tool for architectural and design documentation in software projects.</p>

<p align="center">
  <a href="https://github.com/yaklabco/mdreview/actions/workflows/ci.yml">
    <img src="https://github.com/yaklabco/mdreview/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI Status" />
  </a>
  <img src="https://img.shields.io/github/package-json/v/yaklabco/mdreview?branch=main" alt="Version" />
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License" />
</p>

## What is this?

Design Review renders markdown files — RFCs, ADRs, design docs, runbooks — the way they're meant to be read: with full Mermaid diagram support, syntax-highlighted code blocks, and a table of contents for navigating long documents. It exports to PDF and Word so your architecture diagrams survive the trip into a slide deck or a review meeting.

This is not a general-purpose markdown previewer. It's built for the specific workflow of writing and reviewing technical design documents in a software project.

## Why a desktop app?

Design Review started as a Chrome extension. That worked well for rendering local `.md` files, but the extension model became a poor fit as the tool grew:

**Permissions creep.** Rendering local files requires `file:///*` access. Adding features like persistent comments required `nativeMessaging` for a host process that could write back to disk. Each new capability meant another permission, and Chrome Web Store review gets increasingly difficult when an extension asks for broad host permissions across `file://`, `http://`, and `https://`.

**Single-document limitation.** A Chrome extension operates on one tab at a time. There's no concept of a workspace — you can't open a folder of design docs, browse between them, or see how they relate to each other. Every document is isolated.

**No native integration.** Features like file watching, folder browsing, drag-and-drop, and direct PDF export all require workarounds or native messaging bridges in an extension. In an Electron app, they're straightforward.

The Chrome extension still works and is still maintained, but the desktop app is where new features land. If you're reviewing a set of design documents for a project, the desktop app is the better experience.

## Desktop App

The Electron app provides a full workspace for reading and reviewing design documents.

### Features

- **Workspace browsing** — open a project folder and navigate its documents in a sidebar file tree with disclosure triangles, file-type icons, and compact folder chains
- **Tabbed interface** — open multiple documents with Chrome-style tabs, tab groups (9 colors), and keyboard navigation (`Cmd+1`–`9`, `Cmd+Tab`)
- **9 themes** — GitHub Light/Dark, Catppuccin (Latte, Frappe, Macchiato, Mocha), Monokai, Monokai Pro, One Dark Pro, with auto dark mode
- **Mermaid diagrams** — all diagram types rendered inline with zoom, pan, maximize, and SVG export
- **Table of contents** — configurable depth and position, auto-collapse, current-section highlighting
- **Document export** — PDF (native Chromium print) and Word (.docx) with Mermaid diagrams embedded as SVG
- **File watching** — documents auto-reload when the source file changes on disk
- **Preferences panel** — macOS System Settings-style panel with live preview across General, Display, Table of Contents, and Export categories
- **Status bar** — word count, heading count, code blocks, diagrams, render state
- **Hideable panels** — toggle sidebar, tab bar, header bar, TOC, and status bar independently

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+O` | Open file |
| `Cmd+Shift+O` | Open folder |
| `Cmd+W` | Close tab |
| `Cmd+B` | Toggle sidebar |
| `Cmd+Shift+T` | Toggle table of contents |
| `Cmd+E` | Export |
| `Cmd+,` | Preferences |
| `Cmd+Tab` | Next tab |
| `Cmd+1`–`9` | Jump to tab |

### Install

```bash
git clone https://github.com/yaklabco/mdreview.git
cd mdreview
bun install
bun run dev:electron
```

To package a distributable:

```bash
bun run build:electron
cd packages/electron
bun run dist:mac      # macOS .dmg
bun run dist:linux    # Linux .AppImage / .deb
bun run dist:win      # Windows .exe
```

## Chrome Extension

The extension renders `.md` and `.markdown` files opened in Chrome via `file://` URLs. It shares the same core rendering engine as the desktop app.

### Features

- Markdown rendering with the same 9 themes, Mermaid diagrams, syntax highlighting, and TOC
- Popup with quick toggles for theme, TOC, auto-reload, line numbers, and comments
- Full options page for detailed configuration
- Document export to PDF and Word
- Site blocklist to disable rendering on specific domains
- Settings sync across tabs

### Install

```bash
git clone https://github.com/yaklabco/mdreview.git
cd mdreview
bun install
bun run build:ext
```

Then load in Chrome:
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select `packages/chrome-ext/dist`
4. Go to the extension's Details page and **enable "Allow access to file URLs"**

## Project Structure

```
mdreview/
├── packages/
│   ├── core/           # Shared rendering engine, themes, comments, export
│   ├── chrome-ext/     # Chrome extension (content script, popup, options, service worker)
│   └── electron/       # Desktop app (main process, renderer, file tree, tabs, preferences)
├── tests/              # Integration and unit tests
└── turbo.json          # Turborepo task configuration
```

The `core` package contains everything platform-independent: the 6-stage render pipeline, markdown-it configuration, theme engine, Mermaid renderer, comment system, and export generators. The `chrome-ext` and `electron` packages provide platform adapters and UI shells.

## Development

**Prerequisites:** [Bun](https://bun.sh) 1.3+

```bash
bun install                # Install dependencies
bun run dev                # Dev server — Chrome extension
bun run dev:electron       # Dev server — Electron app
bun run build              # Build all packages (Turborepo)
bun run build:ext          # Build Chrome extension only
bun run build:electron     # Build Electron app only
bun run test               # Run tests (watch mode)
bun run test:ci            # Run tests once
bun run lint               # ESLint
bun run format             # Prettier
bun run check              # Lint + test
bun run clean              # Remove build artifacts
```

### Tech Stack

| Layer | Tool |
|-------|------|
| Package manager | Bun |
| Task orchestration | Turborepo |
| Bundler | Vite (extension), electron-vite (desktop) |
| Language | TypeScript 5.3+ |
| Markdown | markdown-it 14.x + plugins |
| Syntax highlighting | Highlight.js 11.x |
| Diagrams | Mermaid.js 11.x + Panzoom |
| Document export | @jamesainslie/docx (fork with SVG support) |
| Sanitization | DOMPurify 3.x |
| Testing | Vitest (1,647 tests) |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, code standards, and PR process.

## License

MIT — see [LICENSE](LICENSE).

## Screenshots

| | | |
|---|---|---|
| [![](pics/2.png)](pics/2.png) | [![](pics/3.png)](pics/3.png) | [![](pics/4.png)](pics/4.png) |
| [![](pics/5.png)](pics/5.png) | [![](pics/6.png)](pics/6.png) | [![](pics/7.png)](pics/7.png) |
| [![](pics/8.png)](pics/8.png) | [![](pics/9.png)](pics/9.png) | |

---

Made with care by [James Ainslie](https://github.com/jamesainslie)
