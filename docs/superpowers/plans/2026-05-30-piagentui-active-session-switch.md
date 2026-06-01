# Plano de Implementação — Troca Correta de Sessões no PiAgentUI

> **Para agentes executores:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para implementar este plano tarefa por tarefa. Os passos usam checkbox (`- [ ]`) para acompanhamento.

**Objetivo:** garantir que uma mensagem enviada no front para a sessão B seja enviada para a sessão real B do Pi, nunca para a sessão que estava ativa quando o Pi abriu.

**Arquitetura:** o backend da extensão PiAgentUI será autoritativo para roteamento de mensagens. Antes de chamar `sendUserMessage`, ele compara `parsed.sessionId` com a sessão real ativa; se divergir, resolve o arquivo `.jsonl`, troca a sessão real do Pi com `switchSession`, e envia dentro do `withSession(replacedCtx)`.

**Tech Stack:** TypeScript, extensão Pi (`ExtensionContext` / `ReplacedSessionContext`), HTTP local Node, Vitest, React frontend sem mudança estrutural.

---

## Estrutura de arquivos

- Modificar: `../pi/packages/coding-agent/src/core/extensions/types.ts`
  - Adicionar `switchSession()` em `ExtensionContext`.
- Modificar: `../pi/packages/coding-agent/src/core/extensions/runner.ts`
  - Expor `switchSession` também em `createContext()` usando o handler já existente.
- Modificar: `../pi/packages/coding-agent/dist/core/extensions/types.d.ts`
  - Atualizar declaração usada pelo typecheck da extensão, caso o build do Pi não regenere dist durante a sessão.
- Modificar: `PiAgentUi/extensions/piagentui-server.ts`
  - Resolver arquivo da sessão por ID.
  - Enviar mensagem para sessão solicitada com `switchSession(..., { withSession })`.
  - Preservar servidor HTTP/SSE em `session_shutdown` causado por `resume` web-iniciado.
- Modificar: `PiAgentUi/extensions/piagentui-server.test.ts`
  - Cobrir envio para sessão ativa, envio para sessão diferente, sessão inexistente e switch cancelado.
- Modificar: `PiAgentUi/src/api/message.ts`
  - Garantir que erro HTTP de envio não seja engolido; `sendMessageAsync()` já envia `sessionId`.
- Modificar opcionalmente: `PiAgentUi/src/hooks/useChatSession.ts`
  - Se necessário, manter erro visível via `handleError('send message', error)` sem mudar UX.

---

## Tarefa 1: Expor switchSession no contexto normal da extensão Pi

**Arquivos:**
- Modificar: `../pi/packages/coding-agent/src/core/extensions/types.ts`
- Modificar: `../pi/packages/coding-agent/src/core/extensions/runner.ts`
- Modificar: `../pi/packages/coding-agent/dist/core/extensions/types.d.ts`

- [ ] **Passo 1: Atualizar o contrato TypeScript do `ExtensionContext`**

Em `../pi/packages/coding-agent/src/core/extensions/types.ts`, dentro de `export interface ExtensionContext`, adicionar logo após `compact(options?: CompactOptions): void;`:

```ts
	/**
	 * Switch to a different session file from long-lived extension services.
	 * Use `withSession` for work that must run after the replacement context is active.
	 */
	switchSession(
		sessionPath: string,
		options?: { withSession?: (ctx: ReplacedSessionContext) => Promise<void> },
	): Promise<{ cancelled: boolean }>;
```

- [ ] **Passo 2: Expor o método no contexto criado pelo runner**

Em `../pi/packages/coding-agent/src/core/extensions/runner.ts`, dentro de `createContext(): ExtensionContext`, adicionar antes de `getSystemPrompt: () => {`:

```ts
			switchSession: (sessionPath, options) => {
				runner.assertActive();
				return runner.switchSessionHandler(sessionPath, options);
			},
```

O trecho final deve ficar assim:

```ts
			compact: (options) => {
				runner.assertActive();
				runner.compactFn(options);
			},
			switchSession: (sessionPath, options) => {
				runner.assertActive();
				return runner.switchSessionHandler(sessionPath, options);
			},
			getSystemPrompt: () => {
				runner.assertActive();
				return runner.getSystemPromptFn();
			},
```

- [ ] **Passo 3: Atualizar a declaração dist se o build do Pi não for executado**

Em `../pi/packages/coding-agent/dist/core/extensions/types.d.ts`, adicionar assinatura equivalente dentro de `ExtensionContext`:

```ts
    /**
     * Switch to a different session file from long-lived extension services.
     * Use `withSession` for work that must run after the replacement context is active.
     */
    switchSession(sessionPath: string, options?: {
        withSession?: (ctx: ReplacedSessionContext) => Promise<void>;
    }): Promise<{
        cancelled: boolean;
    }>;
```

