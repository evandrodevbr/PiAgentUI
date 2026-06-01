# Especificação Técnica: Migração do PiAgentUi para Extensão do Pi Agent

Esta especificação define o desenho arquitetônico, a segurança, as estruturas de dados e a integração desktop necessários para migrar o frontend `PiAgentUi` (originalmente construído para o OpenCode) para o ecossistema do **Pi Agent**.

---

## 1. Arquitetura e Fluxo de Dados

A arquitetura do `PiAgentUi` será descentralizada do OpenCode e integrada diretamente ao processo do Pi Agent através do modelo de extensões.

1. **Loopback Server (Porta Dinâmica):** A extensão `piagentui-server.ts` se conectará ao ciclo de vida do Pi e abrirá um servidor local seguro escutando em `127.0.0.1` em uma porta livre selecionada pelo sistema operacional.
2. **Same-Origin Boot Data:** A extensão servirá o HTML principal e injetará no próprio corpo do `index.html` um bloco JSON contendo as informações de boot (URL base, porta, e o token bearer gerado na inicialização).
3. **Ponte de Comunicação:** Toda chamada HTTP e WebSocket será autenticada usando o token em memória.

```
┌─────────────────┐       ┌────────────────────────┐       ┌────────────────┐
│  Tauri (Rust)   │ ───>  │  Pi Agent (Processo)   │ <───> │  Webview (UI)  │
│  Port Check &   │       │  - piagentui-server    │       │  - React 19    │
│  Launch State   │       │  - HTTP + WS Server    │       │  - Local Token │
└─────────────────┘       └────────────────────────┘       └────────────────┘
```

---

## 2. Matriz de Endpoints e Recursos

Para o MVP, a API do `PiAgentUi` responderá nos mesmos paths esperados pelo frontend, mapeando-os para chamadas da extensão e mockando recursos incompatíveis.

| Recurso / Funcionalidade | Endpoint Frontend | Ação no Backend (Pi Agent Extension) | Status no MVP |
| :--- | :--- | :--- | :--- |
| **Health Check** | `/global/health` | Retorna status da extensão do Pi | **Suportado** |
| **Event Stream** | `/global/event` | SSE/WebSocket que espelha os eventos do Pi | **Suportado** |
| **Modelos Ativos** | `/api/models` | Consulta o registro de modelos configurado no Pi | **Suportado** |
| **Multi-Sessão (CRUD)** | `/api/sessions` | Gerencia sessões locais da pasta de sessões do Pi | **Suportado** |
| **Enviar Mensagem** | `/api/messages/send` | Dispara `pi.sendUserMessage(...)` assincronamente | **Suportado** |
| **Parar Mensagem** | `/api/messages/abort` | Aborta o turno ativo do Pi Agent se disponível | **Suportado** |
| **PTY Terminal** | `/api/pty` | Retorna erro 501 / Desativado visualmente | **Stubbed** |
| **MCP / LSP** | `/api/mcp` / `/api/lsp`| Retorna lista vazia ou erro 501 | **Stubbed** |
| **Worktrees / VCS** | `/api/worktrees` | Retorna erro 501 / Desativado visualmente | **Stubbed** |

---

## 3. Segurança e Tokens

1. **Porta Dinâmica:** Impedir conflitos de porta iniciando sempre em portas dinâmicas alocadas pelo SO (`port: 0`).
2. **Bearer Token:** Gerar um UUID/token seguro de uso único na inicialização do servidor.
3. **Sem Persistência de Senhas:** Nenhuma credencial do usuário será armazenada fisicamente ou em `localStorage`. O token de autorização residirá unicamente na memória da sessão React.
4. **Validação de Host/Origin:** Rejeitar qualquer requisição com cabeçalho `Host` ou `Origin` que não seja estritamente local (`127.0.0.1` ou `localhost`).
5. **Prevenção de Traversal:** Servir arquivos estáticos validando canonicalização de caminhos para evitar vulnerabilidade de directory traversal no Windows.

---

## 4. Integração Tauri Desktop (Track B)

Com a decisão de **incluir o Tauri já no primeiro marco**, o app desktop sofrerá as seguintes modificações:
* **Renomeação de Comandos:** Todos os comandos Tauri registrados no Rust e no frontend serão renomeados de `*opencode*` para correspondentes de `*pi*` ou `*pi_agent*`.
* **Subprocesso do Pi:** Em vez de iniciar `opencode serve`, o Tauri iniciará o processo do Pi (ex: `pi --mode rpc`) adicionando dinamicamente o parâmetro `--extension` apontando para o nosso servidor local se necessário, ou confiando no auto-load das extensões instaladas.
* **Filtro de URL Restrito:** O Rust bridge do Tauri terá uma validação explícita em tempo de execução para rejeitar qualquer tráfego que tente se conectar a servidores externos, limitando a ponte estritamente a adaptadores de loopback permitidos.

---

## 5. Referências do Projeto

Esta migração baseia-se diretamente no comportamento implementado em:
`D:/Documents/Github/PiAgentUI/better-tau/extensions/mirror-server.ts`
utilizando o modelo de ciclo de vida e roteamento nativo lá desenvolvidos como garantia de estabilidade sob o runtime do Pi.
