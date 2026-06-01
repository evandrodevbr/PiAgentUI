# PiAgentUI STT LAN Real Sessions Project Folders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement real Pi session creation, project-folder session history, LAN access with QR code, and file-based STT voice input for PiAgentUI.

**Architecture:** Keep runtime changes inside PiAgentUI's extension backend and focused frontend surfaces. Add pure helpers for network/session grouping/STT settings, test them first, then wire endpoints and UI with minimal component changes.

**Tech Stack:** TypeScript, React 19, Vite 8, Vitest, Testing Library, Node HTTP extension server, browser MediaRecorder, OpenAI-compatible transcription API.

---

## File Map

- `extensions/piagentui-server-core.ts`: host/origin validation helpers, LAN URL discovery, STT URL/settings sanitization helpers.
- `extensions/piagentui-server-core.test.ts`: unit tests for backend helpers.
- `extensions/piagentui-server.ts`: real session creation, LAN settings endpoints, STT settings/transcription endpoints, dynamic boot base URL.
- `extensions/piagentui-server.test.ts`: integration tests for endpoints.
- `src/types/api/network.ts`: network access response/request types.
- `src/api/network.ts`, `src/api/network.test.ts`: client API for LAN access.
- `src/types/api/stt.ts`: STT settings/transcription types.
- `src/api/stt.ts`, `src/api/stt.test.ts`: client API for STT.
- `src/hooks/useVoiceTranscription.ts`, `src/hooks/useVoiceTranscription.test.tsx`: browser recording/transcription state machine.
- `src/features/chat/input/VoiceInputButton.tsx`, `src/features/chat/input/VoiceInputButton.test.tsx`: mic UI.
- `src/features/chat/InputBox.tsx`: accept voice transcript insertion.
- `src/features/chat/input/InputToolbar.tsx`: render voice button.
- `src/features/sessions/sessionProjectGroups.ts`, `src/features/sessions/sessionProjectGroups.test.ts`: pure project grouping.
- `src/features/sessions/SessionList.tsx`, `src/features/sessions/SessionList.test.tsx`: project folder rendering.
- `src/features/settings/components/NetworkAccessSettings.tsx`, `src/features/settings/components/NetworkAccessSettings.test.tsx`: LAN toggle/URL/QR UI.
- `src/features/settings/components/ServersSettings.tsx`: include network section.
- `src/locales/en/*.json`, `src/locales/zh-CN/*.json`: minimal labels.
- `package.json`: add `qrcode` only if frontend QR generation needs it.

## Task 1: Backend helper tests and helpers

- [ ] Write tests in `extensions/piagentui-server-core.test.ts` for LAN host validation, local URL discovery injection, and STT URL/settings sanitization.
- [ ] Implement helpers in `extensions/piagentui-server-core.ts`.
- [ ] Run `npx vitest run extensions/piagentui-server-core.test.ts`.
- [ ] Commit `test/feat: add network and stt backend helpers`.

## Task 2: Real session creation endpoint

- [ ] Add failing tests in `extensions/piagentui-server.test.ts` proving `POST /api/sessions` creates a new `.jsonl`, calls `switchSession`, returns the new id, and returns `501` without `switchSession`.
- [ ] Implement minimal real session file creation in `extensions/piagentui-server.ts`.
- [ ] Run `npx vitest run extensions/piagentui-server.test.ts`.
- [ ] Commit `feat: create real pi sessions from ui`.

## Task 3: Project folder grouping

- [ ] Add failing tests in `src/features/sessions/sessionProjectGroups.test.ts` for Windows/POSIX grouping, basename labels, ordering, and search behavior.
- [ ] Implement `sessionProjectGroups.ts`.
- [ ] Add/adjust `SessionList.test.tsx` for folders expand/collapse and selection.
- [ ] Update `SessionList.tsx` minimally to render project folders by default when grouped.
- [ ] Run `npx vitest run src/features/sessions/sessionProjectGroups.test.ts src/features/sessions/SessionList.test.tsx`.
- [ ] Commit `feat: group sessions by project folder`.

## Task 4: LAN access endpoints and UI

- [ ] Add backend endpoint tests for `GET/POST /api/network/access`, LAN host allowed only when enabled, and host-based boot data.
- [ ] Implement network settings persistence and endpoint behavior.
- [ ] Add frontend API tests for `src/api/network.ts`.
- [ ] Add `NetworkAccessSettings` tests for toggle, URL, and QR placeholder/rendering.
- [ ] Implement API and settings component.
- [ ] Wire it into `ServersSettings.tsx`.
- [ ] Run targeted backend/frontend tests.
- [ ] Commit `feat: expose local network access settings`.

## Task 5: STT settings and transcription backend/client

- [ ] Add backend tests for redacted settings, save semantics, invalid URLs, and transcription provider errors.
- [ ] Implement settings persistence and transcription endpoint.
- [ ] Add `src/api/stt.test.ts` and implement `src/api/stt.ts`.
- [ ] Run targeted tests.
- [ ] Commit `feat: add stt settings and transcription api`.

## Task 6: Voice recording UI

- [ ] Add hook tests for permission denied, record/transcribe success, and error path.
- [ ] Implement `useVoiceTranscription.ts`.
- [ ] Add `VoiceInputButton` tests and component.
- [ ] Wire `InputToolbar` and `InputBox` to append transcript to composer without auto-send.
- [ ] Run targeted tests.
- [ ] Commit `feat: add voice transcription composer control`.

## Task 7: Final validation and review

- [ ] Run `npx tsc --noEmit`.
- [ ] Run `npx tsc --noEmit -p tsconfig.extension.json`.
- [ ] Run `npm run test:run`.
- [ ] Run `npm run build`.
- [ ] Run `git diff --check`.
- [ ] Review changed files for unnecessary edits.
- [ ] Commit any final fixes.
