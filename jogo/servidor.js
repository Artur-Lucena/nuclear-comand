// Servidor local do Império. Pode ser usado de duas formas:
//   1) Linha de comando:  node jogo/servidor.js
//   2) Como módulo:       const { startServer } = require("./servidor.js")
const http = require("http");
const fs = require("fs");
const path = require("path");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function send(res, code, body, type) {
  res.writeHead(code, {
    "Content-Type": type || "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function createHandler(dir, routes) {
  const ler = (p) => { try { return fs.readFileSync(path.join(dir, p), "utf8"); } catch { return null; } };

  return (req, res) => {
    // Bloqueia DNS rebinding e requisições de páginas externas às rotas locais.
    const host = req.headers.host || "";
    if (!/^(?:localhost|127\.0\.0\.1):\d+$/.test(host) || Number(host.split(":").pop()) !== req.socket.localPort) {
      return send(res, 403, "Host não permitido");
    }
    // Navegadores não podem enviar este cabeçalho entre origens sem preflight CORS.
    if (req.method === "POST" && req.headers["x-nuclear-command-request"] !== "1") {
      return send(res, 403, "Requisição não autorizada");
    }
    const u = new URL(req.url, "http://localhost");
    const p = u.pathname;

    // rotas extras (ex.: integração OpenCode)
    if (routes && routes[p]) return routes[p](req, res);

    if (p === "/" || p === "/index.html") {
      const html = ler("interface.html");
      return send(res, html ? 200 : 404, html || "interface.html não encontrada", MIME[".html"]);
    }

    if (p === "/api/estado") {
      const s = ler("estado.json");
      return send(res, s ? 200 : 404, s || '{"erro":"estado.json não encontrado"}', MIME[".json"]);
    }

    if (p === "/api/registro") {
      return send(res, 200, ler("registro.md") || "", MIME[".md"]);
    }

    if (p === "/api/ordens") {
      return send(res, 200, ler("ordens.md") || "", MIME[".md"]);
    }

    if (p === "/api/ordem" && req.method === "POST") {
      let body = "";
      req.on("data", (c) => { body += c; if (body.length > 100000) req.destroy(); });
      req.on("end", () => {
        let text = "";
        try { text = (JSON.parse(body || "{}").text || "").trim(); } catch {}
        if (!text) return send(res, 400, JSON.stringify({ ok: false, erro: "ordem vazia" }), MIME[".json"]);
        const stamp = new Date().toLocaleString("pt-BR");
        try {
          fs.appendFileSync(path.join(dir, "ordens.md"), `\n## Ordem — ${stamp}\n\n${text}\n`, "utf8");
        } catch (e) {
          return send(res, 500, JSON.stringify({ ok: false, erro: e.message }), MIME[".json"]);
        }
        return send(res, 200, JSON.stringify({ ok: true }), MIME[".json"]);
      });
      return;
    }

    // Arquivos estáticos da pasta jogo/ (ex.: /interface.html, /mapa.png)
    const rel = p.replace(/^\/+/, "");
    if (rel && !rel.includes("..")) {
      const full = path.join(dir, rel);
      if (fs.existsSync(full) && fs.statSync(full).isFile()) {
        const ext = path.extname(full).toLowerCase();
        return send(res, 200, fs.readFileSync(full), MIME[ext] || "application/octet-stream");
      }
    }

    return send(res, 404, "Não encontrado");
  };
}

// Inicia o servidor. onReady(port, server) é chamado quando estiver ouvindo.
function startServer(opts = {}, onReady) {
  const dir = opts.dir || __dirname;
  const portStart = opts.portStart ?? 5173;
  const tries = opts.tries ?? 20;
  const handler = createHandler(dir, opts.routes);

  function listen(port, left) {
    const server = http.createServer(handler);
    server.once("error", (e) => {
      if (e.code === "EADDRINUSE" && left > 0) return listen(port + 1, left - 1);
      console.error("Erro no servidor:", e.message);
      if (onReady) onReady(null, null);
    });
    server.listen(port, "127.0.0.1", () => {
      if (onReady) onReady(server.address().port, server);
    });
    return server;
  }

  return listen(portStart, tries);
}

module.exports = { startServer, createHandler };

if (require.main === module) {
  startServer({}, (port) => {
    if (port) {
      console.log(`\n  🛰️  NÚCLEO DE COMANDO — Sistema de Gestão em  http://127.0.0.1:${port}\n`);
      console.log("  (Ctrl+C para parar)\n");
    }
  });
}
