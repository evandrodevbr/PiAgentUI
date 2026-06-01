# Pi Agent Extension Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate PiAgentUi from OpenCode to Pi Agent while preserving the current UI and interaction model.

**Architecture:** Build a Pi package/extension as the primary integration. Pi loads `extensions/piagentui-server.ts`, which starts a loopback local server, serves the existing React build, and exposes an owned compatibility API shaped to the current frontend. Tauri/Rust desktop service cleanup is a second track after the Pi package MVP works.

**Tech Stack:** React 19, Vite 8, TypeScript 5.9, Vitest, Tauri 2/Rust, Pi extension API (`@earendil-works/pi-coding-agent`), Node HTTP, SSE/WebSocket event streaming.

---

## Decisions Required Before Implementation

Default recommendations are listed; please confirm or override them before code changes.

1. **MVP session model:** recommended = active Pi session mirror first. The UI controls the currently running Pi session; full session CRUD/fork/switch is deferred.
2. **Desktop/Tauri scope:** recommended = defer process spawning. Tauri can connect to an already-running Pi extension server later, but Track A must not depend on Tauri.
3. **Unsupported features:** recommended = disable/stub PTY, MCP, LSP, provider OAuth, worktrees, and multi-session operations until Pi equivalents are verified.
4. **Token/bootstrap:** recommended = same-origin injected boot data in HTML served by the extension; bearer token stays in memory, never query strings/localStorage.
5. **Endpoint convention:** recommended = keep OpenCode-shaped endpoint paths/envelopes where the current frontend already expects them, then gradually move wrappers to owned names internally.
6. **Product name:** needs user decision. Options: `PiAgentUi`, `Pi Agent UI`, or another exact name.

Implementation should not begin until these are confirmed.

---

## Non-Negotiable Scope

- No UI redesign.
- No `/hud` command.
- No `Ctrl+Shift+H` HUD toggle.
- Remove OpenCode runtime usage completely by final migration.
- Remove `@opencode-ai/sdk` by final migration.
- Reuse user Pi settings/auth/model setup; do not collect provider credentials in PiAgentUi.
- Use `better-tau/extensions/mirror-server.ts` as the main reference for a Pi extension serving HTTP/WebSocket from inside Pi.
- Current known `better-tau` unrelated changes must not be touched: `.gitignore`, `extensions/helper-bridge.ts`, `extensions/helper/`.

---

## Core Corrections from Critical Review

- **Do not conflate Pi package and Tauri app.** Track A is Pi package/extension; Track B is desktop cleanup.
- **Do not flatten message DTOs.** Current UI expects `MessageWithParts { info, parts }`, and many callsites read `message.info.*`.
- **Do not emit raw event envelopes unless `events.ts` is rewritten first.** Current frontend accepts `{ directory, payload: { type, properties } }` from `/global/event`.
- **Use actual Pi lifecycle events.** The shutdown event is `session_shutdown`, not `session_end`.
- **Typecheck extension files.** Existing `tsc -b` does not include `extensions/**/*.ts`.
- **Resolve token bootstrap early.** The UI cannot call protected APIs unless it receives base URL/token safely.
- **Treat `pi.sendUserMessage(...)` as asynchronous fire-and-stream.** It should return `202 accepted`; real message IDs arrive through events.

---

## File/Module Responsibility Map

### New files

- `extensions/piagentui-server.ts`
  - Pi extension entrypoint.
  - Starts loopback HTTP/SSE/WS server.
  - Serves built `dist/` assets.
  - Injects safe runtime boot data into `index.html`.
  - Bridges Pi session lifecycle and messages to current frontend-compatible events.

- `extensions/piagentui-server-core.ts`
  - Pure helpers for testable server behavior: loopback validation, auth validation, body-size guard, path traversal prevention, event envelope helpers.

- `extensions/piagentui-server-core.test.ts`
  - Unit tests for server security helpers.

- `tsconfig.extension.json`
  - TypeScript project for extension files and extension tests/helpers.

- `src/api/piClient.ts`
  - Typed fetch client replacing SDK usage.
  - Sends local bearer auth in headers only.
  - Normalizes typed errors.

- `src/api/piClient.test.ts`
  - Request/auth/error behavior tests.

