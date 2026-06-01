# PiAgentUI Active Session Switch Design

## Goal

When the user opens an existing session in PiAgentUI and sends a message, the message must be delivered to that selected Pi session, not to whichever session was active when the Pi TUI launched.

## Current finding

- The frontend route/store correctly loads selected sessions and their messages.
- `src/hooks/useChatSession.ts` sends the selected `sessionId` to `sendMessageAsync()`.
- `extensions/piagentui-server.ts` receives `sessionId`, but still calls `pi.sendUserMessage(parsed.text)`.
- `pi.sendUserMessage()` always targets the current active Pi runtime session.
- Pi exposes `switchSession()` only on `ExtensionCommandContext`, not on normal event `ExtensionContext` used by `session_start` and the HTTP server.
- `AgentSessionRuntime.switchSession()` intentionally emits `session_shutdown`, disposes the old session, creates the replacement session, rebinds extensions, then runs `withSession(replacedCtx)`.
- The existing PiAgentUI extension currently stops the web server on every `session_shutdown`, so a normal Pi session switch can close the HTTP/SSE server and force reconnects.

## Selected approach: activate and send on the backend

The backend should become authoritative for message routing:

1. Resolve requested `sessionId` to the JSONL session file in the current session directory.
2. If the requested session differs from the active Pi session, switch the real Pi runtime to that session.
3. Send the user message inside the replacement session callback so the message cannot land in the old session.
4. Keep the existing frontend model: route/session selection still works as today; `sendMessageAsync()` keeps passing `sessionId`.

This preserves the current UI while making the server guarantee correctness.

## Required changes

### Pi core

Expose a safe session-switch capability to extension event contexts, or a narrowly-scoped equivalent that can be used by long-lived extension services.

Preferred API shape:

```ts
interface ExtensionContext {
  switchSession(
    sessionPath: string,
    options?: { withSession?: (ctx: ReplacedSessionContext) => Promise<void> },
  ): Promise<{ cancelled: boolean }>
}
```

Implementation should reuse the existing `switchSessionHandler` already used by `createCommandContext()`. The important behavior is not a new session implementation; it is making the already-existing runtime switch available to the PiAgentUI HTTP server context.

### PiAgentUI extension server

Add helpers in `extensions/piagentui-server.ts`:

- `getSessionFileForId(sessionId)` scans `latestCtx.sessionManager.getSessionDir()` for `*_${sessionId}.jsonl`.
- `sendUserMessageToSession(parsed)` validates `sessionId`, resolves the session file, switches if needed, and sends in the correct context.
- `session_shutdown` handling must not tear down the HTTP server on `reason === 'resume'` if the server is intentionally switching sessions for the web UI. The server should keep the port stable and update `latestCtx` on the following `session_start`.

Target send flow:

```ts
if (requestedSessionId && requestedSessionId !== activeSessionId) {
  const sessionFile = getSessionFileForId(requestedSessionId)
  const result = await latestCtx.switchSession(sessionFile, {
    withSession: async replacedCtx => {
      await maybeSetModel(replacedCtx, parsed.model)
      await replacedCtx.sendUserMessage(parsed.text)
    },
  })
  if (result.cancelled) return HTTP 409
  return HTTP 202
}

await maybeSetModel(latestCtx, parsed.model)
pi.sendUserMessage(parsed.text)
```

If `sessionId` is missing or already active, keep the existing path.

### Frontend

Keep frontend mostly unchanged.

Small additions only if needed:

- `sendMessageAsync()` continues sending `sessionId`.
- Optional: handle HTTP `409`/`404` with a clear toast if target session cannot be activated.
- Optional: add `activeSessionId` from `server.connected`/`session.status` later, but not required for the core fix.

## Alternatives considered

### Activate on session selection

Frontend would call `/api/sessions/:id/activate` when a user clicks a session. This matches the user's mental model, but it introduces a race: if the user sends before activation completes, the message can still hit the old session unless send also validates activation. It is useful as a UX enhancement after backend routing is correct, not as the primary correctness mechanism.

### Frontend guard only

Frontend could block sending if selected session differs from active Pi session. This avoids Pi core changes but makes UX worse and still requires a trustworthy active-session signal from the backend. It detects the problem instead of solving it.

## Tests

### Extension/unit tests

Add or update extension server tests to cover:

1. Sending with active `sessionId` calls `pi.sendUserMessage()` without switching.
2. Sending with different `sessionId` resolves the matching JSONL file and calls `ctx.switchSession(sessionFile, { withSession })`.
3. The `withSession` callback calls `replacedCtx.sendUserMessage(text)`.
4. Unknown `sessionId` returns 404 and does not send to the active session.
5. Cancelled switch returns 409 and does not send.
6. `session_shutdown` with `reason: 'resume'` does not close the web server during web-initiated session switching.

### Frontend tests

Add or update API/hook tests to cover:

1. `sendMessageAsync()` includes `sessionId` in the payload.
2. Send error responses surface through the existing error handling path.
3. Existing route/session selection behavior remains unchanged.

### Manual verification

1. Start Pi in session A.
2. Open PiAgentUI.
3. Select existing session B in the sidebar.
4. Send a message.
5. Verify new user and assistant messages appear in session B.
6. Verify session A JSONL is unchanged.
7. Verify `/global/event` remains connected and streaming works without F5.

## Risks and mitigations

- Switching sessions invalidates old extension contexts. Mitigation: send inside `withSession(replacedCtx)` and avoid captured stale `pi`/ctx after switch.
- Current extension closes the HTTP server on `session_shutdown`. Mitigation: preserve server across `resume` switches and update `latestCtx` on `session_start`.
- Pi core API change can be too broad. Mitigation: expose only the existing switch handler; do not create parallel session logic.
- Session file lookup by suffix must be strict. Mitigation: only match `_${sessionId}.jsonl` inside the current session dir.

## Acceptance criteria

- Sending from selected session B never writes to active-at-launch session A.
- Frontend routing and message loading stay visually the same.
- The web server port remains stable during a session switch initiated by PiAgentUI.
- Streaming still updates live after switch.
- Typecheck, extension typecheck, relevant tests, and build pass.
