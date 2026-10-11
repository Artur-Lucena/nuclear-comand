// Teste ponta a ponta do canal de chat (sem Electron).
// Sobe o servidor do painel com as rotas de chat e envia uma ordem real.
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { OpenCode } from "@opencode/client";
import { Service } from "@opencode/client/service";

const require = createRequire(import.meta.url);
const { startServer } = require("../jogo/servidor.js");

const JOGO_DIR = fileURLToPath(new URL("../jogo/", import.meta.url));
const PROJETO_DIR = fileURLToPath(new URL("../", import.meta.url));

const oc = { pronto: false, client: null, session: null, erro: null };
const pendentes = new Map();

function sse(res, event, data) {
  try { res.write(`event: ${event}\ndata: ${JSON.stringify(data || {})}\n\n`); } catch {}
}

function rotaChat(req, res) {
  let body = "";
  req.on("data", (c) => { body += c; });
  req.on("end", async () => {
    let text = "";
    try { text = (JSON.parse(body || "{}").text || "").trim(); } catch {}
    if (!text) { res.writeHead(400); res.end('{"erro":"vazio"}'); return; }
    if (!oc.pronto) {
      res.writeHead(503, { "Content-Type": "text/event-stream" });
      sse(res, "error", { message: "OpenCode indisponível: " + (oc.erro || "não conectado") });
      res.end(); return;
    }
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store" });
    const sid = oc.session.id;
    let fim = false;
    const finalizar = (event, data) => {
      if (fim) return; fim = true;
      sse(res, event, data); try { res.end(); } catch {}
      pendentes.delete(sid);
    };
    pendentes.set(sid, {
      onDelta: (d) => { if (!fim) sse(res, "delta", { d }); },
      done: () => finalizar("done", {}),
      fail: (m) => finalizar("error", { message: String(m) }),
    });
    try { await oc.client.session.prompt({ sessionID: sid, text }); }
    catch (e) { finalizar("error", { message: String(e?.message || e) }); }
    setTimeout(() => finalizar("done", {}), 15 * 60 * 1000);
  });
}

function rotaStatus(req, res) {
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ opencode: oc.pronto, sessao: oc.session?.id || null, erro: oc.erro }));
}

async function iniciarOpenCode() {
  const ep = await Service.ensure();
  const client = OpenCode.make({ baseUrl: ep.url, headers: Service.headers(ep) });
  const session = await client.session.create({ location: { directory: PROJETO_DIR }, agent: "gestor" });
  oc.pronto = true; oc.client = client; oc.session = session;
  (async () => {
    for await (const ev of client.event.subscribe()) {
      const d = ev.data || {};
      const w = pendentes.get(d.sessionID);
      if (!w) continue;
      if (ev.type === "session.text.delta") w.onDelta(d.delta || "");
      else if (ev.type === "session.execution.failed") w.fail(d.error || "falha");
      else if (ev.type === "session.execution.succeeded" || ev.type === "session.idle") w.done();
    }
  })().catch((e) => console.log("sub erro:", e?.message || e));
}

await iniciarOpenCode();
console.log("sessao:", oc.session.id);

startServer({ dir: JOGO_DIR, portStart: 5199, routes: { "/api/chat": rotaChat, "/api/chat/status": rotaStatus } }, async (port) => {
  console.log("servidor em", port);
  const status = await fetch(`http://localhost:${port}/api/chat/status`).then((r) => r.json());
  console.log("status:", JSON.stringify(status));

  const resp = await fetch(`http://localhost:${port}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "Responda apenas com: CANAL OK" }),
  });
  console.log("HTTP", resp.status);
  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let texto = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const raw = buf.slice(0, i); buf = buf.slice(i + 2);
      let ev = "", data = "";
      for (const line of raw.split("\n")) {
        if (line.startsWith("event:")) ev = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      let j = {}; try { j = JSON.parse(data || "{}"); } catch {}
      if (ev === "delta") { texto += j.d || ""; }
      else if (ev === "done") console.log("EV done");
      else if (ev === "error") console.log("EV error:", j.message);
    }
  }
  console.log("TEXTO STREAMADO:", JSON.stringify(texto));
  process.exit(0);
});