- `src/types/api/compat.ts`
  - Owned compatibility DTOs shaped for current UI.

- `src/api/piContract.ts`
  - Owned request/response contracts and current event envelope definitions.

- `src/api/piEventTranslator.test.ts`
  - Contract tests for frontend event processing.

- `docs/superpowers/specs/2026-05-28-pi-agent-extension-migration-design.md`
  - Design spec, endpoint matrix, unsupported features, security, acceptance criteria.

### Modified files

- `package.json`
  - Add `pi.extensions`.
  - Add package metadata needed for Pi package usage.
  - Add extension typecheck script.
  - Add/remove dependencies in the correct sequence.
  - Remove `@opencode-ai/sdk` when no imports remain.

- `tsconfig.json`
  - Include `tsconfig.extension.json` in references.

- `vite.config.ts`
  - Remove OpenCode dev proxy when API layer no longer uses OpenCode server.
  - Add Pi extension dev proxy only if chosen.

- `src/constants/api.ts`, `src/api/http.ts`, `src/store/serverStore.ts`
  - Convert from OpenCode server/basic-auth concepts to PiAgentUi local server boot/connection state.
  - No provider credential storage.

- `src/api/sdk.ts`
  - Delete after all imports are removed, or temporarily replace with a non-SDK compatibility facade.

- `src/api/*.ts`
  - Replace SDK calls with owned client calls or unsupported-feature stubs.
  - Files likely in scope: `agent.ts`, `client.ts`, `command.ts`, `config.ts`, `file.ts`, `global.ts`, `lsp.ts`, `mcp.ts`, `message.ts`, `permission.ts`, `pty.ts`, `session.ts`, `skill.ts`, `todo.ts`, `tool.ts`, `vcs.ts`, `worktree.ts`.

- `src/types/api/*.ts`
  - Replace SDK-derived type aliases with owned DTOs or explicit unsupported types.
  - Files likely in scope: `agent.ts`, `common.ts`, `config.ts`, `event.ts`, `file.ts`, `mcp.ts`, `message.ts`, `model.ts`, `permission.ts`, `project.ts`, `pty.ts`, `session.ts`, `skill.ts`, `tool.ts`, `vcs.ts`, `worktree.ts`.

- `src/main.tsx`, `src/features/settings/components/ServiceSettings.tsx`, `src/hooks/useCloseServiceDialog.ts`, `src/store/serviceStore.ts`
  - Track A: ensure OpenCode auto-start does not run while Pi extension mode is active.
  - Track B: rename desktop service integration.

- `src-tauri/src/app/commands/opencode.rs`, `src-tauri/src/app/commands/mod.rs`, `src-tauri/src/app/mod.rs`
  - Track B only: rename commands and remove OpenCode process management.

- `src-tauri/src/app/bridge/args.rs`, `src-tauri/src/app/commands/bridge.rs`
  - Track B only: enforce loopback URL allowlist in Rust bridge.

- `src-tauri/capabilities/default.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`
  - Track B only: remove OpenCode branding and tighten security.

---

## Compatibility Contract

### DTO shape must match current UI

Current UI expects message shape similar to:

```ts
export interface MessageWithParts {
  info: Message
  parts: Part[]
}
```

Therefore owned DTOs must preserve this shape first, then adapt internally:

```ts
export interface CompatMessageInfo {
  id: string
  sessionID: string
  role: 'user' | 'assistant'
  time?: { created?: number; completed?: number }
  summary?: string
  modelID?: string
  providerID?: string
}

export interface CompatMessageWithParts {
  info: CompatMessageInfo
  parts: CompatPart[]
}

export type CompatPart =
  | CompatTextPart
  | CompatReasoningPart
  | CompatToolPart
  | CompatFilePart
  | CompatStepStartPart
  | CompatStepFinishPart
  | CompatUnsupportedPart

export interface CompatTextPart {
  id: string
  sessionID: string
  messageID: string
  type: 'text'
  text: string
}

export interface CompatReasoningPart {
  id: string
  sessionID: string
  messageID: string
  type: 'reasoning'
  text: string
}

export interface CompatToolPart {
  id: string
  sessionID: string
  messageID: string
  type: 'tool'
  tool: string
  state: { status: 'pending' | 'running' | 'completed' | 'error'; input?: unknown; output?: unknown; error?: string }
}

export interface CompatFilePart {
  id: string
  sessionID: string
  messageID: string
  type: 'file'
  mime?: string
  filename?: string
  url?: string
}

export interface CompatStepStartPart {
  id: string
  sessionID: string
  messageID: string
  type: 'step-start'
}

export interface CompatStepFinishPart {
  id: string
  sessionID: string
  messageID: string
  type: 'step-finish'
}

export interface CompatUnsupportedPart {
  id: string
  sessionID: string
  messageID: string
  type: 'unsupported'
  label: string
  data?: unknown
}
```