- [ ] **Passo 4: Verificar tipos do Pi core**

Executar:

```bash
cd D:/Documents/Github/PiAgentUI/pi/packages/coding-agent
pnpm test -- --runInBand test/suite/regressions/2860-replaced-session-context.test.ts
```

Se esse pacote não usa `pnpm test` com esse formato, executar o comando de teste já documentado no pacote. Resultado esperado: testes existentes passam sem erro de tipo. Se o comando correto não existir, registrar a saída e seguir para o typecheck do PiAgentUI na Tarefa 4.

---

## Tarefa 2: Roteamento de mensagem por sessão no servidor PiAgentUI

**Arquivos:**
- Modificar: `PiAgentUi/extensions/piagentui-server.ts`

- [ ] **Passo 1: Adicionar tipo local para contexto com switch**

Abaixo de `const MIME_TYPES`, adicionar:

```ts
type SwitchableExtensionContext = ExtensionContext & {
  switchSession?: (
    sessionPath: string,
    options?: { withSession?: (ctx: any) => Promise<void> },
  ) => Promise<{ cancelled: boolean }>
}
```

- [ ] **Passo 2: Trocar o tipo de `latestCtx`**

Substituir:

```ts
  let latestCtx: ExtensionContext | null = null
```

por:

```ts
  let latestCtx: SwitchableExtensionContext | null = null
```

- [ ] **Passo 3: Criar helper de arquivo de sessão**

Adicionar depois de `getCurrentSessionId()`:

```ts
  function getSessionFileForId(sessionId: string): string | null {
    const sessionDir = latestCtx?.sessionManager?.getSessionDir()
    if (!sessionDir || !fs.existsSync(sessionDir)) return null

    const files = fs.readdirSync(sessionDir).filter(f => f.endsWith('.jsonl'))
    const matchedFile = files.find(f => f.endsWith(`_${sessionId}.jsonl`))
    return matchedFile ? path.join(sessionDir, matchedFile) : null
  }
```

- [ ] **Passo 4: Extrair seleção de modelo para helper reutilizável**

Adicionar depois de `getSessionFileForId()`:

```ts
  async function setRequestedModel(ctx: SwitchableExtensionContext, model: any) {
    if (!model?.providerID || !model?.modelID) return

    try {
      const targetModel = ctx.modelRegistry?.find(model.providerID, model.modelID)
      if (!targetModel) return

      const currentModel = ctx.model
      if (!currentModel || currentModel.id !== targetModel.id || currentModel.provider !== targetModel.provider) {
        console.log(`[PiAgentUi] Switching session model to ${targetModel.provider}:${targetModel.id}`)
        await pi.setModel(targetModel)
      }
    } catch (err) {
      console.error('[PiAgentUi] Failed to set model:', err)
    }
  }
```

- [ ] **Passo 5: Adicionar flag para preservar servidor durante switch web-iniciado**

Perto dos estados do servidor, adicionar:

```ts
  let preserveServerForSessionSwitch = false
```

- [ ] **Passo 6: Criar helper de envio correto por sessão**

Adicionar depois de `setRequestedModel()`:

```ts
  async function sendUserMessageToRequestedSession(parsed: any): Promise<{ status: number; body: any }> {
    const requestedSessionId = parsed.sessionId
    const activeSessionId = getCurrentSessionId()

    if (!parsed.text) {
      return { status: 400, body: { error: 'Missing message text' } }
    }

    if (!requestedSessionId || requestedSessionId === activeSessionId) {
      if (latestCtx) {
        await setRequestedModel(latestCtx, parsed.model)
      }
      const p = pi.sendUserMessage(parsed.text) as any
      if (p && typeof p.catch === 'function') {
        p.catch((err: any) => {
          console.error('[PiAgentUi] Failed to send user message:', err)
        })
      }
      return { status: 202, body: { sessionID: activeSessionId } }
    }

    const sessionFile = getSessionFileForId(requestedSessionId)
    if (!sessionFile) {
      return { status: 404, body: { error: `Session not found: ${requestedSessionId}` } }
    }

    if (!latestCtx?.switchSession) {
      return { status: 501, body: { error: 'Pi session switching is not available in this runtime' } }
    }

    preserveServerForSessionSwitch = true
    try {
      const result = await latestCtx.switchSession(sessionFile, {
        withSession: async replacedCtx => {
          latestCtx = replacedCtx as SwitchableExtensionContext
          await setRequestedModel(latestCtx, parsed.model)
          await replacedCtx.sendUserMessage(parsed.text)
        },
      })

      if (result.cancelled) {
        return { status: 409, body: { error: 'Session switch cancelled' } }
      }

      return { status: 202, body: { sessionID: requestedSessionId } }
    } finally {
      preserveServerForSessionSwitch = false
    }
  }
```

