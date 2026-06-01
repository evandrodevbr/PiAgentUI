# Spec — STT, acesso LAN/QR, sessões reais e histórico por projeto

**Data:** 2026-05-30  
**Status:** proposta técnica pronta para revisão do usuário antes de implementação  
**Produto:** PiAgentUI  
**Escopo:** implementar, com mudanças mínimas e TDD, quatro melhorias conectadas ao uso real do PiAgentUI:

1. sistema de áudio/STT no composer;
2. exposição controlada do PiAgentUI na rede local com IP e QR Code;
3. criação de novas sessões que realmente criam novos chats no Pi Agent;
4. histórico lateral agrupado por pastas/projetos, expansível e recolhível.

## Contexto observado no projeto

Arquitetura atual relevante:

- Backend local da UI fica em `extensions/piagentui-server.ts`.
- Núcleo de helpers seguros fica em `extensions/piagentui-server-core.ts`.
- O servidor HTTP atualmente faz bind em `127.0.0.1` e valida `Host`/`Origin` como loopback-only.
- `serveIndexHtml()` injeta `window.PI_BOOT_DATA` com `baseUrl: http://127.0.0.1:<port>` e bearer token local.
- O discovery local é salvo em `~/.pi/agent/piagentui-port.json` com `{ port, token }`.
- `POST /api/sessions` atualmente **não cria sessão real**: ele apenas retorna `getSessionInfo(getCurrentSessionId())`.
- `GET /api/sessions` lê arquivos `.jsonl` do diretório de sessões e deriva metadados via `readSessionMetadata()`.
- `readSessionMetadata()` já extrai `header.cwd`, título por `session_info` ou primeira mensagem de usuário, timestamps e contagem básica.
- `sendUserMessageToRequestedSession()` já consegue trocar rapidamente para uma sessão solicitada via `latestCtx.switchSession(sessionFile, { withSession })` e enviar mensagem nela.
- A UI de sessões está em `src/features/sessions/SessionList.tsx`.
- O estado de sessões vem de `src/contexts/SessionContext.tsx` e `src/api/session.ts`.
- O input/composer está em `src/features/chat/InputBox.tsx` e `src/features/chat/input/InputToolbar.tsx`.
- Já existem anexos multimodais, incluindo áudio como arquivo quando o modelo suporta.
- A store de servidores fica em `src/store/serverStore.ts` e já suporta múltiplos backends, bearer token, Basic Auth e health checks.

## Objetivos

### Objetivo 1 — STT no composer

Adicionar entrada por voz sem substituir o fluxo de texto:

- botão de microfone no composer;
- gravação de áudio pelo navegador/Tauri webview;
- transcrição por provider configurável;
- inserção do texto transcrito no input;
- fallback por arquivo via OpenAI-compatible `/audio/transcriptions`;
- arquitetura preparada para realtime OpenAI depois, sem bloquear o MVP.

### Objetivo 2 — acesso LAN com QR Code

Permitir que o usuário acesse o PiAgentUI por outro dispositivo na mesma rede local:

- manter acesso LAN **desligado por padrão**;
- quando ligado, mostrar IP local do computador, URL de acesso e QR Code;
- não remover autenticação existente;
- não expor sem aviso que o controle do agente fica disponível na rede local;
- manter loopback funcionando normalmente.

### Objetivo 3 — novas sessões reais no Pi Agent

Corrigir o comportamento de “novo chat”:

- `New chat` deve criar um novo arquivo de sessão Pi `.jsonl`;
- deve alternar rapidamente para essa sessão real;
- enviar a primeira mensagem nessa sessão deve persistir no novo arquivo, não apenas simular um chat novo na UI;
- o retorno de `POST /api/sessions` deve conter o id real, diretório real e metadata real.

### Objetivo 4 — histórico por pastas/projetos

Agrupar sessões no histórico lateral por projeto:

- cada pasta representa um `cwd`/diretório de projeto vindo do header da sessão;
- nome visual da pasta = basename do diretório, com fallback legível;
- pastas podem expandir/recolher;
- sessões ficam dentro da pasta do projeto;
- busca continua funcionando;
- seleção e drag/drop de sessão continuam funcionando;
- sem reorganizar o backend inteiro de sessões.

## Não objetivos

