# Design — README atual do PiAgentUI e sistema de áudio/STT

**Data:** 2026-05-30  
**Status:** aprovado conceitualmente pelo usuário; aguardando revisão do arquivo antes da implementação  
**Escopo:** reescrever o `README.md` do projeto atual e preparar a arquitetura completa para envio de áudio e transcrição em tempo real no app.

## Contexto

O projeto começou como uma adaptação do OpenCodeUI, mas atualmente está evoluindo para o **PiAgentUI**: uma interface web/desktop para o Pi Agent, com ambição explícita de se tornar um app inteiro no estilo Codex ou Claude Desktop.

O estado atual já inclui:

- frontend React 19 + TypeScript + Vite;
- app desktop via Tauri 2;
- extensão Pi local em `extensions/piagentui-server.ts` como backend/runtime bridge;
- chat com streaming/SSE;
- sessões reais do Pi, histórico e roteamento de sessão;
- tool calls e tool results renderizados em cards;
- contexto real do runtime via endpoint `/api/sessions/:sessionId/context`;
- enriquecimento de metadados de modelo via catálogo OpenRouter local em `src/assets/models.json`;
- lista real de Skills agrupadas por origem;
- metadados reais de MCP configurado;
- slash commands reais do Pi expostos por `/api/commands/list`;
- anexos de arquivos, incluindo áudio como arquivo quando o modelo selecionado declara suporte a áudio.

Ainda não existe:

- gravação de microfone no composer;
- transcrição parcial em tempo real;
- endpoint backend para STT;
- configurações STT;
- provedor STT customizável OpenAI-compatible;
- pipeline de áudio integrado ao envio de mensagens.

## Objetivos

1. Reescrever `README.md` em português para refletir o produto atual, não o projeto original OpenCodeUI.
2. Apresentar PiAgentUI como interface moderna para o Pi Agent e base futura de app completo tipo Codex/Claude.
3. Documentar capacidades existentes de forma honesta, separando **implementado**, **em andamento** e **roadmap**.
4. Projetar um sistema de áudio/STT completo, com opção padrão forte e configuração externa flexível.
5. Implementar o sistema em fases testáveis, com TDD para lógica, API, stores e componentes.

## Não objetivos

- Não renomear pacote npm, bundle, app Tauri ou metadados de release nesta primeira etapa, salvo menção no README como débito de branding.
- Não implementar agente de voz falante/TTS nesta fase; o foco é entrada por voz e transcrição para texto.
- Não substituir o fluxo normal de texto; áudio será uma camada opcional sobre o composer.
- Não acoplar PiAgentUI ao OpenRouter para STT. OpenRouter continua sendo catálogo/metadados quando útil; STT usa provedores próprios.

## README.md proposto

O novo README deve ser escrito em português e deve substituir integralmente o conteúdo herdado. Estrutura recomendada:

1. **Título e tagline**
   - `# PiAgentUI`
   - “Interface web/desktop para Pi Agent — caminhando para um app completo estilo Codex/Claude.”

2. **Visão geral**
   - Explicar que o PiAgentUI é uma UI local para operar o Pi Agent com sessões, ferramentas, MCP, Skills, comandos e contexto real.
   - Deixar claro que o runtime Pi é a fonte de verdade.

3. **Estado atual**
   - Listar capacidades implementadas:
     - chat streaming;
     - sessões reais;
     - tool cards;
     - context usage;
     - models metadata;
     - skills;
     - MCP metadata;
     - slash commands;
     - anexos multimodais;
     - terminal/file explorer/Tauri quando aplicável.

4. **Roadmap do produto**
   - Ações visuais para comandos Pi;
   - áudio/STT em tempo real;
   - experiência voice-first;
   - MCP actions/connect/auth;
   - app completo tipo Codex/Claude.

5. **Arquitetura**
   - Frontend React/Vite/Tauri;
   - extensão Pi como bridge local;
   - Pi runtime como estado autoritativo;
   - APIs locais `/api/*`;
   - SSE para eventos.

