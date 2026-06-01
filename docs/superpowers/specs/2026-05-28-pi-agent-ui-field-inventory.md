# Inventário de Campos e Dependências do SDK do OpenCode no PiAgentUi

Este documento registra todas as dependências da biblioteca `@opencode-ai/sdk` encontradas no `PiAgentUi`, detalhando as estruturas (DTOs) que o frontend consome e como elas serão mapeadas para a nova estrutura de compatibilidade com o Pi Agent.

---

## 1. Arquivos com Acoplamento ao SDK do OpenCode

Os seguintes arquivos realizam importações diretas do cliente SDK (`@opencode-ai/sdk`) ou utilizam tipos derivados dele:

### Arquivos em `src/api/`
* `agent.ts`
* `client.ts`
* `command.ts`
* `config.ts`
* `file.ts`
* `global.ts`
* `lsp.ts`
* `mcp.ts`
* `message.ts`
* `permission.ts`
* `pty.ts`
* `session.ts`
* `skill.ts`
* `todo.ts`
* `tool.ts`
* `vcs.ts`
* `worktree.ts`
* `sdk.ts`

### Arquivos em `src/types/api/`
* `agent.ts`
* `common.ts`
* `config.ts`
* `event.ts`
* `file.ts`
* `mcp.ts`
* `message.ts`
* `model.ts`
* `permission.ts`
* `project.ts`
* `pty.ts`
* `session.ts`
* `skill.ts`
* `tool.ts`
* `vcs.ts`
* `worktree.ts`

---

## 2. Inventário de Estruturas Consumidas pela UI

Para que a migração não quebre o frontend, a API da extensão Pi deve produzir e aceitar dados que correspondam a estas chaves essenciais:

### A. Estrutura de Mensagem (`MessageWithParts` / `Message`)
O frontend lê de `message.info` e de `message.parts`:
* **`info`** (`UserMessage` ou `AssistantMessage`):
  * `id`: string (UUID da mensagem).
  * `sessionID`: string (UUID da sessão).
  * `role`: `'user' | 'assistant'`.
  * `time`: `{ created?: number; completed?: number }`.
  * `summary`: string (breve descrição se disponível).
  * `modelID`: string (somente assistente).
  * `providerID`: string (somente assistente).
* **`parts`** (Array de blocos que compõem a mensagem):
  * **`TextPart`**: `{ type: 'text', text: string }`.
  * **`ReasoningPart`**: `{ type: 'reasoning', text: string }`.
  * **`ToolPart`**: `{ type: 'tool', tool: string, state: { status: 'pending' | 'running' | 'completed' | 'error', input?: any, output?: any, error?: string } }`.
  * **`FilePart`**: `{ type: 'file', filename?: string, mime?: string, url?: string }`.
  * **`StepStartPart`**: `{ type: 'step-start' }`.
  * **`StepFinishPart`**: `{ type: 'step-finish' }`.

### B. Estrutura de Sessão (`Session`)
Utilizada no menu lateral de histórico e criação:
* `id`: string (UUID).
  * `title`: string (nome da sessão).
  * `directory`: string (diretório de trabalho correspondente).
  * `time`: `{ created?: number; updated?: number }`.
  * `summary`: `{ title?: string; category?: string; difficulty?: string; tokens?: number; cost?: number }`.
  * `status`: `'idle' | 'running' | 'error'`.

### C. Envelopes de Eventos Globais (`GlobalEvent`)
Processados pelo pipeline de SSE em `events.ts`:
* `{ directory?: string, payload: { type: string, properties: any } }`
* Eventos chave:
  * `server.connected`
  * `session.updated`
  * `session.status`
  * `session.idle`
  * `session.error`
  * `message.updated`
  * `message.part.updated`
  * `message.part.delta`

---

## 3. Estratégia de Mapeamento no MVP

| Módulo Original | Ação / Novo Mapeamento |
| :--- | :--- |
| **`session`** | Consultas diretas ao Pi Session Manager via rotas REST locais da extensão. Mapeado para sessões nativas do Pi. |
| **`message`** | Mapeado para o envio assíncrono de prompts ao Pi (`pi.sendUserMessage`). Eventos nativos do Pi traduzidos em deltas de partes. |
| **`tool`** | Retorna ferramentas padrões disponíveis do Pi. |
| **`pty` / `lsp` / `mcp`** | Desativados visualmente / stubs de array vazio / erro 501. |
| **`worktree` / `vcs`** | Desativados visualmente. |