Exact fields must be finalized by a field inventory before implementation.

### Event envelope must match current frontend first

Current `src/api/events.ts` expects:

```ts
export interface CompatGlobalEvent {
  directory?: string
  payload: {
    type: string
    properties: unknown
  }
}
```

For MVP, the extension should emit this envelope on the current path or the frontend parser must be rewritten before server events are implemented.

Recommended MVP: keep `/global/event` and OpenCode-style event names already handled by the UI:

- `server.connected`
- `session.updated`
- `session.status`
- `session.idle`
- `session.error`
- `message.updated`
- `message.part.updated`
- `message.part.delta`
- `message.part.removed`
- `permission.asked` only if mapped; otherwise unsupported notification
- `question.asked` only if mapped; otherwise unsupported notification

For text deltas, current store expects payload shape compatible with its `PartDeltaPayload`, including `sessionID`, `messageID`, `partID`, `field`, and `delta`.

### Send message contract

Current frontend send params include:

```ts
interface SendMessageParams {
  sessionId: string
  text: string
  attachments: Attachment[]
  model: { providerID: string; modelID: string }
  agent?: string
  variant?: string
  directory?: string
}
```

MVP behavior:

- `text`: supported.
- `directory`: supported only as metadata/active project hint if Pi context allows it.
- `model`: support only if Pi allows model switch before send; otherwise ignore with warning event or reject with unsupported error.
- `attachments`: defer unless image/file input mapping is verified.
- `agent`, `variant`: defer unless Pi equivalent is verified.
- response: `202 accepted` plus optional synthetic client request ID; real assistant message ID is learned from events.

---

## Endpoint Coverage Matrix

### MVP supported

| Capability              | Existing frontend area            | Compatibility path                                   | Backend source                        |
| ----------------------- | --------------------------------- | ---------------------------------------------------- | ------------------------------------- |
| Health                  | `serverStore`, `client.ts`        | `/global/health` or current health path              | extension runtime state               |
| Event stream            | `events.ts`                       | `/global/event`                                      | Pi extension lifecycle/events         |
| Active models           | `client.ts`, model hooks          | wrapper-owned endpoint, final path decided in Task 1 | Pi model registry/settings            |
| Active session snapshot | `session.ts`, stores              | wrapper-owned endpoint, OpenCode-shaped response     | active Pi context/session mirror      |
| Send message            | `message.ts`, `useChatSession.ts` | wrapper-owned endpoint                               | `pi.sendUserMessage(...)`             |
| Abort turn              | message/session controls          | wrapper-owned endpoint                               | current Pi context abort if available |
| Static assets           | browser/webview                   | `/`, `/assets/*`                                     | extension static server               |

### Explicitly unsupported/deferred for MVP

- PTY terminal sessions.
- MCP management.
- LSP diagnostics endpoints.
- Provider OAuth/login.
- Full multi-session create/fork/switch/delete.
- Worktrees.
- VCS operations unless trivially provided by current UI independent of OpenCode.
- Permission/question flows unless Pi extension UI/RPC gives equivalent semantics.
- Share/export unless Pi exposes safe API from extension context.
- Config, project, agent, skill, todo, tool, file APIs that currently depend on OpenCode SDK.

Every deferred feature must return a typed unsupported error and must not call an OpenCode endpoint.

---

## Security Contract

Required for Track A:

