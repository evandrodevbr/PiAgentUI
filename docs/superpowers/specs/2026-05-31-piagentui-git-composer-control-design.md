# Design — Controle Git no composer do PiAgentUI

## Objetivo

Adicionar à bolha de envio de mensagens um controle Git compacto, localizado no canto inferior esquerdo da toolbar do composer, mostrando a branch atual e abrindo um popover com branches e operações Git principais.

## Direção visual aprovada

- O controle aparece como um chip integrado à `InputToolbar`, antes dos seletores de agente e variante.
- O chip usa iconografia GitHub/Octicons, texto monoespaçado, estado dirty e chevron.
- Ao clicar, abre um popover acima da bolha de input, alinhado ao chip, seguindo o padrão visual de `DropdownMenu`: glass, borda sutil, radius alto e sombra do app.
- O popover tem duas áreas:
  - lista de branches local/remota e ação de nova branch;
  - status, ações Git e área dedicada de commit.
- As ações principais usam ícones: branch, commit, diff/status, pull, push, refresh, stage/unstage, arquivos e alertas.

## Escopo MVP seguro

Inclui:

- carregar branch atual, branches locais/remotas e status resumido;
- trocar branch local/remota;
- criar branch a partir da atual;
- listar arquivos alterados;
- stage/unstage arquivo;
- stage all/unstage all;
- commit com textarea dedicada;
- pull e push explícitos;
- refresh de status;
- mensagens de erro e loading.

Não inclui no MVP:

- merge manual;
- rebase;
- reset hard;
- revert;
- stash;
- force push;
- edição interativa de hunks.

## Segurança e comportamento

- Backend executa Git via `spawn`/`execFile` com argv fixo, nunca shell arbitrário.
- Diretório vem do projeto atual e precisa ser repositório Git válido.
- Commit exige mensagem não vazia e pelo menos um arquivo staged.
- Pull/push são ações explícitas no popover.
- Erros do Git são retornados como mensagens sanitizadas.
- Operações atualizam status e branch após sucesso.

## Componentes

- `GitComposerControl`: chip + popover Git do composer.
- `src/api/vcs.ts`: funções de API para status, branches e ações.
- `src/types/api/vcs.ts`: contratos frontend/backend.
- `extensions/piagentui-git-manager.ts`: camada backend focada em Git.
- `extensions/piagentui-server.ts`: endpoints `/api/vcs/*`.

## Endpoints planejados

- `GET /api/vcs/info`
- `GET /api/vcs/branches`
- `GET /api/vcs/status`
- `POST /api/vcs/checkout`
- `POST /api/vcs/branch`
- `POST /api/vcs/stage`
- `POST /api/vcs/unstage`
- `POST /api/vcs/commit`
- `POST /api/vcs/pull`
- `POST /api/vcs/push`

## Testes

- Testes unitários do git manager com runner fake.
- Testes de API frontend (`src/api/vcs.test.ts`).
- Teste de componente para renderizar branch, abrir popover, preencher commit e disparar ações.
- Testes de servidor para endpoints principais com mocks.

## Referência de ícones

Usar `@primer/octicons-react`, pacote oficial do Primer/GitHub Octicons. A documentação oficial mostra importação direta, por exemplo:

```ts
import { GitCommitIcon } from '@primer/octicons-react'
```

Fonte consultada via Context7: `https://primer.style/octicons/icon/git-commit-24` e `https://primer.style/octicons/code`.
