# PiAgentUI Git Composer Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a Git branch/control popover in the message composer using GitHub Octicons and safe backend Git endpoints.

**Architecture:** Add focused Git logic in `extensions/piagentui-git-manager.ts`, expose `/api/vcs/*` endpoints from the extension server, expand frontend VCS API/types, and add `GitComposerControl` inside `InputToolbar` before agent/variant selectors.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Node child_process, Git CLI, `@primer/octicons-react`.

---

## Files

- Create: `extensions/piagentui-git-manager.ts`
- Create: `extensions/piagentui-git-manager.test.ts`
- Modify: `extensions/piagentui-server.ts`
- Modify: `extensions/piagentui-server.test.ts`
- Modify: `src/types/api/vcs.ts`
- Modify: `src/types/api/index.ts`
- Modify: `src/api/vcs.ts`
- Create/modify: `src/api/vcs.test.ts`
- Create: `src/features/chat/input/GitComposerControl.tsx`
- Create: `src/features/chat/input/GitComposerControl.test.tsx`
- Modify: `src/features/chat/input/InputToolbar.tsx`
- Modify: `package.json`, `package-lock.json`

## Task 1 — Backend Git manager

- [ ] Write failing tests for branch parsing, status parsing, safe argv commands and commit validation.
- [ ] Implement `runGit`, `getGitStatus`, `listGitBranches`, `checkoutGitBranch`, `createGitBranch`, `stageGitPaths`, `unstageGitPaths`, `commitGitChanges`, `pullGitBranch`, `pushGitBranch`.
- [ ] Verify focused test passes.

## Task 2 — Backend endpoints

- [ ] Write failing server endpoint tests for `/api/vcs/status`, `/api/vcs/branches`, `/api/vcs/commit`.
- [ ] Add endpoint routing in `piagentui-server.ts` with request parsing and errors.
- [ ] Verify server tests pass.

## Task 3 — Frontend API contract

- [ ] Write failing API tests for query/body shapes.
- [ ] Expand `src/types/api/vcs.ts` and `src/api/vcs.ts`.
- [ ] Verify API tests pass.

## Task 4 — Composer UI

- [ ] Install `@primer/octicons-react`.
- [ ] Write failing component tests for branch chip, popover opening and commit action.
- [ ] Implement `GitComposerControl` with Octicons.
- [ ] Integrate into `InputToolbar` before agent selector.
- [ ] Verify component tests pass.

## Task 5 — Full verification

- [ ] Format touched files with `node node_modules/prettier/bin/prettier.cjs --write ...`.
- [ ] Run LSP diagnostics on touched files.
- [ ] Run `npm run typecheck`, `npm run typecheck:extensions`, focused tests, `npm run test:run`, `npm run build`, and `git diff --check`.
