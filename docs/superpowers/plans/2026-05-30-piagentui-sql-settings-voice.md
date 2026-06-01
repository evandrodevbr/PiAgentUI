# PiAgentUI SQL Settings and Voice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move backend-owned PiAgentUI settings to a local SQLite database and fix/extend voice settings for local OpenAI-compatible STT/TTS providers such as Speaches.

**Architecture:** The backend extension becomes the source of truth for backend-owned settings using `~/.pi/agent/piagentui.db`, with a SQL table for namespaced JSON settings and migration from the legacy `piagentui-settings.json`. Frontend voice settings continue using HTTP APIs, now with STT API-key-required control and TTS model/voice configuration.

**Tech Stack:** Node `node:sqlite` `DatabaseSync`, TypeScript, Vitest, React settings components.

---

## Files

- Create: `extensions/piagentui-settings-store.ts` — SQLite settings repository, schema, defaults, legacy JSON migration.
- Create: `extensions/piagentui-settings-store.test.ts` — unit tests for SQL persistence and migration.
- Modify: `extensions/piagentui-server.ts` — replace JSON helpers with SQLite store; add TTS settings/speech endpoints; allow keyless OpenAI-compatible STT when configured.
- Modify: `extensions/piagentui-server.test.ts` — integration coverage for keyless STT and TTS settings.
- Modify: `src/types/api/stt.ts`, `src/api/stt.ts`, `src/hooks/useVoiceTranscription.ts` — expose `apiKeyRequired` and avoid blocking local Speaches.
- Create/Modify: `src/types/api/tts.ts`, `src/api/tts.ts`, `src/features/settings/components/TtsSettings.tsx`, `src/features/settings/components/VoiceSettings.tsx` — TTS settings UI with voice selection.
- Modify tests under `src/hooks` and `src/features/settings/components`.

## Tasks

### Task 1: SQL settings store

- [ ] Write failing store tests for SQLite persistence and legacy JSON migration.
- [ ] Implement `extensions/piagentui-settings-store.ts` with `app_meta` and `settings` tables.
- [ ] Run targeted store tests and commit.

### Task 2: Backend voice behavior

- [ ] Write failing server/integration tests for keyless OpenAI-compatible STT and TTS settings sanitization.
- [ ] Update backend STT to require API key only when `apiKeyRequired` is true.
- [ ] Add TTS settings and `/api/tts/speech` proxy.
- [ ] Run extension tests and commit.

### Task 3: Frontend voice UI

- [ ] Write failing hook/settings tests for keyless STT start and TTS voice selection.
- [ ] Add STT `apiKeyRequired` toggle.
- [ ] Add TTS settings card with model, voice, format, endpoint, API key behavior.
- [ ] Run targeted frontend tests and commit.

### Task 4: Validation

- [ ] Run `npx tsc --noEmit`.
- [ ] Run `npm run typecheck:extensions`.
- [ ] Run targeted voice/storage tests.
- [ ] Run `npm run build`.
- [ ] Run `git diff --check`.
