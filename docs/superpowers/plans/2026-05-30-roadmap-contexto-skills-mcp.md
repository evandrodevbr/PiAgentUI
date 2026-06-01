# Roadmap Contexto, Skills e MCP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** concluir a integração de contexto real, skills reais, avisos de compaction/overflow e MCP nativo no PiAgentUI.

**Architecture:** O backend da extensão PiAgentUI deve ser a fonte de verdade para dados do runtime Pi. A UI deve consumir endpoints pequenos e tipados, preservando fallback seguro quando dados runtime não existirem.

**Tech Stack:** TypeScript, React, Vite, Vitest, extensão PiAgentUI HTTP/SSE, Pi runtime APIs.

---

## Task 1: Context metadata e uso real

**Status:** concluído em `f5a3fa5 feat: enrich context details with model metadata`.

## Task 2: Tool results somente em tool cards

**Status:** concluído em `41adf23 fix: keep tool results in tool cards`.

## Task 3: Skills reais por origem

**Status:** concluído em `257d63c feat: show real skills by source`.

## Task 4: Avisos de overflow e compaction

**Files:**
- Modify: `src/hooks/useSessionStats.ts`
- Modify: `src/features/chat/sidebar/SidebarFooter.tsx`
- Modify: `src/features/chat/sidebar/ContextDetailsDialog.tsx`
- Test: `src/hooks/useSessionStats.test.tsx`

- [ ] Adicionar estado derivado para `contextStatus`: `unknown`, `normal`, `warning`, `danger`.
- [ ] Mostrar fonte do dado: runtime, tokens ou estimativa.
- [ ] Mostrar aviso quando `contextKnown=false` após compaction.
- [ ] Mostrar aviso quando uso >= 70% e >= 90%.
- [ ] Rodar testes focados e build.
- [ ] Commit: `feat: surface context overflow notices`.

## Task 5: MCP backend real

**Files:**
- Modify/Create: `extensions/piagentui-server.ts`
- Modify/Create: `src/api/mcp.ts`
- Test: `extensions/piagentui-server.test.ts`

- [ ] Ler configuração MCP do Pi/agent config quando disponível.
- [ ] Expor `/api/mcp/servers` com servidores, status e origem.
- [ ] Preservar fallback vazio seguro.
- [ ] Testar config válida, ausente e inválida.
- [ ] Commit: `feat: expose real mcp servers`.

## Task 6: MCP UI real

**Files:**
- Modify: `src/components/McpPanel.tsx`
- Modify: `src/types/api/mcp.ts`
- Test: `src/components/McpPanel.test.tsx` se existir; caso contrário criar.

- [ ] Agrupar servidores por status/origem.
- [ ] Mostrar tools quando disponíveis.
- [ ] Mostrar erro de inicialização/config.
- [ ] Commit: `feat: render real mcp server status`.

## Task 7: Skills avançado

**Files:**
- Modify: `extensions/piagentui-server.ts`
- Modify: `src/components/SkillPanel.tsx`

- [ ] Expor diagnósticos/collisions quando Pi disponibilizar.
- [ ] Mostrar `disableModelInvocation` quando disponível.
- [ ] Melhorar origem com package/source quando disponível.
- [ ] Commit: `feat: add skill diagnostics metadata`.

## Task 8: Hardening e docs

- [ ] Extrair parsers grandes de `extensions/piagentui-server.ts` se necessário.
- [ ] Atualizar Obsidian/task list.
- [ ] Rodar full test/build.
- [ ] Fazer checkpoint commit/tag local se solicitado.
