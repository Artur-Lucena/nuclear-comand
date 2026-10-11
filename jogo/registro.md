# Registro de Atividade — Núcleo de Comando

Histórico de operações, ordens recebidas e ações executadas pelo sistema.

## OP-001 — Inicialização

Sistema de gestão **Núcleo de Comando** iniciado. 120 operadores, capacidade 1000 e
suprimentos 500 carregados. Nenhuma integração externa ainda. Um parceiro no radar:
**Estação Perdida** — sem contato.

## OP-002 — Reconhecimento: jogos "space dungeon"

Ordem recebida: melhorar a interface do ambiente de operações, usando uma varredura de
reconhecimento em jogos estilo *space dungeon*.

**servo-busca** executou a varredura sobre 9 títulos: FTL: Faster Than Light, Dungeon of
the Endless, Space Hulk / Deathwing, Star Traders: Frontiers, Barotrauma, Duskers, Space
Station 13 e Heat Signature. Extraídos padrões de UI/UX, sistemas de gestão de recursos,
moral/tripulação, reputação e mapas de setores. Gerada uma **SÍNTESE com 15 práticas**
aplicáveis a um painel de comando sci-fi.

Resultado: +conhecimento (180). Fontes: web + Wikipedia (EN).

## OP-003 — Reconstrução da interface (estética space dungeon)

**servo-construcao** reescreveu `jogo/interface.html` como painel de comando sci-fi em
arquivo único (sem dependências externas), incorporando as 15 práticas da varredura:
semáforo por módulo, pips de energia com reroteamento (FTL), mapa de setores com frota/
prazo (FTL), log de transmissões estilo ship log, feed de rumores (Star Traders), moral da
equipe, reputação de parceiros, reator com cadeia Energia→O2→Moral (Barotrauma), vista em
corte do casco com quarentena (SS13), sonar com blips de incerteza (Space Hulk/Duskers),
terminal de comandos com auto-completar (Duskers), abas por departamento (RBAC temático),
modo PLANEJAR e MODO ALERTA adaptativo.

Preservadas todas as funcionalidades herdadas: leitura de `/api/estado` e `/api/registro`
a cada 3s, SSE do chat em `/api/chat`, POST `/api/ordem`, polling de `/api/chat/status` e
o canvas de estrelas. Eficiência elevada a 82.

Status: em execução a inspeção da interface por **servo-revisao** (T-004).

## OP-003 (encerramento) — Inspeção da interface

**servo-revisao** inspecionou `jogo/interface.html`: **APROVADO COM RESSALVAS**. HTML
bem-formado, zero referências externas, 16/16 ids herdados preservados, lógica de rede
intacta e as 15 features presentes; teste real do servidor retornou HTTP 200 em `/`,
`/api/estado` e `/api/registro`. Ressalvas registradas (a principal: timers dos rumores
reiniciavam a cada ciclo de render).

## OP-004 — Terminal PowerShell no app

Ordem recebida: adicionar um terminal PowerShell à aplicação.

**servo-construcao** adicionou ao processo principal (`app/main.js`) a rota `POST /api/ps`
(SSE) que executa `powershell.exe -NoProfile -NonInteractive` sob a pasta do projeto,
transmitindo stdout/stderr como `delta` e terminando com `done {code}`, com guarda-corpo
`PS_BLOQUEIOS` contra comandos destrutivos. No painel (`interface.html`) foi criado o card
"Terminal PowerShell" (`data-dept=comms`): saída monoespaçada com auto-scroll, prompt `PS>`,
histórico ↑/↓, `Ctrl+L`, estado "executando..." e fallback de indisponibilidade.

A 1ª inspeção **REPROVOU** por bug crítico: `req.on("close")` matava o processo antes de
qualquer saída (`done {code:null}` sem `delta`). **servo-construcao** corrigiu para
`res.on("close")` guardado por flag de finalização e endureceu a guarda (aliases `ri`/`mi`/
`sc`/`ac`, redirecionamento `>`, cmdlets de escrita, etc.).

2ª inspeção **APROVADO COM RESSALVAS**: 11/11 casos de teste reais passaram — `Get-Date`,
acentos UTF-8, `node -v`, `Format-Table` liberado, e bloqueio efetivo de comandos
destrutivos; cwd correto. Ressalva: a guarda é lista negra e não é sandbox (contornos como
`& ri`, quebra de linha, `.Delete()` permanecem abertos) — avaliar modo restrito.

> ⚠️ O terminal só passa a existir após **reiniciar o app** (o processo Electron em execução
> foi iniciado antes da edição do `main.js`).

## OP-005 — Minimalização da interface (min-maxing)

Ordem recebida: a interface estava poluída e cheia de informação inútil; torná-la minimalista
sob o princípio "menos é mais" (maximizar sinal por pixel).

