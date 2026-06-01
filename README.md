<p align="center">
  <img src="./src/assets/images/logo/PiAgentUiBlack%20%283%29.png" alt="PiAgentUI logo" width="760" />
</p>

<h1 align="center">PiAgentUI</h1>
<p align="center">
  <strong>Professional Desktop & Web UI for AI Coding Agents</strong><br/>
  <em>Pi Agent · Claude Code · Codex · OpenCode · Cursor · Copilot</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.6.10-blue" alt="Version" />
  <img src="https://img.shields.io/badge/license-GPL--3.0-green" alt="License" />
  <img src="https://img.shields.io/badge/platform-Tauri%202%20%7C%20Web-brightgreen" alt="Platform" />
  <img src="https://img.shields.io/badge/framework-React%2019%20%7C%20TypeScript-61DAFB" alt="Framework" />
</p>

**English (US)** | [Português (BR)](./README.pt-BR.md) | [Español](./README.es.md) | [日本語](./README.ja.md)

## TL;DR

PiAgentUI is a **full-featured workspace for AI coding agents** — sessions, model switching, MCP tools, skills browser, voice input, terminal, file explorer, and Tauri desktop app. Built for Pi Agent but compatible with Claude Code, Codex, OpenCode, Cursor, and any agent that speaks SSE/HTTP.

> **Category:** AI Agent UI · Agent Desktop Client · MCP GUI · Coding Copilot Interface  
> **Status:** Active development — production-grade chat, evolving fast. Expect weekly releases.

## Software preview

These screenshots show the current PiAgentUI experience: a dark, focused agent workspace with real Pi sessions, model selection, MCP metadata, settings, tool-aware chat, and side panels.

![PiAgentUI chat workspace with MCP side panel](./src/assets/images/img1.png)

![PiAgentUI settings and server connections dialog](./src/assets/images/img2.png)

![PiAgentUI model selector inside an active agent session](./src/assets/images/img3.png)

## Quick Install

```bash
# Clone and install
git clone https://github.com/lehhair/OpenCodeUI.git
cd OpenCodeUI
npm install

# Start dev server
npm run dev

# Or build desktop app
npm run tauri dev
```

Requires **Node.js ≥ 22** and **Pi Agent** installed. The UI auto-discovers the Pi runtime via `~/.pi/agent/piagentui-port.json`.

## What PiAgentUI does today

- **Agent chat with streaming** — live assistant output through SSE, stable message reconciliation, markdown rendering, code highlighting, reasoning parts, and tool cards.
- **Real Pi sessions** — session list, active-session routing, restart-safe history loading, derived session titles, and selected-session send routing.
- **Tool output as tool cards** — tool calls/results stay attached to assistant messages instead of leaking as normal chat text.
- **Runtime context usage** — context usage comes from Pi runtime when available; unknown/compacted context is shown safely instead of `NaN`.
- **Model metadata** — Pi provider/model identity remains authoritative, with optional OpenRouter catalog metadata used only for extra details like context, output, modality, pricing, and tokenizer hints.
- **Skills panel** — real skills are parsed from the effective Pi prompt and grouped by source: global, project, package, and other.
- **MCP metadata panel** — reads configured MCP servers from local/global config files and surfaces transport, command, URL, lifecycle, direct tools, and source.
- **Pi slash commands** — `/api/commands/list` exposes Pi built-in commands plus dynamic extension, prompt, and skill commands.
- **Attachments and multimodal input** — file/image/PDF/audio/video attachment affordances follow the selected model capabilities.
- **Terminal and file tooling** — integrated terminal, file explorer, syntax highlighting, diff-oriented components, and Tauri desktop integration.
- **Keyboard-first UI** — command palette, configurable keybindings, split panes, model selector, project/session navigation, and responsive layouts.

## Product direction

PiAgentUI is moving toward a complete agent app:

1. **Visual actions for every Pi command** — slash commands remain available, but frequent actions should become buttons, menus, dialogs, or panels.
2. **Voice input and realtime transcription** — microphone recording, partial transcript deltas, final transcript insertion into the composer, and OpenAI-compatible STT provider configuration.
3. **Deeper MCP integration** — beyond metadata: connect, authenticate, inspect tools, and execute MCP workflows from the UI.
4. **Full session control** — fork, clone, tree navigation, import/export/share, branch summaries, and context management as first-class UI flows.
5. **Desktop-grade experience** — a polished Tauri app with local runtime discovery, secure settings, notifications, and richer workspace controls.

## Audio and transcription roadmap

PiAgentUI already supports attaching audio files when the selected model declares audio input support. The planned voice system adds live speech-to-text directly in the composer.

Recommended architecture:

