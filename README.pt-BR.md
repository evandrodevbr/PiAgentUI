<p align="center">
  <img src="./src/assets/images/logo/PiAgentUiBlack%20%283%29.png" alt="Logo do PiAgentUI" width="760" />
</p>

# PiAgentUI

**Workspace desktop e web para agentes de código: sessões reais do Pi Agent, chat com streaming, painéis de MCP e skills, terminal, explorador de arquivos e app desktop em Tauri.**

![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white)
![Node](https://img.shields.io/badge/Node-%3E%3D22-5FA04E?logo=nodedotjs&logoColor=white)
![Licença](https://img.shields.io/badge/license-GPL--3.0--only-green)
[![Build Validation](https://github.com/evandrodevbr/PiAgentUI/actions/workflows/build.yml/badge.svg)](https://github.com/evandrodevbr/PiAgentUI/actions/workflows/build.yml)

[English (US)](./README.md) | **Português (BR)** | [Español](./README.es.md) | [日本語](./README.ja.md)

## Sobre

PiAgentUI é uma interface de chat e um workspace para o runtime do Pi Agent. No lugar de um terminal cru, ele reúne sessões, troca de modelo, tool calls em cards, metadados de servidores MCP, skills agrupadas por origem, slash commands, controles de Git, terminal e explorador de arquivos, como aplicação web ou como app desktop Tauri.

O projeto é Pi-first: sessões, modelos, uso de contexto, tool calls, skills, configuração MCP e slash commands vêm do runtime do Pi sempre que possível. A UI cacheia e enriquece esses dados para apresentação, mas não inventa estado do agente. É um fork e uma reescrita da base OpenCodeUI, e parte dessa herança ainda aparece (veja [Estado atual e limitações](#estado-atual-e-limitações)).

## Como funciona

```text
  janela do navegador / webview Tauri
            |
            |  HTTP /api/*   +   SSE /global/event   +   WebSocket
            v
  Servidor da extensão Pi  (extensions/piagentui-server.ts, Node http + ws)
    |-- serve o build da UI a partir de dist/ e injeta window.PI_BOOT_DATA {baseUrl, token}
    |-- grava os dados de conexão em ~/.pi/agent/piagentui-port.json {port, token}
    |-- exige bearer token em /api/* e restringe o acesso ao loopback por padrão
    |-- faz a ponte para sessões, modelos, ferramentas, MCP, skills e comandos
            ^
            |  carregado pelo runtime
        Processo do Pi Agent
```

- Ao iniciar uma sessão, a extensão escuta na porta `58785` (ou na próxima livre) e publica a porta escolhida e um token aleatório no arquivo de descoberta.
- `GET /global/health` é aberto; todas as outras rotas `/api/*` exigem `Authorization: Bearer <token>`.
- O app Tauri lê o mesmo arquivo de descoberta pelo comando Rust `get_pi_agent_connection`, então o build desktop se conecta ao runtime local sem configuração manual.
- `npm run dev` (Vite) serve apenas o front end em desenvolvimento; ele faz proxy de `/api` para `127.0.0.1:4096` removendo o prefixo `/api`. Aponte para um servidor compatível ou use o build servido pela extensão para o fluxo Pi.

## Stack

| Área | Escolha |
|---|---|
| UI | React 19, TypeScript 5.9 |
| Build | Vite 8 (rolldown), com `tsc -b` como gate de tipos |
| Estilo | Tailwind CSS 4 e design tokens do projeto |
| Desktop e mobile | Tauri 2 (Rust 1.85+), alvos Android gerados em `src-tauri/gen` |
| Markdown e código | Streamdown, Shiki, KaTeX |
| Terminal | xterm.js |
| i18n | i18next, locales `en`, `pt-BR`, `es`, `ja`, `zh-CN`, `hi`, `bn`, `ar` |
| Testes | Vitest 4, Testing Library, jsdom |
| Backend local | Extensão Pi: servidor HTTP Node com `ws` (SSE e WebSocket) |
| Gateway (containers) | Roteador Rust (`src-router`, axum) na frente do Caddy |
| Pacotes | npm com `package-lock.json` |

## Requisitos

- Node.js `>=22` (o CI roda Node 22; verificado localmente em Node 24.20.0)
- npm `>=10` (o repositório é npm; `package-lock.json` é a referência)
- Rust `1.85+` apenas para buildar o app desktop ou o gateway
- Docker apenas para a stack de containers em `docker/`
- Pi Agent instalado para ter sessões e modelos reais; sem ele a UI sobe em modo standalone e mostra apenas o diálogo de conexão com servidores

## Início rápido

```bash
git clone https://github.com/evandrodevbr/PiAgentUI.git
cd PiAgentUI
npm ci                 # 615 pacotes; roda scripts/copy-material-icons.mjs
npm run build          # tsc -b && vite build  -> dist/
npm run dev            # servidor de desenvolvimento Vite em http://localhost:5173
```

UI web servida pela extensão Pi (é o caminho que conversa com o runtime Pi de verdade):

```bash
npm run build                                  # a extensão serve o dist/
# com o Pi Agent carregando este repositório como pacote Pi (veja "pi" em package.json)
cat ~/.pi/agent/piagentui-port.json            # {"port": 58785, "token": "..."}
# abra http://127.0.0.1:58785
```

App desktop:

```bash
npm run tauri dev      # janela de desenvolvimento, usa o servidor Vite
npm run tauri build    # empacota conforme src-tauri/tauri.conf.json (deb no Linux, dmg, nsis)
```

Android (veja `scripts/dev-android.sh` e o job de Android no workflow de release):

```bash
npm run tauri android dev
```

## Uso

Rotas locais expostas pelo servidor da extensão. Todas, exceto `/global/health` e a rota SSE, exigem o bearer token do arquivo de descoberta.

| Rota | Para que serve |
|---|---|
| `GET /global/health` | Prova de vida, responde `{"status":"ok","pi":"ready"}` |
| `GET /global/event` | Stream SSE de eventos (sessões, partes de mensagem, status) |
| `GET /api/models` | Lista de modelos com capacidades normalizadas |
| `GET /api/sessions` | Lista de sessões |
| `POST /api/sessions` | Cria sessão |
| `POST /api/sessions/abort` | Aborta o turno em execução |
| `GET /api/sessions/:id/messages` | Histórico da sessão normalizado para renderização |
| `GET /api/sessions/:id/context` | Uso de contexto da sessão ativa |
| `POST /api/messages/send` | Envia mensagem do usuário para uma sessão |
| `GET /api/skills` | Skills efetivas agrupadas por origem |
| `GET /api/mcp/status` | Servidores MCP configurados (transporte, comando, URL, origem) |
| `GET /api/commands/list` | Slash commands built-in e dinâmicos |
| `GET /api/agents`, `GET /api/files/list`, `GET /api/permissions/list`, `GET /api/questions/list` | Inventário do runtime para os painéis |
| `GET /api/vcs/status`, `/info`, `/branches` | Estado do Git usado pelos controles do composer |
| `GET /api/extensions/list` | Catálogo de extensões do painel de extensões |
| `GET /api/settings/stt`, `/api/settings/tts` | Configurações de voz (STT/TTS) |
| `GET /api/network/access`, `POST /api/network/access` | Chave de acesso em LAN (padrão: só loopback) |

A tabela completa de rotas, incluindo as mutações de Git e de extensões, está em [`extensions/piagentui-server.ts`](extensions/piagentui-server.ts). Portas e caminhos podem mudar; o arquivo de descoberta é a fonte de verdade para porta e token.

Auditar o agente pelo shell também funciona, por exemplo:

```bash
TOKEN=$(node -e "console.log(require(process.env.HOME+'/.pi/agent/piagentui-port.json').token)")
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:58785/api/models | head -c 300
```

## Produção e deploy

```bash
npm run build          # tsc -b && vite build; saída em dist/ (cerca de 14 MB, estático)
npm run preview        # serve o dist/ localmente para conferência final
```

- Hospedagem estática: `dist/` é uma SPA comum. Se for montada em um subcaminho, build com `VITE_BASE_PATH=/subcaminho/ npm run build`.
- Container (front end com Caddy): `docker/Dockerfile.frontend` builda a UI em Node 22 e serve pelo Caddy na porta 3000.
- Stack completa de containers: `docker-compose.yml` sobe `gateway` (Caddy com o roteador Rust em 6658/6659), `frontend` e `backend`. Copie `.env.example` para `.env` antes. As imagens vêm de `ghcr.io/evandrodevbr/opencodeui-{backend,frontend,gateway}`, publicadas pelos workflows `docker-*`; para buildar localmente use `docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build`.
- GitHub Pages: `.github/workflows/deploy.yml` builda o `dist/` com `VITE_BASE_PATH=/PiAgentUI/` e publica a cada push em `main` (na primeira vez, habilite o Pages com origem "GitHub Actions").
- Releases desktop e mobile: `.github/workflows/release.yml` roda em tags `v*` e anexa artefatos de Windows, macOS, Linux e Android ao release do GitHub.

## Estrutura do projeto

```text
extensions/                  Extensão Pi: servidor HTTP/WebSocket, store de settings,
                             gerentes de git e de extensões, todos com testes Vitest
src/                         Front end React (entrada Vite em index.html)
├── api/                     Clientes HTTP/SSE e pipeline de requisições
├── components/              Peças de UI compartilhadas (code blocks, diffs, command palette)
├── features/                chat, input, mensagens, ferramentas, sessões, settings, slash commands
├── hooks/                   sessão, eventos, transcrição, permissões
├── locales/                 8 bundles traduzidos
├── store/                   Stores (sessões, mensagens, layout, tema)
└── constants/               URL base da API, chaves de storage, métricas de UI
src-router/                  Roteador do gateway em Rust (axum), atrás do Caddy
src-tauri/                   Shell desktop e mobile Tauri 2 (Rust), projeto Android em gen/
docker/                      Dockerfiles, configs do Caddy, entrypoints
scripts/                     cópia de ícones, bump de versão, preparação de release, helper Android
docs/superpowers/            Specs de design e planos escritos durante a migração
```

## Verificação

Tudo abaixo foi executado em um clone limpo neste estado do repositório:

| Comando | Resultado |
|---|---|
| `npm ci` | 615 pacotes instalados, postinstall copia 266 ícones |
| `npm run typecheck` | exit 0 (`tsc -b`, projetos app e extensão) |
| `npm run typecheck:extensions` | exit 0 |
| `npm run lint` | exit 0 (0 erros, 109 avisos) |
| `npm run build` | exit 0, `dist/` com cerca de 14 MB |
| `npm run test:run` | 89 arquivos, 319 testes, todos passando |
| `npm run validate` | exit 0 (o mesmo gate que o CI roda em `build.yml`) |
| `cargo check` em `src-router/` | exit 0 |
| `cargo check --manifest-path src-tauri/Cargo.toml` | exit 0 (1 aviso) |
| servidor da extensão via HTTP | `/global/health` 200, `/` 200 com `PI_BOOT_DATA`, `/api/models` 200 com token e 401 sem, `/api/sessions`, `/api/sessions/:id/messages`, `/api/sessions/:id/context`, `/api/skills`, `/api/mcp/status`, `/api/commands/list`, `/api/network/access` todos 200, `/global/event` 200 `text/event-stream` |

Dois detalhes ao rodar a suíte: `npm run test:run` precisa do `dist/` existir, porque o teste do servidor da extensão busca o `index.html` servido, então `npm run build` deve rodar antes (é a ordem em `npm run validate`); e `npm run format:check` hoje acusa 67 arquivos fora do padrão do Prettier, então `npm run check` falha nesse passo mesmo com o gate do CI passando.

## Estado atual e limitações

- Projeto ativo de um desenvolvedor, pré-1.0 (`0.6.10`). Chat, sessões, MCP, skills e painéis de comandos funcionam contra um runtime Pi real; algumas áreas ainda mudam rápido.
- A herança de nomes da base OpenCodeUI foi limpa só em parte: o crate Rust se chama `opencodeui-router`, as imagens de container são `opencodeui-*`, os comentários do `.env.example` estão em chinês e a stack Docker roda um backend `opencode serve` que pertence ao deploy herdado, não ao fluxo da extensão Pi.
- Não há teste do shell Tauri nem do gateway Rust além da compilação; os pacotes desktop e Android só são gerados pelo workflow de release.
- A suíte é de componentes e de servidor; não há teste end-to-end de navegador nem limite de cobertura.
- `@mariozechner/pi-coding-agent` é devDependency só para tipos (o runtime fornece a API real da extensão) e o npm marca essa linha como depreciada em favor de `@earendil-works/pi-coding-agent`.
- O front end conversa com um runtime por janela: o arquivo de descoberta ou um servidor configurado à mão. Não há agregação de múltiplos runtimes.
- A entrada de voz existe na UI (`src/hooks/useVoiceTranscription.ts`) e exige um endpoint STT compatível com OpenAI configurado nos settings; não há teste automatizado de navegador para ela.
- Sem pacote publicado no npm e sem demo web hospedada; o README e o código assumem um runtime local.

## Documentação

| Documento | Conteúdo |
|---|---|
| [`docs/superpowers/specs/`](docs/superpowers/specs/) | Specs de design da migração para extensão Pi, sessões, STT e controles de Git |
| [`docs/superpowers/plans/`](docs/superpowers/plans/) | Planos de implementação e roadmap de contexto, skills e MCP |
| [`CHANGELOG.md`](CHANGELOG.md) | Histórico de releases usado pelo workflow de release |
| [`docker/`](docker/) | Dockerfiles, configs do Caddy e entrypoints da stack de containers |

## Licença

GPL-3.0-only, conforme `package.json` e [`LICENSE`](LICENSE). PiAgentUI é um fork e uma reescrita do OpenCodeUI; os autores originais estão creditados em `src-tauri/Cargo.toml`.
