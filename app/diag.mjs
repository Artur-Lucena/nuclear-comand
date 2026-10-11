// Probe: mostra cada passo (evento) de uma ordem do GESTOR, com tempo.
import { OpenCode } from "@opencode/client";
import { Service } from "@opencode/client/service";

const dir = process.argv[2];
const ordem = process.argv[3] || "Liste os arquivos .md do projeto e diga quantos sao, em uma linha.";

const t0 = Date.now();
const ep = await Service.ensure();
const client = OpenCode.make({ baseUrl: ep.url, headers: Service.headers(ep) });
const session = await client.session.create({ location: { directory: dir }, agent: "gestor" });
console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] sessao ${session.id}`);

let terminou;
const fim = new Promise((r) => (terminou = r));
const sub = (async () => {
  for await (const ev of client.event.subscribe()) {
    const d = ev.data || {};
    if (d.sessionID !== session.id) continue;
    const t = ((Date.now() - t0) / 1000).toFixed(1);
    const extra = [];
    if (ev.type === "session.text.delta") extra.push(`+${(d.delta || "").length}ch`);
    if (d.tool) extra.push("tool=" + d.tool);
    if (d.name) extra.push("name=" + d.name);
    if (d.error) extra.push("error=" + JSON.stringify(d.error).slice(0, 220));
    console.log(`[${t}s] ${ev.type} ${extra.join(" ")}`);
    if (/^session\.execution\.(succeeded|failed|interrupted)$/.test(ev.type)) terminou();
  }
})().catch(() => {});

await client.session.prompt({ sessionID: session.id, text: ordem });
await Promise.race([fim, new Promise((r) => setTimeout(r, 150000))]);
await new Promise((r) => setTimeout(r, 800));
console.log(`TOTAL ${((Date.now() - t0) / 1000).toFixed(1)}s`);
process.exit(0);