6. **Desenvolvimento local**
   - `npm install`;
   - `npm run dev`;
   - `npm run build`;
   - `npm run test:run`;
   - `npm run typecheck`;
   - `npm run typecheck:extensions`.

7. **Notas de runtime**
   - Algumas mudanças exigem reiniciar/recarregar o Pi/extension server.
   - O arquivo de descoberta local fica em `~/.pi/agent/piagentui-port.json`.

8. **Áudio e transcrição — planejado**
   - Resumir o plano STT sem prometer que já está implementado.

9. **Licença e origem**
   - Manter licença atual se aplicável.
   - Mencionar que o projeto deriva de uma base OpenCodeUI, mas agora segue direção própria para PiAgentUI.

## Sistema de áudio/STT — abordagem recomendada

### Opção padrão

Usar **OpenAI Realtime Transcription** com `gpt-realtime-whisper` como padrão para transcrição ao vivo.

Razões:

- foi projetado para live speech-to-text;
- entrega deltas parciais;
- tem latência baixa;
- usa sessão dedicada de transcrição, sem resposta falada do modelo;
- combina com um composer por voz onde o texto aparece enquanto o usuário fala.

### Fallback padrão

Usar **OpenAI Audio Transcriptions** para áudio fechado/arquivo:

- `gpt-4o-transcribe` como opção de maior qualidade;
- `gpt-4o-mini-transcribe` como opção de menor custo;
- `whisper-1` para compatibilidade com integrações antigas.

Esse fallback deve ser usado quando:

- o navegador/ambiente não suportar streaming confiável;
- o usuário enviar um arquivo de áudio;
- o provedor configurado só oferecer endpoint `/audio/transcriptions`;
- a conexão realtime falhar e houver áudio gravado em buffer.

### Provedor OpenAI-compatible externo

O usuário deve poder configurar qualquer API compatível com o endpoint de transcrição da OpenAI.

Configuração proposta:

```ts
interface SttProviderConfig {
  id: string
  label: string
  kind: 'openai' | 'openai-compatible'
  mode: 'realtime' | 'file' | 'both'
  baseUrl: string
  apiKey: string
  realtimeModel?: string
  transcriptionModel: string
  transcriptionEndpoint?: string
  language?: string
  prompt?: string
  responseFormat?: 'json' | 'text' | 'verbose_json'
}
```

Exemplo para Together AI:

```json
{
  "kind": "openai-compatible",
  "mode": "file",
  "baseUrl": "https://api.together.xyz/v1",
  "transcriptionEndpoint": "/audio/transcriptions",
  "transcriptionModel": "openai/whisper-large-v3"
}
```

Observação: APIs “OpenAI-compatible” costumam ser compatíveis no endpoint HTTP de arquivo, mas realtime/WebSocket varia por provedor. Por isso, realtime deve ser capability separada, não assumida automaticamente.

## Arquitetura proposta do STT

### Frontend

Criar uma feature dedicada:

- `src/features/voice/VoiceRecorderButton.tsx`
- `src/features/voice/VoiceTranscriptOverlay.tsx`
- `src/features/voice/useVoiceRecorder.ts`
- `src/features/voice/useRealtimeTranscript.ts`
- `src/features/voice/audioEncoding.ts`

Responsabilidades:

- pedir permissão de microfone;
- mostrar estados: idle, requesting_permission, recording, connecting, transcribing, error;
- capturar áudio;
- enviar chunks para o backend;
- renderizar transcrição parcial e final;
- inserir texto final no composer;
- opcionalmente enviar automaticamente após confirmação do usuário.

### Store/configuração

Criar configuração local de STT:

- `src/store/sttSettingsStore.ts`
- persistência em localStorage inicialmente;
- campos para provider padrão, base URL, modelo, idioma, prompt, modo e preferências de UX.

Preferências de UX:

```ts
interface VoiceInputPreferences {
  insertMode: 'append' | 'replace-selection'
  autoSend: boolean
  showPartialTranscript: boolean
  pushToComposerWhileSpeaking: boolean
  silenceAutoStopMs: number
}
```

### API frontend

Criar cliente dedicado:

- `src/api/stt.ts`