- Bind only to `127.0.0.1` and optionally `::1`.
- Use OS-selected random high port by default.
- Generate per-run bearer token.
- Bootstrap token via same-origin injected boot data in served HTML, unless user chooses another mechanism.
- Keep bearer token in memory/session only; do not store it in `localStorage` or settings backups.
- Reject API and stream requests without `Authorization: Bearer <token>`.
- For browser-native SSE/WS where custom headers are constrained, prefer same-origin cookie/header strategy from extension-served page; do not put token in query strings or userinfo URLs.
- Validate `Host` and `Origin`.
- No wildcard CORS.
- Limit request body and WS frame sizes.
- Reject static path traversal.
- Never send provider API keys/OAuth tokens to browser.
- Never log local bearer token, provider secrets, or prompts by default.
- Close HTTP server and sockets on `session_shutdown`.

Required for Track B if touched:

- Rust bridge must validate URLs server-side, not only via Tauri capabilities.
- Allow only `http://127.0.0.1:*`, `http://localhost:*`, `ws://127.0.0.1:*`, `ws://localhost:*` as appropriate.
- Reject userinfo URLs, LAN IPs, non-loopback hosts, and external HTTPS URLs.
- Narrow `src-tauri/capabilities/default.json` from broad `http://**` / `https://**` to loopback-only.
- Reintroduce CSP instead of `csp: null` if compatible with current app.

---

## Validation Contract

Run during implementation milestones:

```bash
cd PiAgentUi
npm run typecheck
npm run lint
npm run test:run
npm run build
```

After extension tsconfig is added:

```bash
cd PiAgentUi
npm run typecheck:extensions
```

If Track B is touched:

```bash
cd PiAgentUi/src-tauri
cargo test
```

OpenCode cleanup check must use an allowlist because docs may mention migration history:

```bash
cd PiAgentUi
rg -n "@opencode-ai/sdk|getSDKClient|unwrap\(|opencode serve|OpenCode|opencode" src src-tauri extensions package.json vite.config.ts
```

Expected final runtime result:

- no `@opencode-ai/sdk` imports;
- no `opencode serve` launcher;
- no OpenCode user-facing app title;
- only temporary deprecated aliases if Track B explicitly keeps them for one release.

Pi package smoke:

```bash
cd PiAgentUi
npm run build
npm pack --dry-run
```

Then install/load the package in Pi using the local package workflow chosen for this repo and verify:

1. Pi loads the extension.
2. Extension serves the UI.
3. UI receives boot data.
4. UI sends a message to current Pi session.
5. Assistant response streams into existing chat UI.
6. Refresh/reconnect recovers current snapshot.
7. Invalid HTTP/SSE/WS auth is rejected.

---

## Implementation Tasks

### Task 1: Confirm Decisions and Write Design Spec

**Files:**

- Create: `docs/superpowers/specs/2026-05-28-pi-agent-extension-migration-design.md`

- [ ] Confirm all decisions in “Decisions Required Before Implementation”.
- [ ] Write the design spec with: MVP, non-goals, endpoint matrix, DTO/event contract, security contract, validation contract, unsupported-feature behavior, Track A/Track B split.
- [ ] Include exact better-tau reference: `D:/Documents/Github/PiAgentUI/better-tau/extensions/mirror-server.ts`.
- [ ] Run:

```bash
cd PiAgentUi
npm run typecheck
```

Expected: unchanged project still typechecks before migration starts.

### Task 2: Inventory Current Frontend API Fields and SDK Coupling

**Files:**

- Create: `docs/superpowers/specs/2026-05-28-pi-agent-ui-field-inventory.md`

- [ ] Run:

```bash
cd PiAgentUi
rg -n "@opencode-ai/sdk|getSDKClient|unwrap\(|from './sdk'|from '../api/sdk'|Client\[|SDK[A-Za-z]" src
```

- [ ] Inventory all files importing SDK-derived types or `getSDKClient`.
- [ ] Inventory consumed fields for:
  - `Session`
  - `MessageWithParts`
  - `Message.info`
  - every `Part` variant rendered by components/stores
  - `GlobalEvent`
  - `PartDeltaPayload`
  - `SendMessageParams`
- [ ] Mark each API module as: supported, stubbed, hidden, or deferred.
- [ ] Do not edit runtime code in this task.

### Task 3: Add Owned Compatibility Types Without Breaking UI Shape