- **Default realtime provider:** OpenAI Realtime Transcription with `gpt-realtime-whisper` for low-latency partial transcripts.
- **Default file fallback:** OpenAI Audio Transcriptions with `gpt-4o-transcribe`, `gpt-4o-mini-transcribe`, or `whisper-1`.
- **Custom providers:** user-configurable OpenAI-compatible STT APIs, such as providers that implement `POST /v1/audio/transcriptions`.

Planned UX:

- microphone button in the composer;
- recording and permission states;
- partial transcript overlay;
- final transcript inserted into the input;
- optional append/replace behavior;
- auto-send disabled by default;
- recoverable error handling for permissions, network failures, and provider errors.

Planned provider config shape:

```json
{
  "kind": "openai-compatible",
  "mode": "file",
  "baseUrl": "https://api.example.com/v1",
  "transcriptionEndpoint": "/audio/transcriptions",
  "transcriptionModel": "openai/whisper-large-v3",
  "language": "en"
}
```

Realtime support is treated as a separate capability because OpenAI-compatible HTTP transcription does not guarantee WebSocket compatibility.

## Architecture

```text
PiAgentUI
├─ React/Vite frontend
│  ├─ chat, message rendering, input, panels, settings
│  ├─ local stores for UI preferences
│  └─ SSE/API clients for PiAgentUI local endpoints
├─ Pi extension backend
│  └─ extensions/piagentui-server.ts
│     ├─ exposes local /api/* endpoints
│     ├─ bridges to Pi runtime/session/model APIs
│     ├─ streams Pi events to the browser
│     └─ reads local metadata such as MCP config and skills
└─ Pi Agent runtime
   ├─ sessions
   ├─ models/providers
   ├─ tools
   ├─ skills
   ├─ MCP
   └─ slash commands
```

The UI should not invent runtime state when Pi already knows the answer. PiAgentUI can cache and enrich data for UX, but Pi remains authoritative for agent behavior.

## Tech stack

| Area                | Stack                                         |
| ------------------- | --------------------------------------------- |
| UI                  | React 19, TypeScript                          |
| Build               | Vite 8                                        |
| Styling             | Tailwind CSS v4 plus project design tokens    |
| Desktop             | Tauri 2                                       |
| Markdown            | Streamdown / markdown rendering pipeline      |
| Syntax highlighting | Shiki                                         |
| Terminal            | xterm.js                                      |
| Testing             | Vitest, Testing Library                       |
| Local backend       | Pi extension, Node HTTP server, WebSocket/SSE |

## Local development

Install dependencies:

```bash
npm install
```

Start the frontend dev server:

```bash
npm run dev
```

Build the app:

```bash
npm run build
```

Run tests:

```bash
npm run test:run
```

Run type checks:

```bash
npm run typecheck
npm run typecheck:extensions
```

Full validation:

```bash
npm run validate
```

## Pi extension runtime

PiAgentUI is registered as a Pi extension in `package.json`:

```json
{
  "pi": {
    "extensions": ["./extensions/piagentui-server.ts"]
  }
}
```

When the extension starts, it writes local discovery metadata to:

```text
~/.pi/agent/piagentui-port.json
```

The web app uses that local port/token information to talk to the running extension server. Some backend changes require restarting or reloading the Pi extension process before the browser sees the new behavior.

## Important local endpoints

| Endpoint                         | Purpose                                                |
| -------------------------------- | ------------------------------------------------------ |
| `GET /api/models`                | Real Pi model list plus normalized capability metadata |
| `GET /api/sessions`              | Session list parsed from Pi session files              |
| `GET /api/sessions/:id/messages` | Session history normalized for UI rendering            |
| `GET /api/sessions/:id/context`  | Runtime context usage for the active session           |
| `POST /api/messages/send`        | Send user message to the requested Pi session          |
| `GET /api/skills`                | Effective Pi skills grouped by source                  |
| `GET /api/mcp/status`            | Configured MCP server metadata                         |
| `GET /api/commands/list`         | Built-in and dynamic Pi slash commands                 |
| `GET /global/event`              | SSE event stream from PiAgentUI backend                |

## Development principles

- Prefer real Pi runtime data over mocked UI-only state.
- Keep OpenRouter metadata as catalog enrichment only; never replace Pi provider/model identity with it.
- Treat unknown runtime values explicitly instead of rendering misleading numbers.
- Add tests before behavior changes whenever possible.
- Keep tool results inside tool cards.
- Keep UI work aligned with the existing theme, motion, spacing, and panel patterns.
- Document what is implemented separately from what is planned.

## Repository notes

This project still contains inherited naming from the original OpenCodeUI base in a few places, including package metadata and older documentation files. The current direction is PiAgentUI-first, and future cleanup should migrate remaining OpenCodeUI naming without breaking local workflows.

## License

This repository currently follows the license declared in `package.json`: `GPL-3.0-only`.
