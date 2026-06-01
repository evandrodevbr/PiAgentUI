<p align="center">
  <img src="./src/assets/images/logo/PiAgentUiBlack%20%283%29.png" alt="Logo do PiAgentUI" width="760" />
</p>

# PiAgentUI

[English (US)](./README.md) | **Português (BR)** | [Español](./README.es.md) | [日本語](./README.ja.md)

PiAgentUI é uma interface moderna web e desktop para o **Pi Agent**. Ele não é apenas uma camada visual de chat: o objetivo é evoluir para um aplicativo completo de agentes, na mesma categoria de produto de Codex, Claude Desktop e outros ambientes agent-first para desenvolvimento.

O PiAgentUI trata o runtime real do Pi como fonte de verdade. Sessões, metadados de modelo, uso de contexto, tool calls, skills, configuração MCP e slash commands vêm do Pi sempre que possível, em vez de serem recriados como estado falso de interface.

> **Status do projeto:** desenvolvimento local ativo. Algumas áreas já estão próximas de produto, enquanto outras ainda mudam rapidamente.

## Demonstração do software

Estas capturas mostram a experiência atual do PiAgentUI: um workspace escuro e focado para agentes, com sessões reais do Pi, seleção de modelos, metadados MCP, settings, chat com ferramentas e painéis laterais.

![Workspace de chat do PiAgentUI com painel lateral MCP](./src/assets/images/img1.png)

![Diálogo de settings e conexões de servidor do PiAgentUI](./src/assets/images/img2.png)

![Seletor de modelos do PiAgentUI dentro de uma sessão ativa](./src/assets/images/img3.png)

## O que o PiAgentUI já faz hoje

- **Chat com streaming** — saída ao vivo via SSE, reconciliação estável de mensagens, markdown, code highlight, partes de reasoning e cards de ferramentas.
- **Sessões reais do Pi** — lista de sessões, roteamento para sessão ativa, histórico seguro após restart, títulos derivados e envio para a sessão selecionada.
- **Tool output em cards** — tool calls/results ficam anexados às mensagens do assistente, sem vazar como texto normal no chat.
- **Uso real de contexto** — o uso de contexto vem do runtime do Pi quando disponível; contexto desconhecido/compactado é exibido de forma segura em vez de `NaN`.
- **Metadados de modelos** — identidade de provider/modelo vem do Pi; o catálogo OpenRouter local é usado apenas como enriquecimento de detalhes.
- **Painel de Skills** — skills reais são lidas do prompt efetivo do Pi e agrupadas por origem: global, project, package e other.
- **Painel MCP** — lê servidores MCP configurados em arquivos locais/globais e mostra transporte, comando, URL, lifecycle, direct tools e origem.
- **Slash commands do Pi** — `/api/commands/list` expõe comandos built-in do Pi e comandos dinâmicos de extensões, prompts e skills.
- **Anexos multimodais** — suporte visual a arquivos/imagens/PDF/áudio/vídeo conforme as capacidades do modelo selecionado.
- **Terminal e arquivos** — terminal integrado, explorador de arquivos, syntax highlighting, componentes de diff e integração desktop via Tauri.
- **UI keyboard-first** — command palette, atalhos configuráveis, split panes, seletor de modelo, navegação por projeto/sessão e layouts responsivos.

## Direção do produto

O PiAgentUI está caminhando para virar um app completo de agentes:

1. **Ações visuais para todos os comandos do Pi** — slash commands continuam disponíveis, mas ações frequentes devem virar botões, menus, diálogos ou painéis.
2. **Entrada por voz e transcrição em tempo real** — gravação de microfone, deltas parciais, inserção da transcrição final no composer e configuração de provedores STT OpenAI-compatible.
3. **Integração MCP mais profunda** — além de metadados: conectar, autenticar, inspecionar ferramentas e executar workflows MCP pela UI.
4. **Controle completo de sessões** — fork, clone, navegação em árvore, import/export/share, branch summaries e gerenciamento de contexto como fluxos nativos.
5. **Experiência desktop completa** — app Tauri polido com descoberta local de runtime, settings seguros, notificações e controles ricos de workspace.

## Roadmap de áudio e transcrição

O PiAgentUI já aceita anexos de áudio quando o modelo selecionado declara suporte a áudio. O sistema planejado de voz adiciona speech-to-text ao vivo diretamente no composer.

Arquitetura recomendada:

- **Provedor realtime padrão:** OpenAI Realtime Transcription com `gpt-realtime-whisper` para transcrição parcial de baixa latência.
- **Fallback por arquivo:** OpenAI Audio Transcriptions com `gpt-4o-transcribe`, `gpt-4o-mini-transcribe` ou `whisper-1`.
- **Provedores customizados:** APIs STT OpenAI-compatible configuráveis pelo usuário, como provedores que implementam `POST /v1/audio/transcriptions`.

UX planejada:

- botão de microfone no composer;
- estados de gravação e permissão;
- overlay de transcrição parcial;
- texto final inserido no input;
- comportamento configurável de append/replace;
- auto-send desligado por padrão;
- tratamento recuperável para erros de permissão, rede e provedor.

Exemplo de configuração de provider:

```json
{
  "kind": "openai-compatible",
  "mode": "file",
  "baseUrl": "https://api.example.com/v1",
  "transcriptionEndpoint": "/audio/transcriptions",
  "transcriptionModel": "openai/whisper-large-v3",
  "language": "pt"
}
```

Suporte realtime é tratado como capability separada, porque compatibilidade HTTP com a OpenAI não garante compatibilidade WebSocket.

## Arquitetura

```text
PiAgentUI
├─ Frontend React/Vite
│  ├─ chat, renderização de mensagens, input, painéis e settings
│  ├─ stores locais para preferências de UI
│  └─ clientes SSE/API para endpoints locais do PiAgentUI
├─ Backend como extensão Pi
│  └─ extensions/piagentui-server.ts
│     ├─ expõe endpoints locais /api/*
│     ├─ faz ponte com runtime/sessões/modelos do Pi
│     ├─ transmite eventos do Pi para o browser
│     └─ lê metadados locais como MCP config e skills
└─ Runtime Pi Agent
   ├─ sessões
   ├─ modelos/providers
   ├─ ferramentas
   ├─ skills
   ├─ MCP
   └─ slash commands
```

A UI não deve inventar estado de runtime quando o Pi já sabe a resposta. O PiAgentUI pode cachear e enriquecer dados para UX, mas o Pi continua autoritativo para o comportamento do agente.

## Stack técnica

| Área                | Stack                                        |
| ------------------- | -------------------------------------------- |
| UI                  | React 19, TypeScript                         |
| Build               | Vite 8                                       |
| Estilo              | Tailwind CSS v4 e design tokens do projeto   |
| Desktop             | Tauri 2                                      |
| Markdown            | Streamdown / pipeline de markdown            |
| Syntax highlighting | Shiki                                        |
| Terminal            | xterm.js                                     |
| Testes              | Vitest, Testing Library                      |
| Backend local       | Extensão Pi, Node HTTP server, WebSocket/SSE |

## Desenvolvimento local

Instalar dependências:

```bash
npm install
```

Iniciar o frontend em modo dev:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Testes:

```bash
npm run test:run
```

Type checks:

```bash
npm run typecheck
npm run typecheck:extensions
```

Validação completa:

```bash
npm run validate
```

## Runtime da extensão Pi

O PiAgentUI é registrado como extensão Pi em `package.json`:

```json
{
  "pi": {
    "extensions": ["./extensions/piagentui-server.ts"]
  }
}
```

Quando a extensão inicia, ela escreve metadados de descoberta local em:

```text
~/.pi/agent/piagentui-port.json
```

O app web usa a porta/token desse arquivo para falar com o servidor local da extensão. Algumas mudanças de backend exigem reiniciar ou recarregar o processo da extensão Pi antes de aparecerem no browser.

## Endpoints locais importantes

| Endpoint                         | Finalidade                                            |
| -------------------------------- | ----------------------------------------------------- |
| `GET /api/models`                | Lista real de modelos Pi com capacidades normalizadas |
| `GET /api/sessions`              | Lista de sessões lida dos arquivos de sessão do Pi    |
| `GET /api/sessions/:id/messages` | Histórico normalizado para renderização na UI         |
| `GET /api/sessions/:id/context`  | Uso de contexto runtime para a sessão ativa           |
| `POST /api/messages/send`        | Envia mensagem para a sessão Pi solicitada            |
| `GET /api/skills`                | Skills efetivas do Pi agrupadas por origem            |
| `GET /api/mcp/status`            | Metadados dos servidores MCP configurados             |
| `GET /api/commands/list`         | Slash commands built-in e dinâmicos do Pi             |
| `GET /global/event`              | Stream SSE de eventos do backend PiAgentUI            |

## Princípios de desenvolvimento

- Preferir dados reais do runtime Pi em vez de estado fake só da UI.
- Manter OpenRouter como enriquecimento de catálogo, nunca como substituto da identidade provider/modelo do Pi.
- Tratar valores runtime desconhecidos explicitamente.
- Escrever testes antes de mudanças de comportamento sempre que possível.
- Manter tool results dentro dos cards de ferramenta.
- Seguir o sistema visual existente: tema, movimento, espaçamento e padrões de painéis.
- Separar claramente o que está implementado do que é roadmap.

## Notas do repositório

O projeto ainda contém nomes herdados da base original OpenCodeUI em alguns pontos, incluindo metadados do pacote e documentação antiga. A direção atual é PiAgentUI-first, e uma limpeza futura deve migrar esses nomes sem quebrar os workflows locais.

## Licença

Este repositório segue a licença declarada em `package.json`: `GPL-3.0-only`.
