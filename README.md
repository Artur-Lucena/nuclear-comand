# Núcleo de Comando

O [esqueleto de evolução da IDE](docs/ESQUELETO_IDE.md) reúne o estado verificado, a arquitetura proposta, a UI alvo e a ordem de implementação.

Sistema de gestão com **painel desktop (Electron)** que tem o **OpenCode embutido**: você
conversa com o agente **GESTOR** pela própria janela e ele executa as ordens (cria arquivos,
roda comandos, pesquisa, revisa). Idealizado "como se fosse um jogo", mas serve para
**qualquer tarefa** — construir um site, organizar arquivos, automatizar algo.

> Você dá a ordem. O GESTOR divide em tarefas e comanda a mão de obra (drones `servo-*`).

---

## O que é

- 🖥️ **Painel** com indicadores, quadro de tarefas, registro de atividades e parceiros.
- 💬 **Console de chat** integrado ao OpenCode — fale direto com o GESTOR dentro do app.
- 🖤 **Terminal PowerShell** real (executa comandos no processo principal, com guarda-corpo).
- 🤖 **Agentes OpenCode** versionados: 1 gestor (orquestrador) + 3 drones de execução.
- 🌐 **Servidor local** que serve o painel e expõe a API (estado, registro, ordens, chat).

---

## Arquitetura

```
                    ┌──────────────────────────────┐
   Você  ──────────▶│  Painel (jogo/interface.html) │
                    └──────────────┬───────────────┘
                                   │ fetch (HTTP)
                                   ▼
                    ┌──────────────────────────────┐
                    │  Servidor local (jogo/servidor.js)
                    │  + rotas do app (app/main.js)  │
                    └───────┬───────────────┬───────┘
                            │               │
              arquivos de estado            │  @opencode/client
        (estado.json, registro.md,          ▼
         ordens.md)                 ┌──────────────────────┐
                                    │  Serviço local do     │
                                    │  OpenCode (GESTOR +   │
                                    │  drones servo-*)      │
                                    └──────────────────────┘
```

O `app/main.js` (processo principal do Electron) sobe o servidor do painel e, em paralelo,
conecta-se ao **serviço local do OpenCode** via `@opencode/client`, criando uma sessão do
agente `gestor` apontada para a pasta do projeto.

---

## Requisitos

| Requisito | Observação |
|---|---|
| **Windows** | O terminal PowerShell e o `Imperio.bat` são específicos de Windows. |
| **Node.js 22+ e npm** | Para rodar o app e instalar as dependências. |
| **OpenCode instalado e autenticado** | O chat embutido depende do serviço local do OpenCode. |

---

## Como rodar

```powershell
cd app
npm install
npm start
```

Ou, no Windows, dê dois cliques em **`app\Imperio.bat`**.

O painel abre em **http://localhost:5173** (se a porta estiver ocupada, ele tenta a próxima).

---

## Continuar em outra máquina

O repositório original está **público** no GitHub. Para enviar mudanças diretamente a ele, é preciso acesso de colaborador; contribuições também podem ser propostas por fork e pull request.

```powershell
git clone https://github.com/bernardosdbc/nuclear-comand.git
cd nuclear-comand\app
npm install
npm start
```

### O que **não** vem no repositório (é do ambiente)

| Item | Como resolver |
|---|---|
| `node_modules/` (Electron, ~200 MB) | `npm install` dentro de `app/` |
| **Login do OpenCode** | Instale o OpenCode e autentique (`opencode auth login`) |
| Credenciais do GitHub | `gh auth login` ou login pelo Git |
| Node.js / npm | Instale o Node |

### Pontos de atenção

1. **Postinstall do Electron**: dependendo da versão do npm, pode ser preciso rodar
   `npm install-scripts approve electron` e depois `npm rebuild electron`.
2. **Sem OpenCode logado**, o painel abre normalmente, mas o console de chat mostra
   *"OpenCode indisponível"*.
3. O estado em `jogo/estado.json` e `jogo/registro.md` é um **snapshot** versionado; o que
   mudar depois precisa de novo commit/push.

---

## Estrutura do projeto

```
.
├── AGENTS.md                     # Preferências do repositório (pt-BR, sem rm)
├── README.md
├── opencode.json                 # Modelo padrão
├── opencode.jsonc                # Permissões (ex.: rm = deny)
├── .opencode/
│   ├── agents/
│   │   ├── gestor.md             # Agente principal (orquestrador universal)
│   │   ├── servo-busca.md        # Drone de reconhecimento (só leitura/pesquisa)
│   │   ├── servo-construcao.md   # Drone de fabricação (cria/edita arquivos)
│   │   └── servo-revisao.md      # Drone de inspeção (verifica/testa, só leitura)
│   └── commands/
│       └── novo-jogo.md          # Comando de reinício
├── app/                          # Aplicativo desktop (Electron)
│   ├── main.js                   # Processo principal: servidor + integração OpenCode
│   ├── package.json              # Dependências (electron, @opencode/client)
│   ├── package-lock.json
│   ├── Imperio.bat               # Launcher com um clique (Windows)
│   └── teste-*.mjs               # Smoke tests do canal de chat
└── jogo/                         # Painel + servidor local
    ├── interface.html            # Interface (painel/console/terminal)
    ├── servidor.js               # Servidor local e rotas de estado
    ├── estado.json               # Estado atual (indicadores, tarefas, etc.)
    ├── registro.md               # Registro de atividades exibido no painel
    └── ordens.md                 # Fila de ordens por arquivo
```

---

## Agentes (OpenCode)

| Agente | Papel |
|---|---|
| **`gestor`** | Agente principal universal. Recebe **qualquer** ordem, divide em tarefas e comanda os drones. |
| **`servo-busca`** | Drone de reconhecimento: pesquisa e lê, devolve o resultado bruto. Não edita. |
| **`servo-construcao`** | Drone de fabricação: cria/edita arquivos e roda comandos. |
| **`servo-revisao`** | Drone de inspeção: verifica e testa, devolve o resultado bruto. Não edita. |

Os drones são **mão de obra pura**: executam literalmente e não dão opiniões.

---

## API local

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/` , `/index.html` | Serve o painel. |
| `GET` | `/api/estado` | Estado atual (`jogo/estado.json`). |
| `GET` | `/api/registro` | Registro de atividades (`jogo/registro.md`). |
| `GET` | `/api/ordens` | Fila de ordens (`jogo/ordens.md`). |
| `POST` | `/api/ordem` | Anexa uma ordem à fila por arquivo. |
| `POST` | `/api/chat` | Envia mensagem ao GESTOR; resposta em **streaming (SSE)**. |
| `GET` | `/api/chat/status` | Estado da conexão com o OpenCode. |
| `POST` | `/api/ps` | Executa um comando no PowerShell; saída em **streaming (SSE)**. |

---

## Limitações

- **Windows-only**: terminal PowerShell e launcher `.bat`.
- A guarda do terminal é uma **lista negra** de comandos destrutivos — é um atalho de
  segurança, **não um sandbox**.
- O chat depende do **serviço local do OpenCode** estar disponível.

---

## Licença

MIT.
