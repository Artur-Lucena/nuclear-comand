// -----------------------------------------------------------------------------
// probe-modelos.mjs -- diagnostico da API de modelos/provedores do OpenCode.
//
// Descobre na pratica a FORMA REAL retornada por:
//   client.model.list({ location })
//   client.provider.list({ location })
//   client.model.default({ location })
//   client.session.get({ sessionID })  (modelo corrente da sessao)
//
// Uso (a partir da pasta app/):
//   node app\probe-modelos.mjs   (ou: node probe-modelos.mjs)
//
// Documentacao viva: mantenha este arquivo como referencia da API de modelos.
// -----------------------------------------------------------------------------
import path from "node:path";
import { fileURLToPath } from "node:url";
import { OpenCode } from "@opencode/client";
import { Service } from "@opencode/client/service";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJETO_DIR = path.resolve(__dirname, "..");

function bloco(titulo, valor) {
  console.log("\n========== " + titulo + " ==========");
  try {
    console.log(JSON.stringify(valor, null, 2).slice(0, 3000));
  } catch (e) {
    console.log("<nao serializavel> " + String(e?.message || e));
  }
}

const ep = await Service.ensure();
console.log("endpoint:", ep.url);
const client = OpenCode.make({ baseUrl: ep.url, headers: Service.headers(ep) });

const location = { directory: PROJETO_DIR };
console.log("location:", JSON.stringify(location));

// 1) model.list
try {
  const r = await client.model.list({ location });
  bloco("model.list", r);
  console.log("typeof:", typeof r, "| Array.isArray:", Array.isArray(r), "| keys:", r && typeof r === "object" ? Object.keys(r).join(",") : "-");
} catch (e) {
  console.log("model.list ERRO:", String(e?.message || e));
}

// 2) provider.list
try {
  const r = await client.provider.list({ location });
  bloco("provider.list", r);
  console.log("typeof:", typeof r, "| Array.isArray:", Array.isArray(r), "| keys:", r && typeof r === "object" ? Object.keys(r).join(",") : "-");
} catch (e) {
  console.log("provider.list ERRO:", String(e?.message || e));
}

// 3) model.default
try {
  const r = await client.model.default({ location });
  bloco("model.default", r);
} catch (e) {
  console.log("model.default ERRO:", String(e?.message || e));
}

// 4) modelo corrente de uma sessao nova
try {
  const session = await client.session.create({ location, agent: "gestor" });
  console.log("\nsession.id:", session.id, "| session.model:", JSON.stringify(session.model));
  try {
    const s2 = await client.session.get({ sessionID: session.id });
    bloco("session.get", { id: s2.id, model: s2.model ?? null, agent: s2.agent ?? null });
  } catch (e) {
    console.log("session.get ERRO:", String(e?.message || e));
  }
} catch (e) {
  console.log("session.create ERRO:", String(e?.message || e));
}

process.exit(0);