**Files:**

- Create: `src/types/api/compat.ts`
- Create: `src/api/piContract.ts`
- Modify: `src/types/api/message.ts`, `src/types/api/event.ts`, `src/types/api/session.ts` only after inventory confirms exact fields.

- [ ] Add owned compatibility DTOs preserving current UI shape.
- [ ] Replace SDK aliases gradually with owned DTO aliases that match current field names.
- [ ] Do not flatten `MessageWithParts`.
- [ ] Keep `GlobalEvent` envelope compatible with current `events.ts` unless rewriting `events.ts` in the same task.
- [ ] Run:

```bash
cd PiAgentUi
npm run typecheck
npm run test:run -- src/store/messageStore.test.ts src/api/events.test.ts src/hooks/useChatSession.test.tsx
```

Expected: failures only from intentional type differences fixed before proceeding.

### Task 4: Add Extension Typecheck and Package Metadata

**Files:**

- Create: `tsconfig.extension.json`
- Modify: `tsconfig.json`
- Modify: `package.json`

- [ ] Add `tsconfig.extension.json` including `extensions/**/*.ts`.
- [ ] Add script:

```json
"typecheck:extensions": "tsc -p tsconfig.extension.json --noEmit"
```

- [ ] Include `typecheck:extensions` in `validate` after extension files exist.
- [ ] Add Pi package metadata:

```json
"pi": {
  "extensions": ["./extensions/piagentui-server.ts"]
}
```

- [ ] Add package contents/prepack strategy so `dist/` and `extensions/` are included when packed/installed.
- [ ] Decide dependency strategy for `@earendil-works/pi-coding-agent`:
  - runtime should be supplied by Pi package loader if supported;
  - local typecheck still needs a devDependency or path-compatible type resolution.
- [ ] Run:

```bash
cd PiAgentUi
npm run typecheck
npm run typecheck:extensions
npm pack --dry-run
```

### Task 5: Implement Extension Server Core Helpers and Tests

**Files:**

- Create: `extensions/piagentui-server-core.ts`
- Create: `extensions/piagentui-server-core.test.ts`

- [ ] Write tests first for:
  - loopback host accepted;
  - LAN/external host rejected;
  - userinfo URL rejected;
  - malformed auth rejected;
  - valid bearer auth accepted;
  - Origin/Host mismatch rejected;
  - static path traversal rejected;
  - body-size guard rejects oversized body;
  - boot data injection does not put token in URL.

Use test token construction that is obviously fake and not a credential:

```ts
const sampleToken = ['test', 'token', 'value'].join('-')
```

- [ ] Implement pure helpers to pass tests.
- [ ] Run:

```bash
cd PiAgentUi
npm run test:run -- extensions/piagentui-server-core.test.ts
npm run typecheck:extensions
```

### Task 6: Implement Pi Extension Server Skeleton

**Files:**

- Create: `extensions/piagentui-server.ts`
- Modify: extension tests/helpers as needed

- [ ] Implement extension entrypoint importing `ExtensionAPI` from `@earendil-works/pi-coding-agent`.
- [ ] Start server on `session_start` or the earliest correct lifecycle event.
- [ ] Cleanup on `session_shutdown`.
- [ ] Bind loopback on random high port.
- [ ] Serve `dist/index.html`, injecting boot data same-origin.
- [ ] Serve `/assets/*` safely.
- [ ] Implement authenticated health endpoint compatible with frontend/serverStore path decision.
- [ ] Run:

```bash
cd PiAgentUi
npm run typecheck:extensions
npm run build
npm pack --dry-run
```

### Task 7: Replace Basic Auth Server Store with Pi Local Boot State

**Files:**

- Modify: `src/store/serverStore.ts`
- Modify: `src/store/serverStore.test.ts`
- Modify: `src/api/http.ts`
- Modify: `src/constants/api.ts`

- [ ] Remove provider/server password persistence from active Pi mode.
- [ ] Store only base URL and in-memory/session-scoped local token.
- [ ] Add migration tests proving old Basic auth/password values are not exported in backups after migration.
- [ ] Ensure auth headers use bearer token and never query strings.
- [ ] Run:

