# PiAgentUI

**Desktop and web workspace for AI coding agents: real Pi Agent sessions, streaming chat, MCP and skills panels, terminal, file explorer and a Tauri desktop app.**

![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white)
![Node](https://img.shields.io/badge/Node-%3E%3D22-5FA04E?logo=nodedotjs&logoColor=white)
![Licença](https://img.shields.io/badge/license-GPL--3.0--only-green)
[![Build Validation](https://github.com/evandrodevbr/PiAgentUI/actions/workflows/build.yml/badge.svg)](https://github.com/evandrodevbr/PiAgentUI/actions/workflows/build.yml)

**English (US)** | [Português (BR)](./README.pt-BR.md) | [Español](./README.es.md) | [日本語](./README.ja.md)

## About

PiAgentUI is a chat and workspace front end for the Pi Agent runtime. Instead of a bare terminal, it gives you sessions, model switching, tool calls rendered as cards, MCP server metadata, skills grouped by source, slash commands, Git controls, a terminal, and a file explorer in one window, as a web app or as a Tauri desktop app.

The project is Pi-first: sessions, models, context usage, tool calls, skills, MCP configuration and slash commands come from the Pi runtime whenever possible. The UI caches and enriches that data for presentation but does not invent agent state. It is a rename and rework of the OpenCodeUI base, and part of that inheritance is still visible (see [Current state and limitations](#current-state-and-limitations)).

## How it works

```text
  browser window / Tauri webview
            |
            |  HTTP /api/*   +   SSE /global/event   +   WebSocket
            v
  Pi extension server  (extensions/piagentui-server.ts, Node http + ws)
    |-- serves the built UI from dist/ and injects window.PI_BOOT_DATA {baseUrl, token}
    |-- writes connection info to ~/.pi/agent/piagentui-port.json {port, token}
    |-- enforces bearer-token auth on /api/* and loopback-only access by default
    |-- bridges sessions, models, tools, MCP, skills and commands
            ^
            |  loaded by the runtime
        Pi Agent process
```

- On session start the extension listens on port `58785` (or the next free port) and publishes the selected port plus a random token in the discovery file.
- `GET /global/health` is open; every other `/api/*` route requires `Authorization: Bearer <token>`.
- The Tauri app reads the same discovery file through the `get_pi_agent_connection` Rust command, so the desktop build connects to the local runtime without manual configuration.
- `npm run dev` (Vite) is a front-end-only development server; it proxies `/api` to `127.0.0.1:4096` with the `/api` prefix stripped, so point it at a compatible server or use the extension-served build for the Pi flow.

## Stack

| Area | Choice |
|---|---|
| UI | React 19, TypeScript 5.9 |
| Build | Vite 8 (rolldown), `tsc -b` as the type gate |
| Styling | Tailwind CSS 4 plus project design tokens |
| Desktop / mobile | Tauri 2 (Rust 1.85+), Android targets generated in `src-tauri/gen` |
| Markdown and code | Streamdown, Shiki, KaTeX |
| Terminal | xterm.js |
| i18n | i18next, locales `en`, `pt-BR`, `es`, `ja`, `zh-CN`, `hi`, `bn`, `ar` |
| Tests | Vitest 4, Testing Library, jsdom |
| Local backend | Pi extension: Node HTTP server plus `ws` (SSE and WebSocket) |
| Gateway (containers) | Rust router (`src-router`, axum) in front of Caddy |
| Packages | npm with `package-lock.json` |

## Requirements

- Node.js `>=22` (CI runs Node 22; verified locally on Node 24.20.0)
- npm `>=10` (the repository is npm-based; `package-lock.json` is authoritative)
- Rust `1.85+` only if you build the desktop app or the gateway
- Docker only for the container stack in `docker/`
- Pi Agent installed locally to have real sessions and models; without it the UI starts in standalone mode and only shows the server connection dialog

## Quick start

```bash
git clone https://github.com/evandrodevbr/PiAgentUI.git
cd PiAgentUI
npm ci                 # 615 packages, runs scripts/copy-material-icons.mjs
npm run build          # tsc -b && vite build  -> dist/
npm run dev            # Vite dev server on http://localhost:5173
```

Web UI served by the Pi extension (this is the path that talks to a real Pi runtime):

```bash
npm run build                                  # the extension serves dist/
# with Pi Agent running this repository as a Pi package (see package.json -> "pi")
cat ~/.pi/agent/piagentui-port.json            # {"port": 58785, "token": "..."}
# open http://127.0.0.1:58785
```

Desktop app:

```bash
npm run tauri dev      # development window, uses the Vite dev server
npm run tauri build    # bundles per src-tauri/tauri.conf.json (deb on Linux, dmg, nsis)
```

Android (see `scripts/dev-android.sh` and the Android job in the release workflow):

```bash
npm run tauri android dev
```

## Usage

Local endpoints exposed by the extension server. All of them, except `/global/health` and the SSE route, require the bearer token from the discovery file.

| Endpoint | Purpose |
|---|---|
| `GET /global/health` | Liveness probe, returns `{"status":"ok","pi":"ready"}` |
| `GET /global/event` | SSE event stream (sessions, message parts, status) |
| `GET /api/models` | Model list with normalized capabilities |
| `GET /api/sessions` | Session list |
| `POST /api/sessions` | Create a session |
| `POST /api/sessions/abort` | Abort the running turn |
| `GET /api/sessions/:id/messages` | Session history normalized for rendering |
| `GET /api/sessions/:id/context` | Context usage of the active session |
| `POST /api/messages/send` | Send a user message to a session |
| `GET /api/skills` | Effective skills grouped by source |
| `GET /api/mcp/status` | Configured MCP servers (transport, command, URL, source) |
| `GET /api/commands/list` | Built-in and dynamic slash commands |
| `GET /api/agents`, `GET /api/files/list`, `GET /api/permissions/list`, `GET /api/questions/list` | Runtime inventory for the panels |
| `GET /api/vcs/status`, `/info`, `/branches` | Git state used by the composer controls |
| `GET /api/extensions/list` | Extension catalog for the extensions panel |
| `GET /api/settings/stt`, `/api/settings/tts` | Voice settings (STT/TTS) |
| `GET /api/network/access`, `POST /api/network/access` | LAN access toggle (loopback-only by default) |

The full route table, including Git and extension mutations, lives in [`extensions/piagentui-server.ts`](extensions/piagentui-server.ts). Ports and paths can change; the discovery file is the source of truth for the port and token.

Auditing the agent from a shell works too, for example:

```bash
TOKEN=$(node -e "console.log(require(process.env.HOME+'/.pi/agent/piagentui-port.json').token)")
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:58785/api/models | head -c 300
```

## Production and deploy

```bash
npm run build          # tsc -b && vite build; output in dist/ (about 14 MB, static)
npm run preview        # serves dist/ locally for a final check
```

- Static hosting: `dist/` is a plain SPA. If it is mounted under a subpath, build with `VITE_BASE_PATH=/subpath/ npm run build`.
- Container (front end plus Caddy): `docker/Dockerfile.frontend` builds the UI on Node 22 and serves it from Caddy on port 3000.
- Full container stack: `docker-compose.yml` runs `gateway` (Caddy plus the Rust router on 6658/6659), `frontend` and `backend`. Copy `.env.example` to `.env` first. Images: `backend` and `gateway` come from `ghcr.io/evandrodevbr/opencodeui-{backend,gateway}` (published by the `docker-backend.yml` and `docker-gateway.yml` workflows); the `frontend` image still points at the upstream `ghcr.io/lehhair/opencodeui-frontend` because `docker-frontend.yml` has been failing since 2026-06-01 and no `ghcr.io/evandrodevbr/opencodeui-frontend` was ever published. To build all three locally use `docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build`.
- GitHub Pages: `.github/workflows/deploy.yml` builds `dist/` with `VITE_BASE_PATH=/PiAgentUI/` and publishes it on every push to `main` (enable Pages with source "GitHub Actions" the first time).
- Desktop and mobile releases: `.github/workflows/release.yml` runs on `v*` tags and attaches Windows, macOS, Linux and Android artifacts to the GitHub release.

## Project structure

```text
extensions/                  Pi extension: HTTP/WebSocket server, settings store, git and
                             extension managers, all with Vitest tests
src/                         React front end (Vite entry in index.html)
├── api/                     HTTP/SSE clients and the request pipeline
├── components/              shared UI pieces (code blocks, diffs, command palette)
├── features/                chat, input, messages, tools, sessions, settings, slash commands
├── hooks/                   session, events, transcription, permissions
├── locales/                 8 translated bundles
├── store/                   Zustand-style stores (sessions, messages, layout, theme)
└── constants/               API base URL, storage keys, UI metrics
src-router/                  Rust gateway router (axum) behind Caddy
src-tauri/                   Tauri 2 desktop and mobile shell (Rust), Android project in gen/
docker/                      Dockerfiles, Caddy configs, entrypoints
scripts/                     icon copy, version bump, release preparation, Android dev helper
docs/superpowers/            design specs and plans written during the migration
```

## Verification

Everything below was executed on a clean clone in this repository state:

| Command | Result |
|---|---|
| `npm ci` | 615 packages installed, postinstall copies 266 material icons |
| `npm run typecheck` | exit 0 (`tsc -b`, app + extension projects) |
| `npm run typecheck:extensions` | exit 0 |
| `npm run lint` | exit 0 (0 errors, 109 warnings) |
| `npm run build` | exit 0, `dist/` about 14 MB |
| `npm run test:run` | 89 files, 319 tests, all passing |
| `npm run validate` | exit 0 (the same gate CI runs in `build.yml`) |
| `cargo check` in `src-router/` | exit 0 |
| `cargo check --manifest-path src-tauri/Cargo.toml` | exit 0 (1 warning) |
| extension server over HTTP | `/global/health` 200, `/` 200 with `PI_BOOT_DATA`, `/api/models` 200 with token and 401 without, `/api/sessions`, `/api/sessions/:id/messages`, `/api/sessions/:id/context`, `/api/skills`, `/api/mcp/status`, `/api/commands/list`, `/api/network/access` all 200, `/global/event` 200 `text/event-stream` |

Two things to know when running the suite: `npm run test:run` needs `dist/` to exist, because the extension server test fetches the served `index.html`, so `npm run build` must run first (that is the order in `npm run validate`); and `npm run format:check` currently reports 67 files that are not Prettier-formatted, so `npm run check` fails on that step even though the CI gate passes.

## Current state and limitations

- Active single-developer project, pre-1.0 (`0.6.10`). The chat, sessions, MCP, skills and command panels work against a real Pi runtime; some areas are still moving.
- Naming inheritance from the OpenCodeUI base is only partially cleaned: the Rust crate is `opencodeui-router`, container images are `opencodeui-*`, `.env.example` comments are in Chinese, and the Docker stack runs an `opencode serve` backend that belongs to the inherited deployment, not to the Pi extension flow.
- There is no test for the Tauri shell or the Rust gateway beyond compilation; the Android and desktop bundles are only built by the release workflow.
- The suite is component- and server-level; there is no end-to-end browser test and no coverage threshold.
- `@mariozechner/pi-coding-agent` is a devDependency for types only (the runtime provides the real extension API), and npm marks that package line as deprecated in favour of `@earendil-works/pi-coding-agent`.
- The front end talks to one runtime per window: the discovery file or a manually configured server. There is no multi-runtime aggregation.
- Voice input exists in the UI (`src/hooks/useVoiceTranscription.ts`) and requires an OpenAI-compatible STT endpoint configured in settings; it is not covered by an automated browser test.
- No published npm package and no hosted web demo; both README and code assume a local runtime.
- `docker-frontend.yml` last ran on 2026-06-01 and failed at the build step, so `ghcr.io/evandrodevbr/opencodeui-frontend` was never published (verified against GHCR with the owner credentials); the compose files pull that one image from upstream until the workflow is fixed.

## Documentation

| Document | Content |
|---|---|
| [`docs/superpowers/specs/`](docs/superpowers/specs/) | Design specs for the Pi extension migration, sessions, STT and Git controls |
| [`docs/superpowers/plans/`](docs/superpowers/plans/) | Implementation plans and the roadmap for context, skills and MCP |
| [`CHANGELOG.md`](CHANGELOG.md) | Release history used by the release workflow |
| [`docker/`](docker/) | Dockerfiles, Caddy configs and entrypoints for the container stack |

## License

GPL-3.0-only, as declared in `package.json` and [`LICENSE`](LICENSE). PiAgentUI is a fork and rework of OpenCodeUI; the original authors are credited in `src-tauri/Cargo.toml`.