- [ ] **Passo 7: Substituir lógica atual de `/api/messages/send`**

Dentro do handler `if (pathParts[1] === 'messages' && pathParts[2] === 'send' && method === 'POST')`, substituir o bloco que faz `setModel`, calcula `activeSessionId`, alerta divergência e chama `pi.sendUserMessage(parsed.text)` por:

```ts
            const result = await sendUserMessageToRequestedSession(parsed)
            res.writeHead(result.status, { 'Content-Type': 'application/json' })
            res.end(
              JSON.stringify({
                messageID: 'msg-' + Math.random().toString(36).substring(2) + '-' + Date.now(),
                ...result.body,
              }),
            )
```

O `catch` do `JSON.parse` permanece igual.

- [ ] **Passo 8: Preservar servidor em `session_shutdown` de switch interno**

Substituir:

```ts
  pi.on('session_shutdown', async () => {
    stopServer()
  })
```

por:

```ts
  pi.on('session_shutdown', async event => {
    if (preserveServerForSessionSwitch && event?.reason === 'resume') {
      return
    }
    stopServer()
  })
```

- [ ] **Passo 9: Verificar typecheck da extensão**

Executar:

```bash
cd D:/Documents/Github/PiAgentUI/PiAgentUi
npx tsc --noEmit -p tsconfig.extension.json
```

Resultado esperado: nenhum erro.

---

## Tarefa 3: Testes do servidor de extensão

**Arquivos:**
- Modificar: `PiAgentUi/extensions/piagentui-server.test.ts`

- [ ] **Passo 1: Adicionar sessão alternativa no teste existente**

Depois da criação de `sessionFile`, adicionar:

```ts
    const otherSessionId = 'test-session-uuid-other'
    const otherSessionFile = path.join(tempSessionDir, `session_${otherSessionId}.jsonl`)
    fs.writeFileSync(otherSessionFile, JSON.stringify({
      type: 'session',
      id: otherSessionId,
      timestamp: new Date().toISOString(),
      cwd: '/mock/cwd'
    }) + '\n')
```

- [ ] **Passo 2: Adicionar mocks de switch no contexto**

Antes de `const mockContext = {`, adicionar:

```ts
    const replacedSendUserMessage = vi.fn()
    const switchSession = vi.fn(async (_sessionPath: string, options?: { withSession?: (ctx: any) => Promise<void> }) => {
      await options?.withSession?.({
        ...mockContext,
        sessionManager: {
          getSessionDir: () => tempSessionDir,
          getSessionId: () => otherSessionId,
        },
        sendUserMessage: replacedSendUserMessage,
      })
      return { cancelled: false }
    })
```

Dentro de `mockContext`, adicionar:

```ts
      switchSession,
```

- [ ] **Passo 3: Testar envio para sessão ativa sem switch**

Manter o teste existente de `/api/messages/send` sem `sessionId` e ajustar expectativa para aceitar qualquer segundo argumento opcional:

```ts
    expect(mockPi.sendUserMessage).toHaveBeenCalledWith('hello world')
    expect(switchSession).not.toHaveBeenCalled()
```

- [ ] **Passo 4: Testar envio para sessão diferente com switch**

Depois do teste de envio ativo, adicionar:

```ts
    const sendOtherRes = await fetch(`${baseUrl}/api/messages/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionId: otherSessionId,
        text: 'hello other session',
        model: { providerID: 'google', modelID: 'gemini-2.5-pro' }
      })
    })
    expect(sendOtherRes.status).toBe(202)
    expect(switchSession).toHaveBeenCalledWith(otherSessionFile, expect.objectContaining({
      withSession: expect.any(Function),
    }))
    expect(replacedSendUserMessage).toHaveBeenCalledWith('hello other session')
