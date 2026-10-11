// Dump resumido das mensagens de uma sessao (para inspecionar o retorno do subagente).
import { OpenCode } from "@opencode/client";
import { Service } from "@opencode/client/service";

const sid = process.argv[2];
const ep = await Service.ensure();
const client = OpenCode.make({ baseUrl: ep.url, headers: Service.headers(ep) });

const msgs = await client.message.list({ sessionID: sid });
const arr = msgs.data || msgs;
console.log("mensagens:", arr.length);
for (const m of arr) {
  console.log("KEY", Object.keys(m).join(","));
  console.log(JSON.stringify(m).slice(0, 900));
  console.log("---");
}
process.exit(0);
