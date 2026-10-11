// Processo principal do app desktop "Núcleo de Comando".
// Sobe o servidor local (jogo/servidor.js), abre a interface numa janela própria e
// embute o OpenCode: o painel conversa com o agente GESTOR pelo serviço local do OpenCode.
const { app, BrowserWindow, Menu, shell } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const { startServer } = require("../jogo/servidor.js");

const JOGO_DIR = path.join(__dirname, "..", "jogo");
const PROJETO_DIR = path.join(__dirname, "..");

let mainWindow = null;
let baseUrl = null;

// ---------------------------------------------------------------- OpenCode
// modelo: modelo do COMANDANTE escolhido pelo usuário (null = padrão do projeto).
// Formato: { providerID, modelID, name }.
const oc = { pronto: false, client: null, session: null, erro: null, modelo: null };
const pendentes = new Map(); // sessionID -> { nomes, onDelta, tool, done, fail }

async function iniciarOpenCode() {
  try {
    const { OpenCode } = await import("@opencode/client");
    const { Service } = await import("@opencode/client/service");

    const ep = await Service.ensure(); // descobre ou inicia o serviço local
    const client = OpenCode.make({ baseUrl: ep.url, headers: Service.headers(ep) });

    const session = await client.session.create({
      location: { directory: PROJETO_DIR },
      agent: "gestor",
    });

    oc.pronto = true;
    oc.client = client;
    oc.session = session;
    oc.erro = null;

    // assinatura global de eventos do serviço
    (async () => {
      for await (const ev of client.event.subscribe()) {
        const d = ev.data || {};
        const w = pendentes.get(d.sessionID);
        if (!w) continue;
        if (ev.type === "session.text.delta") w.onDelta(d.delta || "");
        // progresso ao vivo: ferramentas e raciocínio (o console mostra o que está acontecendo)
        else if (ev.type === "session.tool.input.started") { w.nomes.set(d.id, d.name); w.tool({ estado: "iniciado", nome: d.name, id: d.id }); }
        else if (ev.type === "session.tool.success") w.tool({ estado: "ok", nome: w.nomes.get(d.id), id: d.id });
        else if (ev.type === "session.tool.failed") w.tool({ estado: "falha", nome: w.nomes.get(d.id), id: d.id });
        else if (ev.type === "session.reasoning.started") w.tool({ estado: "pensando" });
        else if (ev.type === "session.execution.failed") w.fail(d.error || "falha na execução");
        else if (ev.type === "session.execution.succeeded" || ev.type === "session.idle") w.done();
      }
    })().catch((e) => console.error("[opencode] eventos:", e?.message || e));

    console.log("[opencode] conectado em", ep.url, "| sessao", session.id);
  } catch (e) {
    oc.erro = String(e?.message || e);
    console.error("[opencode] falha ao iniciar:", oc.erro);
  }
}

function sse(res, event, data) {
  try { res.write(`event: ${event}\ndata: ${JSON.stringify(data || {})}\n\n`); } catch {}
}