```bash
cd PiAgentUi
npm run test:run -- src/store/serverStore.test.ts src/api/http.test.ts
npm run typecheck
```

### Task 8: Add `piClient` and Replace SDK Wrapper Entry Points

**Files:**

- Create: `src/api/piClient.ts`
- Create: `src/api/piClient.test.ts`
- Modify: `src/api/client.ts`
- Modify: `src/api/session.ts`
- Modify: `src/api/message.ts`

- [ ] Write `piClient` tests for bearer headers, no token in URL, JSON errors, base URL normalization.
- [ ] Implement `get`, `post`, `delete`, and stream helper if needed.
- [ ] Replace model/session/message wrappers first because they are MVP-supported.
- [ ] Preserve existing exported function names consumed by hooks/components.
- [ ] For send message, return accepted state if Pi returns no message ID; rely on events for message updates.
- [ ] Run:

```bash
cd PiAgentUi
npm run test:run -- src/api/piClient.test.ts src/hooks/useSessions.test.tsx src/hooks/useChatSession.test.tsx src/hooks/useModelSelection.test.tsx
npm run typecheck
```

### Task 9: Implement Pi Event Translation Compatible with Existing `events.ts`

**Files:**

- Modify: `extensions/piagentui-server.ts`
- Create: `src/api/piEventTranslator.test.ts`
- Modify: `src/api/events.ts` only if necessary and covered by tests.

- [ ] Add tests for the current envelope `{ directory, payload: { type, properties } }`.
- [ ] Add tests for `message.part.delta` shape expected by `messageStore`.
- [ ] Map Pi events to existing frontend events:
  - turn start -> `session.status` running;
  - turn end -> `session.idle` or `session.status` idle;
  - message update -> `message.updated`;
  - part delta/update -> `message.part.delta` / `message.part.updated`;
  - tool events -> tool part updates;
  - errors -> `session.error`.
- [ ] Add initial snapshot event on connect.
- [ ] Add reconnect behavior using existing generation/snapshot logic.
- [ ] Run:

```bash
cd PiAgentUi
npm run test:run -- src/api/events.test.ts src/api/sse.test.ts src/api/piEventTranslator.test.ts src/store/messageStore.test.ts
npm run typecheck
```

### Task 10: Gate or Stub All Unsupported OpenCode-Only Features

**Files:**

- Modify: remaining `src/api/*.ts`
- Modify: affected hooks/components only when they crash on unsupported errors.

- [ ] Run:

```bash
cd PiAgentUi
rg -n "getSDKClient|unwrap\(|@opencode-ai/sdk|opencode|OpenCode" src
```

- [ ] For every remaining API module, implement one of:
  - supported Pi-backed wrapper;
  - typed unsupported error;
  - hidden/disabled UI action with existing notification style.
- [ ] Cover at least:
  - `agent.ts`
  - `command.ts`
  - `config.ts`
  - `file.ts`
  - `global.ts`
  - `lsp.ts`
  - `mcp.ts`
  - `permission.ts`
  - `pty.ts`
  - `skill.ts`
  - `todo.ts`
  - `tool.ts`
  - `vcs.ts`
  - `worktree.ts`
- [ ] Ensure `pty.ts` never embeds credentials/tokens in URLs.
- [ ] Run:

```bash
cd PiAgentUi
npm run test:run
npm run typecheck
```

### Task 11: Prevent OpenCode Auto-Start in Pi Extension Mode

**Files:**

- Modify: `src/main.tsx`
- Modify: `src/store/serviceStore.ts`
- Modify: `src/features/settings/components/ServiceSettings.tsx`
- Modify: `src/hooks/useCloseServiceDialog.ts`

- [ ] Detect Pi extension mode from boot data.
- [ ] In Pi extension mode, do not auto-start `opencode serve`.
- [ ] Hide/disable OpenCode service settings without changing layout structure more than necessary.
- [ ] Do not rename desktop commands yet unless Track B is approved.
- [ ] Run:

```bash
cd PiAgentUi
npm run test:run -- src/store/serviceStore.test.ts src/utils/settingsBackup.test.ts
npm run typecheck
```

### Task 12: Remove `@opencode-ai/sdk` and SDK Facade

**Files:**