- Não implementar TTS/voz falada nesta fase.
- Não criar sistema multiusuário, login ou permissões finas.
- Não abrir o servidor LAN por padrão.
- Não publicar automaticamente a extensão.
- Não renomear todo o legado `opencode`/OpenCodeUI agora.
- Não refatorar `SessionList.tsx` inteiro além do necessário para agrupamento por projeto.
- Não alterar arquitetura de pane layout, terminal, file explorer ou MCP além dos pontos necessários.

## Decisões recomendadas

### A. STT em duas fases, mas com base única

**Recomendado:** implementar primeiro `file transcription`, com tipos e UI já preparados para `realtime`.

Motivo:

- é mais rápido e testável;
- funciona com OpenAI e provedores OpenAI-compatible;
- evita acoplar a primeira entrega a WebSocket realtime;
- mantém o caminho aberto para `gpt-realtime-whisper`.

Configuração inicial:

```ts
export type SttMode = 'file' | 'realtime'
export type SttProviderKind = 'openai' | 'openai-compatible'

export interface SttSettings {
  enabled: boolean
  providerKind: SttProviderKind
  mode: SttMode
  baseUrl: string
  apiKeyConfigured: boolean
  transcriptionEndpoint: string
  transcriptionModel: string
  language?: string
  insertMode: 'append' | 'replace'
}
```

O segredo real da API key não deve ser retornado ao frontend depois de salvo. A UI recebe apenas `apiKeyConfigured: true/false`.

### B. Settings STT server-side local

**Recomendado:** salvar configuração STT em arquivo local do usuário:

```text
~/.pi/agent/piagentui-settings.json
```

Estrutura mínima:

```json
{
  "stt": {
    "enabled": true,
    "providerKind": "openai-compatible",
    "mode": "file",
    "baseUrl": "https://api.openai.com/v1",
    "apiKey": "...",
    "transcriptionEndpoint": "/audio/transcriptions",
    "transcriptionModel": "gpt-4o-mini-transcribe",
    "language": "pt",
    "insertMode": "append"
  },
  "network": {
    "lanAccessEnabled": false
  }
}
```

Motivo:

- evita persistir API key no localStorage do browser;
- permite LAN sem expor secrets no `window.PI_BOOT_DATA`;
- mantém tudo local e simples;
- evita banco de dados ou integração de credenciais complexa.

### C. LAN por bind amplo + validação dinâmica

**Recomendado:** o servidor pode escutar em `0.0.0.0`, mas responder a clientes não-loopback apenas quando `network.lanAccessEnabled === true`.

Mudanças necessárias:

- `listenOnAvailablePort(server, DEFAULT_PORT, '0.0.0.0')`;
- substituir validação loopback-only por função configurável:
  - loopback sempre permitido;
  - LAN permitido apenas se `lanAccessEnabled`;
  - `Origin` deve bater com host loopback ou LAN permitido;
- `serveIndexHtml(req, res)` deve montar `baseUrl` a partir de `req.headers.host`, não sempre `127.0.0.1`;
- endpoint `GET /api/network/access` retorna estado, IPs e URLs;
- endpoint `POST /api/network/access` liga/desliga LAN.

Acesso LAN expõe controle do agente para quem estiver na rede e conseguir acessar a URL. A UI deve mostrar warning explícito.

### D. QR Code no frontend

**Recomendado:** gerar o QR Code no frontend a partir da URL LAN ativa.

Opções:

1. usar dependência pequena `qrcode`;
2. implementar QR manualmente;
3. usar serviço externo.

Decisão: usar `qrcode` se não houver lib existente. É a solução mais simples, testável e offline. Evitar serviço externo por privacidade.

### E. Criar sessão real sem mexer no core do Pi

O contexto regular da extensão tem `switchSession`, mas `newSession()` fica restrito ao command context do Pi. Para não mexer no core do Pi agora, o backend do PiAgentUI pode criar o arquivo `.jsonl` compatível com `SessionManager.newSession()` e depois chamar `latestCtx.switchSession(newSessionFile, { withSession })`.

Header da sessão compatível:

```json
{
  "type": "session",
  "version": 3,
  "id": "<novo-id>",
  "timestamp": "<iso-date>",
  "cwd": "<diretorio-do-projeto>",
  "parentSession": "<opcional>"
}
```

Fluxo:

1. receber `POST /api/sessions` com `{ directory?, title?, parentID? }`;
2. resolver `cwd = directory || latestCtx.cwd || process.cwd()`;
3. gerar id válido e filename com timestamp;
4. escrever arquivo `.jsonl` com header;
5. se `title` existir, opcionalmente adicionar entry `session_info` compatível com o parser atual;
6. trocar rapidamente para o novo arquivo com `latestCtx.switchSession()`;
7. atualizar `latestCtx` no `withSession`;
8. retornar metadata real lida de `readSessionMetadata()`.

Se `switchSession` não estiver disponível, retornar `501` em vez de fingir sucesso.

### F. Histórico por projeto no frontend

**Recomendado:** agrupar no frontend usando `session.directory` já retornado pelo backend.

Criar helper puro:

```text
src/features/sessions/sessionProjectGroups.ts
```

Responsabilidades:

- normalizar paths Windows/Linux;
- extrair nome do projeto pelo basename;
- criar chave estável por diretório normalizado;
- ordenar grupos por `max(session.time.updated)` desc;
- ordenar sessões dentro do grupo por `time.updated` desc;
- manter busca como modo flat ou grupos filtrados.

A UI pode adicionar modo `groupedByProject?: boolean` em `SessionList`, preservando o agrupamento temporal antigo se necessário.

Estado de expansão:

- store local leve em `localStorage`, por exemplo `piagentui-session-project-folders`;
- padrão: pasta do projeto atual expandida; demais recolhidas;
- se busca ativa, expandir todos os grupos com match.

## Endpoints propostos

### STT

#### `GET /api/settings/stt`

Retorna settings redigidos:

```json
{
  "enabled": true,
  "providerKind": "openai-compatible",
  "mode": "file",
  "baseUrl": "https://api.openai.com/v1",
  "apiKeyConfigured": true,
  "transcriptionEndpoint": "/audio/transcriptions",
  "transcriptionModel": "gpt-4o-mini-transcribe",
  "language": "pt",
  "insertMode": "append"
}
```

#### `POST /api/settings/stt`

Atualiza settings. Se `apiKey` vier vazia/ausente, mantém chave anterior; se vier `null`, remove.

#### `POST /api/stt/transcriptions`

Recebe áudio como `multipart/form-data`, chama provider configurado e retorna:

```json
{
  "text": "texto transcrito",
  "durationMs": 1234,
  "provider": "openai-compatible",
  "model": "gpt-4o-mini-transcribe"
}
```

### LAN/QR

#### `GET /api/network/access`

```json
{
  "lanAccessEnabled": false,
  "port": 58785,
  "localUrl": "http://127.0.0.1:58785",
  "lanUrls": ["http://192.168.0.10:58785"],
  "primaryLanUrl": "http://192.168.0.10:58785"
}
```

#### `POST /api/network/access`

```json
{ "lanAccessEnabled": true }
```

Retorna o mesmo shape do `GET`.

### Sessões

#### `POST /api/sessions`

Novo comportamento: cria sessão real.

Body:

```json
{
  "directory": "D:/Documents/Github/PiAgentUI/PiAgentUi",
  "title": "Nova conversa",
  "parentID": "opcional"
}
```

Response:

```json
{
  "id": "019...",
  "title": "Nova conversa",
  "directory": "D:/Documents/Github/PiAgentUI/PiAgentUi",
  "time": { "created": 123, "updated": 123 },
  "status": { "type": "idle" },
  "summary": { "deletions": 0, "files": 0, "additions": 0 }
}
```

## Componentes/frontend propostos

### STT

Criar:

- `src/api/stt.ts` — chamadas de settings e transcrição;
- `src/types/api/stt.ts` — tipos de settings/resposta;
- `src/hooks/useVoiceTranscription.ts` — MediaRecorder, estados e envio para backend;
- `src/features/chat/input/VoiceInputButton.tsx` — botão mic/stop/loading/error;
- alterações pontuais em `InputBox.tsx` e `InputToolbar.tsx` para inserir texto transcrito.

Estados mínimos:

```ts
type VoiceState =
  | 'idle'
  | 'requesting-permission'
  | 'recording'
  | 'transcribing'
  | 'error'
```

### LAN/QR

Criar:

- `src/api/network.ts`;
- `src/types/api/network.ts`;
- `src/features/settings/components/NetworkAccessSettings.tsx` ou adicionar seção pequena em `ServersSettings.tsx`;
- QR gerado a partir de `primaryLanUrl`.