function rotaChat(req, res) {
  let body = "";
  req.on("data", (c) => { body += c; if (body.length > 1e6) req.destroy(); });
  req.on("end", async () => {
    let text = "";
    try { text = (JSON.parse(body || "{}").text || "").trim(); } catch {}
    if (!text) {
      res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
      res.end('{"erro":"mensagem vazia"}');
      return;
    }
    if (!oc.pronto) {
      res.writeHead(503, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store" });
      sse(res, "error", { message: "OpenCode indisponível: " + (oc.erro || "não conectado") });
      res.end();
      return;
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.write(": conectado\n\n");

    const sid = oc.session.id;
    let fim = false;
    const finalizar = (event, data) => {
      if (fim) return;
      fim = true;
      sse(res, event, data);
      try { res.end(); } catch {}
      pendentes.delete(sid);
    };

    pendentes.set(sid, {
      nomes: new Map(),
      onDelta: (d) => { if (!fim) sse(res, "delta", { d }); },
      tool: (info) => { if (!fim) sse(res, "passo", info); },
      done: () => finalizar("done", {}),
      fail: (m) => finalizar("error", { message: String(m) }),
    });

    try {
      await oc.client.session.prompt({ sessionID: sid, text });
    } catch (e) {
      finalizar("error", { message: String(e?.message || e) });
    }
    // trava de segurança
    setTimeout(() => finalizar("done", {}), 15 * 60 * 1000);
  });
}

function rotaStatus(req, res) {
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify({ opencode: oc.pronto, sessao: oc.session ? oc.session.id : null, erro: oc.erro, modelo: oc.modelo }));
}

// ---------------------------------------------------------------- Modelos do comandante
// Normaliza a lista de modelos/provedores do OpenCode SEM depender da forma exata do
// retorno (confirmado por probe-modelos.mjs: { location, data: [...] }). Aceita também
// array cru e envelopes alternativos (.models / .providers) por segurança.
function listaDe(x, ...chaves) {
  if (Array.isArray(x)) return x;
  if (x && typeof x === "object") {
    for (const k of chaves) if (Array.isArray(x[k])) return x[k];
    if (Array.isArray(x.data)) return x.data;
  }
  return [];
}

function normalizarModelos(brutoModelos, brutoProvedores) {
  const modelos = listaDe(brutoModelos, "models", "data");
  const provedores = listaDe(brutoProvedores, "providers", "data");
  const nomeDoProvedor = new Map();
  for (const p of provedores) {
    const pid = p?.providerID ?? p?.id;
    if (pid) nomeDoProvedor.set(pid, p?.name ?? pid);
  }
  return modelos
    .map((m) => {
      const providerID = m?.providerID ?? m?.provider?.id ?? "";
      const modelID = m?.modelID ?? m?.id ?? "";
      const nome = m?.name ?? m?.modelID ?? m?.id ?? modelID;
      return {
        id: providerID && modelID ? `${providerID}/${modelID}` : modelID,
        providerID,
        modelID,
        nome,
        provedor: nomeDoProvedor.get(providerID) ?? providerID,
      };
    })
    .filter((m) => m.modelID);
}

// Busca modelos + provedores no serviço local (best-effort nos provedores).
async function listarModelos() {
  const location = { directory: PROJETO_DIR };
  const [modelosBrutos, provedoresBrutos] = await Promise.all([
    oc.client.model.list({ location }),
    oc.client.provider.list({ location }).catch(() => null),
  ]);
  return normalizarModelos(modelosBrutos, provedoresBrutos);
}

// GET /api/modelos -> { ok, atual, modelos, erro } (sempre HTTP 200)
async function rotaModelos(req, res) {
  const responder = (obj) => {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    res.end(JSON.stringify(obj));
  };
  if (!oc.pronto || !oc.client) {
    return responder({ ok: false, atual: oc.modelo, modelos: [], erro: "OpenCode indisponível: " + (oc.erro || "não conectado") });
  }
  try {
    const modelos = await listarModelos();
    responder({ ok: true, atual: oc.modelo, modelos, erro: null });
  } catch (e) {
    responder({ ok: false, atual: oc.modelo, modelos: [], erro: String(e?.message || e) });
  }
}

// POST /api/modelo  corpo { providerID, modelID } -> troca o modelo da sessão do comandante.
// A API da sessão espera { model: { id, providerID } } — NÃO "modelID" (confirmado no probe).
function rotaModelo(req, res) {
  let body = "";
  req.on("data", (c) => { body += c; if (body.length > 1e5) req.destroy(); });
  req.on("end", async () => {
    const responder = (obj) => {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
      res.end(JSON.stringify(obj));
    };

    let dados = {};
    try { dados = JSON.parse(body || "{}"); } catch {}
    const providerID = String(dados.providerID ?? "").trim();
    const modelID = String(dados.modelID ?? dados.id ?? "").trim();
    if (!providerID || !modelID) {
      return responder({ ok: false, erro: "providerID/modelID obrigatórios" });
    }
    if (!oc.pronto || !oc.client || !oc.session) {
      return responder({ ok: false, erro: "OpenCode indisponível: " + (oc.erro || "não conectado") });
    }

    try {
      // nome de exibição (best-effort) a partir da lista real de modelos
      let name = modelID;
      try {
        const modelos = await listarModelos();
        const achado = modelos.find((m) => m.providerID === providerID && m.modelID === modelID);
        if (achado && achado.nome) name = achado.nome;
      } catch {}

      await oc.client.session.switchModel({ sessionID: oc.session.id, model: { id: modelID, providerID } });

      oc.modelo = { providerID, modelID, name };
      responder({ ok: true, atual: oc.modelo });
    } catch (e) {
      responder({ ok: false, erro: String(e?.message || e) });
    }
  });
}

// ---------------------------------------------------------------- Terminal PowerShell
// Guarda-corpo: padrões DESTRUTIVOS BLOQUEADOS (política do projeto: nunca remover
// arquivos nem rodar comandos destrutivos). Comparados de forma case-insensitive,
// com limites de palavra (\b) para evitar casamentos acidentais no meio de nomes.
const PS_BLOQUEIOS = [
  // -------- remoção / escrita no disco (cmdlets e aliases) --------
  /remove-item/i,               // Remove-Item
  /remove-/i,                   // qualquer cmdlet Remove-*
  /(^|[|;]\s*)ri\b/i,           // ri (alias de Remove-Item) em posição de comando
  /\brm\b/i,                    // rm / rm -rf ...
  /\bdel\b/i,                   // del
  /\berase\b/i,                 // erase
  /rmdir/i,                     // rmdir
  /(^|[|;]\s*)rd\b/i,           // rd (alias de rmdir) em posição de comando
  /move-item/i,                 // Move-Item
  /(^|[|;]\s*)mi\b/i,           // mi (alias de Move-Item) em posição de comando
  /\bmove\b/i,                  // move
  /rename-item/i,               // Rename-Item
  /(^|[|;]\s*)ren\b/i,          // ren em posição de comando
  /set-content/i,               // Set-Content
  /add-content/i,               // Add-Content
  /out-file/i,                  // Out-File
  /new-item/i,                  // New-Item
  /(^|[|;]\s*)ni\b/i,           // ni (alias de New-Item) em posição de comando
  /clear-content/i,             // Clear-Content
  /clear-item/i,                // Clear-Item
  // -------- formatação / partição de disco --------
  /format-volume/i,             // Format-Volume
  /format\s+[a-z]:/i,           // format C: (formatação de unidade)
  /mkfs/i,                      // mkfs
  /diskpart/i,                  // diskpart
  /remove-partition/i,          // Remove-Partition
  /clear-disk/i,                // Clear-Disk
  /(^|[|;]\s*)dd\b/i,           // dd em posição de comando
  // -------- desligamento / processos / serviços --------
  /shutdown/i,                  // shutdown
  /stop-computer/i,             // Stop-Computer
  /restart-computer/i,          // Restart-Computer
  /stop-process/i,              // Stop-Process
  /taskkill/i,                  // taskkill
  /stop-service/i,              // Stop-Service
  /sc\s+delete/i,               // sc delete
  // -------- registro / rede / permissões / boot / backup / log --------
  /reg\s+add/i,                 // reg add
  /reg\s+delete/i,              // reg delete
  /netsh/i,                     // netsh
  /takeown/i,                   // takeown
  /icacls/i,                    // icacls
  /bcdedit/i,                   // bcdedit
  /vssadmin\s+delete/i,         // vssadmin delete
  /wbadmin\s+delete/i,          // wbadmin delete
  /wevtutil\s+cl/i,             // wevtutil cl
  // -------- execução arbitrária --------
  /set-executionpolicy/i,       // Set-ExecutionPolicy
  /invoke-expression/i,         // Invoke-Expression
  /(^|[|;]\s*)iex\b/i,          // iex (alias) em posição de comando
  // -------- redirecionamento de saída para arquivo --------
  /[>]{1,2}/,                   // > e >> (redirecionamento de saída bloqueado)
];

// POST /api/ps — executa um comando no PowerShell (processo principal) e
// transmite a saída em streaming via SSE ('delta' | 'error' | 'done').
function rotaPowerShell(req, res) {
  let body = "";
  req.on("data", (c) => { body += c; if (body.length > 1e5) req.destroy(); });
  req.on("end", () => {
    let cmd = "";
    try { cmd = String(JSON.parse(body || "{}").cmd || "").trim(); } catch {}

    if (!cmd) {
      res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
      res.end('{"erro":"comando vazio"}');
      return;
    }

    // Bloqueio por política: responde como stream (mesmo canal do SSE) para o front
    // já saber tratar, e envia um evento 'error'.
    const bloqueio = PS_BLOQUEIOS.find((re) => re.test(cmd));
    if (bloqueio) {
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-store",
        Connection: "keep-alive",
      });
      sse(res, "error", { message: "Comando bloqueado pela política do projeto (sem operações destrutivas). Padrão: " + bloqueio });
      try { res.end(); } catch {}
      return;
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.write(": conectado\n\n");

    // Força UTF-8 na entrada/saída do PowerShell para acentos corretos.
    const cmdUtf8 = "$OutputEncoding=[Console]::OutputEncoding=[Text.Encoding]::UTF8; " + cmd;

    let fim = false;
    const finalizar = (event, data) => {
      if (fim) return;
      fim = true;
      sse(res, event, data);
      try { res.end(); } catch {}
    };

    let ps = null;
    try {
      ps = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", cmdUtf8], {
        cwd: PROJETO_DIR,
        windowsHide: true,
      });
    } catch (e) {
      finalizar("error", { message: String(e?.message || e) });
      return;
    }

    // Timeout de segurança: encerra o processo teimosamente travado (120s).
    const tempo = setTimeout(() => {
      if (fim) return;
      fim = true;
      sse(res, "error", { message: "Tempo esgotado (120s): processo encerrado." });
      sse(res, "done", { code: null });
      try { res.end(); } catch {}
      try { ps.kill(); } catch {}
    }, 120000);

    ps.stdout.on("data", (chunk) => { if (!fim) sse(res, "delta", { d: chunk.toString("utf8") }); });
    ps.stderr.on("data", (chunk) => { if (!fim) sse(res, "delta", { d: chunk.toString("utf8") }); });

    ps.on("error", (e) => {
      clearTimeout(tempo);
      finalizar("error", { message: String(e?.message || e) });
    });
    ps.on("close", (code) => {
      clearTimeout(tempo);
      finalizar("done", { code });
    });

    // Se o CLIENTE desconectar de verdade ANTES do fim, mata o processo (sem travar).
    // IMPORTANTE: usa res.on("close"), e NÃO req.on("close") — em Node >= 16 o evento
    // 'close' de IncomingMessage dispara quando o corpo da requisição termina (sempre),
    // o que mataria o processo filho antes de produzir saída.
    res.on("close", () => {
      if (!fim) {
        clearTimeout(tempo);
        try { if (ps && !ps.killed) ps.kill(); } catch {}
      }
    });
  });
}