```

- [ ] **Passo 5: Testar sessão inexistente**

Adicionar:

```ts
    const missingSessionRes = await fetch(`${baseUrl}/api/messages/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionId: 'missing-session-id',
        text: 'must not be sent',
        model: { providerID: 'google', modelID: 'gemini-2.5-pro' }
      })
    })
    expect(missingSessionRes.status).toBe(404)
    expect(replacedSendUserMessage).not.toHaveBeenCalledWith('must not be sent')
```

- [ ] **Passo 6: Rodar teste da extensão**

Executar:

```bash
cd D:/Documents/Github/PiAgentUI/PiAgentUi
npx vitest run extensions/piagentui-server.test.ts
```

Resultado esperado: teste passa. Se o teste monolítico ficar instável por porta/servidor, dividir em `describe` separado com porta limpa e `session_shutdown` no final.

---

## Tarefa 4: Garantir que erros de envio sejam visíveis no frontend

**Arquivos:**
- Modificar: `PiAgentUi/src/api/message.ts`
- Testar: `PiAgentUi/src/api/piClient.test.ts` ou criar caso em `PiAgentUi/src/api/message.test.ts`

- [ ] **Passo 1: Confirmar comportamento de `piClient.post`**

Ler `PiAgentUi/src/api/piClient.ts`. Se `piClient.post` já lança erro em status `>=400`, não alterar código. Se não lança, ajustar para lançar com status e body.

O comportamento esperado para `sendMessageAsync()` é:

```ts
export async function sendMessageAsync(params: SendMessageParams): Promise<void> {
  await piClient.post('/api/messages/send', {
    sessionId: params.sessionId,
    text: params.text,
    model: params.model,
    directory: params.directory,
  })
}
```

- [ ] **Passo 2: Adicionar teste de erro HTTP se necessário**

Se `piClient` não tiver cobertura de erro, adicionar teste que simula `fetch` retornando `404` para `/api/messages/send` e espera rejeição.

Código esperado do teste:

```ts
it('rejects sendMessageAsync when the server rejects the target session', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'Session not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  })))

  await expect(sendMessageAsync({
    sessionId: 'missing-session',
    text: 'hello',
    model: { providerID: 'google', modelID: 'gemini-2.5-pro' },
    directory: '/mock/cwd',
  })).rejects.toThrow()
})
```

- [ ] **Passo 3: Rodar testes de API relevantes**

Executar:

```bash
cd D:/Documents/Github/PiAgentUI/PiAgentUi
npx vitest run src/api/piClient.test.ts src/api/events.test.ts src/store/messageStore.test.ts
```

Resultado esperado: todos passam.

---

## Tarefa 5: Verificação integrada

**Arquivos:**
- Nenhum arquivo novo obrigatório.

- [ ] **Passo 1: Rodar typecheck completo do app**

```bash
cd D:/Documents/Github/PiAgentUI/PiAgentUi
npx tsc --noEmit
npx tsc --noEmit -p tsconfig.extension.json
```

Resultado esperado: ambos sem erro.

- [ ] **Passo 2: Rodar testes focados**

```bash
cd D:/Documents/Github/PiAgentUI/PiAgentUi
npx vitest run extensions/piagentui-server.test.ts src/api/events.test.ts src/store/messageStore.test.ts
```

Resultado esperado: todos passam.

- [ ] **Passo 3: Rodar build**

```bash
cd D:/Documents/Github/PiAgentUI/PiAgentUi
npm run build
```

Resultado esperado: build passa. Avisos de chunk grande do Vite são aceitáveis se não forem novos erros.

- [ ] **Passo 4: Verificação manual no navegador**

1. Reiniciar o Pi Agent para carregar a extensão atualizada.
2. Abrir PiAgentUI em `http://127.0.0.1:<porta>`.
3. Abrir sessão A e anotar o arquivo `.jsonl` dela.
4. Selecionar sessão B no sidebar.
5. Enviar mensagem `teste roteamento sessao B`.
6. Confirmar visualmente que user + assistant aparecem em B sem F5.
7. Confirmar que o arquivo `.jsonl` da sessão A não recebeu essa mensagem.
8. Confirmar que o arquivo `.jsonl` da sessão B recebeu essa mensagem.
9. Confirmar que `/global/event` continua com uma conexão viva e sem reconectar em loop.

- [ ] **Passo 5: Commit final**

```bash
cd D:/Documents/Github/PiAgentUI/PiAgentUi
git status --short
git add extensions/piagentui-server.ts extensions/piagentui-server.test.ts src/api/message.ts src/api/message.test.ts docs/superpowers/plans/2026-05-30-piagentui-active-session-switch.md
git commit -m "fix: route messages to selected Pi session"
```

Se a implementação modificar arquivos em `../pi`, fazer um commit separado dentro do repositório/árvore correspondente apenas se ele também for um repositório Git local. Como `D:/Documents/Github/PiAgentUI` não é repo e `PiAgentUi` é o repo local atual, registrar explicitamente os arquivos de Pi alterados no resumo final.

---

## Auto-revisão do plano

- Cobertura da spec: o plano cobre exposição de `switchSession`, roteamento backend, preservação do servidor, testes de erro e verificação manual.
- Placeholders: nenhum `TBD`, `TODO`, `implementar depois` ou instrução genérica sem ação concreta.
- Consistência de tipos: `SwitchableExtensionContext`, `switchSession`, `withSession`, `replacedCtx.sendUserMessage` e `sessionID` são usados consistentemente.
- Escopo: limitado ao sistema de sessão/roteamento; não redesenha UI nem lista de sessões.
