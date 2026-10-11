// -----------------------------------------------------------------------------
// probe-switch.mjs -- documentacao viva: forma aceita por session.switchModel.
//
// ACHADO EMPIRICO (mantido como referencia):
//   session.switchModel({ sessionID, model: { id, providerID } })   <- CORRETO
//   session.switchModel({ sessionID, model: { modelID, providerID } }) <- ERRO:
//       "Missing key at [\"model\"][\"id\"]"
// A rota POST /api/modelo recebe { providerID, modelID } (contrato do front) e
// converte para { model: { id: modelID, providerID } } internamente.
// -----------------------------------------------------------------------------
import path from "node:path";
import { fileURLToPath } from "node:url";
import { OpenCode } from "@opencode/client";
import { Service } from "@opencode/client/service";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJETO_DIR = path.resolve(__dirname, "..");

const ep = await Service.ensure();
const client = OpenCode.make({ baseUrl: ep.url, headers: Service.headers(ep) });
const location = { directory: PROJETO_DIR };

const session = await client.session.create({ location, agent: "gestor" });
console.log("sessao:", session.id, "| model inicial:", JSON.stringify((await client.session.get({ sessionID: session.id })).model));

const modelos = (await client.model.list({ location })).data || [];
console.log("modelos disponiveis:", modelos.map((m) => `${m.providerID}/${m.modelID}`).join(", "));

// alvo: primeiro modelo diferente do default (big-pickle)
const alvo = modelos.find((m) => m.modelID !== "big-pickle") || modelos[0];
console.log("alvo:", JSON.stringify({ id: alvo.id, modelID: alvo.modelID, providerID: alvo.providerID }));

// A) forma do TypeScript gerado: { id, providerID }
try {
  await client.session.switchModel({ sessionID: session.id, model: { id: alvo.id, providerID: alvo.providerID } });
  const s = await client.session.get({ sessionID: session.id });
  console.log("A {id,providerID}: OK -> model agora:", JSON.stringify(s.model));
} catch (e) {
  console.log("A {id,providerID}: ERRO ->", String(e?.message || e));
}

// B) forma citada no briefing: { modelID, providerID }
try {
  const alvo2 = modelos.find((m) => m.modelID === "big-pickle") || alvo;
  await client.session.switchModel({ sessionID: session.id, model: { modelID: alvo2.modelID, providerID: alvo2.providerID } });
  const s = await client.session.get({ sessionID: session.id });
  console.log("B {modelID,providerID}: OK -> model agora:", JSON.stringify(s.model));
} catch (e) {
  console.log("B {modelID,providerID}: ERRO ->", String(e?.message || e));
}

// C) forma extra identificada: { id, providerID, variant }
try {
  await client.session.switchModel({ sessionID: session.id, model: { id: alvo.id, providerID: alvo.providerID } });
  const s = await client.session.get({ sessionID: session.id });
  console.log("C (reverso) model:", JSON.stringify(s.model));
} catch (e) {
  console.log("C ERRO ->", String(e?.message || e));
}

process.exit(0);