Endpoints planejados:

- `GET /api/stt/config/schema`
- `POST /api/stt/transcriptions`
- `POST /api/stt/realtime/session`
- `POST /api/stt/realtime/:sessionId/chunk`
- `POST /api/stt/realtime/:sessionId/commit`
- `DELETE /api/stt/realtime/:sessionId`

### Backend/extensão Pi

Adicionar ao `extensions/piagentui-server.ts` ou extrair para módulo dedicado se o arquivo ficar grande:

- parser seguro de multipart/audio para transcrição por arquivo;
- proxy para `/v1/audio/transcriptions`;
- gerenciador de sessão realtime;
- normalização de eventos para o frontend.

Formato de eventos para o frontend:

```ts
type SttEvent =
  | { type: 'stt.session.started'; sessionId: string }
  | { type: 'stt.transcript.delta'; sessionId: string; text: string; itemId?: string }
  | { type: 'stt.transcript.completed'; sessionId: string; text: string; itemId?: string }
  | { type: 'stt.error'; sessionId?: string; message: string; recoverable: boolean }
  | { type: 'stt.session.closed'; sessionId: string }
```

### Segurança

- API keys não devem aparecer em logs.
- Configurações secretas devem ser mascaradas na UI.
- O backend deve limitar tamanho/duração de áudio.
- O backend deve validar `baseUrl` e impedir esquemas não HTTP(S).
- Erros do provedor devem ser normalizados, sem vazar headers.
- O usuário deve confirmar antes de habilitar auto-send de transcrição.

### Testes

Seguir TDD:

1. `src/api/stt.test.ts`
   - monta payloads corretos;
   - trata deltas/finais;
   - mascara erros.

2. `src/store/sttSettingsStore.test.ts`
   - defaults;
   - persistência;
   - atualização parcial;
   - remoção de secret.

3. `src/features/voice/*.test.tsx`
   - estados do botão;
   - permissão negada;
   - parcial/final no composer;
   - auto-send desligado por padrão.

4. `extensions/piagentui-server.test.ts`
   - endpoints STT;
   - validação de config;
   - proxy OpenAI-compatible;
   - realtime session lifecycle com mocks.

## Plano de implementação recomendado

1. Atualizar `README.md` com foco PiAgentUI atual.
2. Adicionar uma seção curta no README para STT planejado.
3. Criar plano TDD específico para STT antes de escrever produção.
4. Implementar configuração STT.
5. Implementar transcrição por arquivo OpenAI-compatible.
6. Implementar botão de gravação e inserção no composer.
7. Implementar realtime OpenAI como provider padrão.
8. Adicionar fallback de arquivo para provedores sem realtime.
9. Fazer verificação manual no browser/Tauri.

## Critérios de aceite

### README

- Não deve mais vender o projeto como OpenCodeUI.
- Deve explicar claramente que o projeto atual é PiAgentUI.
- Deve listar funcionalidades reais já implementadas.
- Deve separar roadmap de funcionalidades existentes.
- Deve incluir comandos de desenvolvimento corretos.

### STT

- Usuário consegue configurar provider padrão OpenAI.
- Usuário consegue configurar provider externo OpenAI-compatible para `/audio/transcriptions`.
- Usuário consegue gravar áudio pelo microfone.
- Usuário vê transcrição parcial quando o provider realtime suporta.
- Usuário recebe texto final no composer.
- Auto-send fica desligado por padrão.
- Falhas de permissão, rede e provider são visíveis e recuperáveis.
- Testes cobrem API, store e UI principal.

## Fontes consultadas

- OpenAI Realtime transcription: https://developers.openai.com/api/docs/guides/realtime-transcription
- OpenAI GPT-4o Transcribe: https://developers.openai.com/api/docs/models/gpt-4o-transcribe
- OpenAI speech transcription methods cookbook: https://developers.openai.com/cookbook/examples/speech_transcription_methods
- Together AI transcription docs: https://docs.together.ai/docs/inference/transcription/overview
- Together AI Whisper Large v3: https://www.together.ai/models/openai-whisper-large-v3