// ---------------------------------------------------------------- janela
function criarJanela(port) {
  baseUrl = `http://localhost:${port}`;
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 900,
    minWidth: 980,
    minHeight: 660,
    backgroundColor: "#04060d",
    title: "Núcleo de Comando — Sistema de Gestão",
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  mainWindow.loadURL(baseUrl);
  mainWindow.on("closed", () => { mainWindow = null; });
}

function montarMenu() {
  const template = [
    {
      label: "Núcleo de Comando",
      submenu: [
        { label: "Recarregar painel", accelerator: "CmdOrCtrl+R", click: () => mainWindow && mainWindow.reload() },
        { label: "Abrir pasta do projeto", click: () => shell.openPath(JOGO_DIR) },
        { type: "separator" },
        { role: "togglefullscreen", label: "Tela cheia" },
        { role: "quit", label: "Sair" },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  // 1) sobe o painel local
  startServer({ dir: JOGO_DIR, portStart: 5173, routes: { "/api/chat": rotaChat, "/api/chat/status": rotaStatus, "/api/ps": rotaPowerShell, "/api/modelos": rotaModelos, "/api/modelo": rotaModelo } }, (port) => {
    if (!port) { console.error("Não foi possível iniciar o servidor do painel."); app.quit(); return; }
    criarJanela(port);
    montarMenu();
  });

  // 2) conecta o OpenCode embutido (assíncrono — o painel já abre)
  iniciarOpenCode();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0 && baseUrl) {
      criarJanela(Number(new URL(baseUrl).port));
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