**servo-construcao** reescreveu `jogo/interface.html` do zero como painel minimalista de
arquivo único: **349 linhas** (contra ~1250). Corte completo de todo o ruído decorativo:
campo de estrelas/scanlines, banner e MODO ALERTA, sonar animado + medidores de agulha, mapa
de setores SVG + frota/prazos, pips de energia simulados, reator/cadeia Energia→O2→Moral,
compartimentos/quarentena, feed de rumores e timers falsos, abas por departamento, modo
PLANEJAR, terminal de comandos local fake, e todas as animações/glow/gradientes decorativos.
Passou a exibir apenas o essencial: cabeçalho (módulo • operação • status), os 5 indicadores,
tarefas, registro, parceiros, ativos & integrações — e as **3 ações reais** (Nova Ordem,
Console do GESTOR/OpenCode e Terminal PowerShell). Novo visual sóbrio: fundo quase preto, um
único acento, tipografia por hierarquia, sem animações.

**servo-revisao** inspecionou: **APROVADO**. 26/26 checagens: todos os recursos cortados
ausentes, todos os essenciais presentes, zero referências externas, HTML bem-formado, 20 ids
únicos sem duplicatas, `node --check` exit 0, e teste real do servidor com HTTP 200 em `/`,
`/api/estado` e `/api/registro`. Ressalvas: rotas `/api/chat` e `/api/ps` só existem no app
Electron; a porta 5173 estava ocupada por um processo órfão de sessão anterior.

> ℹ️ A interface só reflete a mudança após **recarregar** o painel no app (ou reiniciar o
> Electron se o processo estiver servindo a versão antiga em memória).

## OP-006 — Interface IDE idle + modelos do comandante

Ordem recebida: a interface minimalista estava feia; queria estética parecida (dark sóbria), porém com
abordagem de game — **uma espécie de IDE idle** — com **chat principal comandando os servo drones** rumo ao
objetivo. Ordem complementar: manter a aba de **registro** no estilo anterior, **remover os indicadores**
("não têm propósito") e permitir **modelos extras** (Claude/Cursor) para o comandante.

**servo-busca** (T-010) entregou o spec de shell IDE (VS Code: activity bar 48px, lateral 300px, abas 35px,
painel 35% com handle, status 22px) + padrões de HUD idle sóbrios (dots, progresso, deltas, pulse único) e
tokens na paleta atual. **servo-construcao** reescreveu `jogo/interface.html` (985 linhas, single-file, zero
dependências): shell de IDE em tela cheia, unidade principal é o **chat do GESTOR** (SSE real, indicador de
digitando, Ctrl+Enter, histórico), lateral com **3 drones** (busca/construção/revisão; dot de estado, pulse
quando trabalhando, clique insere o nome no chat) e **fila de tarefas** com progresso, abas `gestor.chat` /
`registro` (estilo anterior preservado) / `rede` / `ordens`, terminal PowerShell íntegro (redimensionável,
Ctrl+`` ` ``) e **seletor de modelo do comandante** (dropdown com busca, lê `/api/modelos`, grava
`/api/modelo`). **Indicadores removidos da interface e do `estado.json`.**

**servo-construcao** também alterou `app/main.js` (frente B): rotas `GET /api/modelos` (HTTP 200 mesmo em
falha, normaliza envelope `{location,data}` do cliente) e `POST /api/modelo` (valida e traduz para
`model:{id,providerID}` exigido pela API), e `modelo` em `/api/chat/status`. Probes empíricos
(`app/probe-modelos.mjs`, `app/probe-switch.mjs`) comprovaram a forma real da API, inclusive que
`switchModel` **exige a chave `id`** (não `modelID`) — bug capturado antes de chegar ao front.

**servo-revisao** (T-012): **APROVADO COM RESSALVAS** — 15/15 checklist, testes reais (node --check, servidor
HTTP 200, probes, guarda-corpo do terminal). Ressalva D-01 (scroll da aba registro) e O-01 (indicadores ainda
no `estado.json`) — **corrigidas pelo GESTOR** (`.log` com `max-height:300px;overflow:auto` e `#regTab`
`overflow:auto`; bloco `indicadores` removido).

**Descobertas sobre modelos** (pesquisa direta no catálogo e nas 229 integrações do serviço local):
- **Claude (Anthropic)**: suportado nativamente — integração `anthropic`, modelos `claude-opus-5-5`,
  `claude-sonnet-5-5`, etc. Falta apenas autenticar.
- **Cursor**: **NÃO existe** integração/provedor no OpenCode V2 (nem nos 226 provedores do catálogo) — não há
  como usá-lo diretamente. Alternativas: GitHub Copilot (OAuth) ou provedor custom OpenAI-compatible via gateway.

Próximo passo (T-013 — responsável: Operador): `opencode auth login anthropic` e reiniciar o app para
recarregar a interface/rotas novas.