Como o app já tem `ServersSettings.tsx`, a mudança mínima é adicionar uma seção “Local network access” dentro dele, sem criar novo painel de settings se não for necessário.

### Sessões por projeto

Criar:

- `src/features/sessions/sessionProjectGroups.ts`;
- testes unitários para grouping;
- alterar `SessionList.tsx` para renderizar project folders quando `groupedByProject` estiver ativo;
- adicionar traduções apenas nos namespaces já usados (`chat`/`commands`/`common`) conforme necessário.

## Segurança

- LAN fica desligado por padrão.
- Loopback continua sempre permitido.
- API continua exigindo bearer token.
- O HTML servido injeta o token apenas para o cliente que abriu a UI; isso significa que qualquer pessoa com acesso à URL LAN durante LAN enabled pode controlar o agente. A UI deve deixar isso claro.
- STT API key não deve aparecer em resposta de settings.
- Não logar API key.
- Não aceitar `baseUrl` sem `http:` ou `https:`.
- Limitar upload STT por tamanho. Sugestão inicial: 25 MB.
- Reusar `isRequestBodySizeAllowed` ou criar limite específico para multipart.
- Não permitir path traversal ou file reads novos.

## Plano de testes obrigatório

### Backend extension

Arquivo: `extensions/piagentui-server.test.ts`

Casos:

1. `POST /api/sessions` cria arquivo `.jsonl` com header `type=session`, `version=3`, `cwd` correto e id novo.
2. `POST /api/sessions` chama `switchSession()` com `withSession` e retorna metadata da sessão nova.
3. `POST /api/sessions` retorna `501` quando `switchSession` indisponível, sem fingir sucesso.
4. `GET /api/network/access` retorna loopback URL e lista de IPs LAN mockável.
5. LAN disabled rejeita host não-loopback.
6. LAN enabled aceita host LAN com bearer token.
7. `serveIndexHtml()` injeta `baseUrl` baseado no host da request.
8. `GET /api/settings/stt` redige `apiKey`.
9. `POST /api/settings/stt` salva settings e preserva/remover chave conforme contrato.
10. `POST /api/stt/transcriptions` valida provider config e trata erro do provider sem vazar segredo.

Arquivo: `extensions/piagentui-server-core.test.ts`

Casos:

1. `isLoopbackHost()` preserva comportamento atual.
2. nova validação aceita LAN apenas quando enabled.
3. `getLocalNetworkUrls()` ignora loopback, IPv6 local problemático e interfaces internas inválidas.
4. validação de URL STT recusa protocolos não HTTP(S).

### Frontend API/hooks

Arquivos novos:

- `src/api/stt.test.ts`;
- `src/api/network.test.ts`;
- `src/hooks/useVoiceTranscription.test.tsx`;
- `src/features/sessions/sessionProjectGroups.test.ts`.

Casos:

1. API STT envia/recebe shape correto.
2. API network chama endpoints corretos.
3. hook de voz passa por `idle -> recording -> transcribing -> idle` e chama callback com texto final.
4. hook trata permissão negada.
5. grouping por projeto cria pastas corretas para paths Windows e POSIX.
6. grouping ordena pastas por sessão mais recente.
7. grouping mantém sessões ordenadas por update.

### Componentes

Arquivos prováveis:

- `src/features/chat/input/VoiceInputButton.test.tsx`;
- `src/features/settings/components/ServersSettings.test.tsx` ou novo test de `NetworkAccessSettings`;
- `src/features/sessions/SessionList.test.tsx`.

Casos:

1. botão de microfone mostra estados e dispara start/stop.
2. seção LAN mostra URL e QR quando enabled.
3. SessionList renderiza pastas por projeto, expande/recolhe e preserva seleção.

## Ordem de implementação recomendada

1. **Sessões reais primeiro** — corrige fundação crítica de chat.
2. **Agrupamento por projeto** — depende de sessões reais/metadata confiável.
3. **LAN/QR** — isolado, mas tem implicações de segurança.
4. **STT file transcription** — maior superfície; deve entrar depois da base de rede/sessão estar sólida.
5. **Realtime STT** — fase seguinte, usando o contrato já criado.

## Critérios de aceite

### Sessões reais