- Modify: `package.json`, lockfile if present
- Delete or rewrite: `src/api/sdk.ts`
- Modify: tests that mock SDK

- [ ] Confirm no imports remain:

```bash
cd PiAgentUi
rg -n "@opencode-ai/sdk|getSDKClient|unwrap\(" src
```

- [ ] Remove dependency using the repo's package manager:

```bash
cd PiAgentUi
npm uninstall @opencode-ai/sdk
```

If package manager/lockfile state is unclear, stop and ask.

- [ ] Delete `src/api/sdk.ts` if unused.
- [ ] Update tests to mock `piClient` or API wrappers instead of SDK.
- [ ] Run:

```bash
cd PiAgentUi
npm run validate
npm run typecheck:extensions
```

### Task 13: Track B — Tauri Desktop Cleanup and Security Hardening

Only start after Track A smoke passes and user approves desktop scope.

**Files:**

- Rename: `src-tauri/src/app/commands/opencode.rs` -> `src-tauri/src/app/commands/pi_agent.rs`
- Modify: `src-tauri/src/app/commands/mod.rs`
- Modify: `src-tauri/src/app/mod.rs`
- Modify: `src-tauri/src/app/bridge/args.rs`
- Modify: `src-tauri/src/app/commands/bridge.rs`
- Modify: `src/store/serviceStore.ts`
- Modify: `src-tauri/capabilities/default.json`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/Cargo.toml`

- [ ] Decide desktop behavior: connect to existing Pi extension server, spawn `pi --mode rpc`, or defer.
- [ ] Rename service commands to Pi names if desktop remains.
- [ ] Keep old command aliases for one transition release only if required by existing frontend code.
- [ ] Migrate storage keys:
  - `opencode-auto-start-service` -> `pi-agent-auto-start-service`
  - `opencode-binary-path` -> `pi-agent-binary-path`
  - `opencode-service-env-vars` -> `pi-agent-service-env-vars`
- [ ] Add Rust-side URL allowlist tests for bridge connect/send paths.
- [ ] Narrow Tauri HTTP permissions to loopback-only.
- [ ] Reintroduce CSP if compatible.
- [ ] Run:

```bash
cd PiAgentUi
npm run typecheck
npm run test:run
cd src-tauri
cargo test
```

### Task 14: Final Product Metadata and OpenCode Cleanup

**Files:**

- Modify: `package.json`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/tauri.conf.json`
- Modify: README/docs/user-facing strings

- [ ] Apply user-approved final product name.
- [ ] Update package name/description.
- [ ] Update Tauri product name/window title/identifier if Track B is in scope.
- [ ] Remove OpenCode user-facing strings.
- [ ] Run allowlisted grep:

```bash
cd PiAgentUi
rg -n "@opencode-ai/sdk|getSDKClient|unwrap\(|opencode serve|OpenCode|opencode" src src-tauri extensions package.json vite.config.ts README.md
```

Expected: no runtime/user-facing OpenCode references except approved temporary aliases.

- [ ] Run full validation:

```bash
cd PiAgentUi
npm run validate
npm run typecheck:extensions
npm run build
npm pack --dry-run
```

If Track B is in scope:

```bash
cd PiAgentUi/src-tauri
cargo test
```

---

## Review Checklist for Implementation Milestones

After Tasks 6, 9, 12, and 13, run a critical review pass before continuing:

- Correctness/regression review against this plan.
- Test coverage and validation review.
- Security review for local HTTP/SSE/WS, token handling, and Tauri bridge if touched.
- Simplicity review to catch unnecessary OpenCode compatibility that can be deleted.

The reviewer output should be synthesized before any fixes are applied. Apply fixes with one writer only.

---

## Current Recommended Milestone Split

1. **Milestone 1:** decisions + design spec + field inventory.
2. **Milestone 2:** owned DTOs + extension typecheck/package metadata.
3. **Milestone 3:** secure extension server skeleton + boot data.
4. **Milestone 4:** model/session/message wrappers + event streaming.
5. **Milestone 5:** unsupported feature gating + SDK removal.
6. **Milestone 6:** Pi package smoke and final OpenCode cleanup.
7. **Milestone 7:** optional Tauri desktop cleanup/hardening.