- Clicar em New chat cria um novo arquivo `.jsonl` de sessão Pi.
- O id retornado pelo backend é diferente da sessão anterior.
- Enviar mensagem após criar novo chat persiste nessa nova sessão.
- Troca de sessão continua rápida e não perde SSE.

### Histórico por projeto

- Sidebar mostra pastas por projeto.
- Cada pasta contém sessões daquele `cwd`.
- Expand/recolher funciona.
- Busca ainda localiza sessões.
- Selecionar sessão dentro da pasta navega para o chat correto.

### LAN/QR

- Com LAN off, acesso por IP LAN recebe 403.
- Com LAN on, URL LAN abre a UI em outro dispositivo da rede.
- QR Code aponta para a URL LAN ativa.
- API continua exigindo token.
- UI mostra aviso de segurança.

### STT

- Usuário consegue gravar áudio e transcrever para texto.
- Texto final entra no composer sem auto-send.
- Provider OpenAI-compatible é configurável.
- API key não aparece em respostas/logs.
- Erros de permissão/rede/provider são visíveis e recuperáveis.

## Riscos e mitigação

| Risco | Mitigação |
| --- | --- |
| LAN expõe controle total do agente | default off, warning explícito, bearer obrigatório, permitir desligar rápido |
| Criar sessão manualmente diverge do Pi core | usar header exatamente compatível com `SessionManager.newSession()`; testes contra parser atual |
| `switchSession` indisponível em runtime antigo | retornar `501`, não simular sucesso |
| QR exige dependência nova | usar `qrcode` pequena e isolada; se rejeitado, renderizar URL primeiro e QR depois |
| STT com CORS se chamado direto do frontend | chamadas a providers sempre pelo backend local |
| API key em LAN | armazenar server-side local, responder apenas `apiKeyConfigured` |
| `SessionList.tsx` já é grande | extrair grouping puro para arquivo separado; modificar renderização o mínimo possível |

## Arquivos previstos

### Criar

- `src/api/stt.ts`
- `src/api/stt.test.ts`
- `src/types/api/stt.ts`
- `src/api/network.ts`
- `src/api/network.test.ts`
- `src/types/api/network.ts`
- `src/hooks/useVoiceTranscription.ts`
- `src/hooks/useVoiceTranscription.test.tsx`
- `src/features/chat/input/VoiceInputButton.tsx`
- `src/features/chat/input/VoiceInputButton.test.tsx`
- `src/features/sessions/sessionProjectGroups.ts`
- `src/features/sessions/sessionProjectGroups.test.ts`

### Modificar

- `extensions/piagentui-server.ts`
- `extensions/piagentui-server.test.ts`
- `extensions/piagentui-server-core.ts`
- `extensions/piagentui-server-core.test.ts`
- `src/features/chat/InputBox.tsx`
- `src/features/chat/input/InputToolbar.tsx`
- `src/features/sessions/SessionList.tsx`
- `src/features/sessions/SessionList.test.tsx`
- `src/features/settings/components/ServersSettings.tsx`
- `src/store/serverStore.ts` apenas se necessário para refletir LAN URL ativa
- `src/locales/en/*.json` e `src/locales/zh-CN/*.json` para labels mínimos
- `package.json` se a dependência `qrcode` for adotada

## Abordagens consideradas

### Abordagem 1 — implementar tudo no frontend

Rejeitada. STT direto do browser expõe API keys, sofre com CORS e não combina com LAN.

### Abordagem 2 — mexer no core do Pi para expor `newSession` ao extension context

Possível, mas maior. Já fizemos patch de `switchSession`; para este pacote o objetivo é mudança mínima no PiAgentUI. Só considerar se criação manual de sessão se mostrar incompatível.

### Abordagem 3 — backend PiAgentUI como orquestrador local

Recomendada. Mantém mudanças dentro do PiAgentUI, usa `switchSession` já disponível, preserva segurança local e permite testes focados.

## Gate de implementação

Esta spec cobre múltiplos subsistemas e altera segurança/rede/sessão. A implementação deve começar somente após aprovação explícita do usuário sobre este design.

Após aprovação, criar plano em:

```text
docs/superpowers/plans/2026-05-30-piagentui-stt-lan-real-sessions-project-folders.md
```

O plano deve usar TDD e commits pequenos por feature:

1. sessões reais;
2. agrupamento por projeto;
3. LAN/QR;
4. STT settings + file transcription;
5. voice UI;
6. validação final e revisão de código.
