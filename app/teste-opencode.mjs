// Diagnóstico: lista todos os eventos da sessão.
import { OpenCode } from "@opencode/client"
import { Service } from "@opencode/client/service"

const dir = process.argv[2] || process.cwd()
const ep = await Service.ensure()
const client = OpenCode.make({ baseUrl: ep.url, headers: Service.headers(ep) })

const session = await client.session.create({ location: { directory: dir }, agent: "gestor" })
console.log("sessao:", session.id, "agent:", session.agent, "model:", JSON.stringify(session.model))

const sub = (async () => {
  try {
    for await (const ev of client.event.subscribe()) {
      if (ev.type && String(ev.type).startsWith("session.") && ev.data && ev.data.sessionID === session.id) {
        let extra = ""
        if (ev.data.delta !== undefined) extra = " delta=" + JSON.stringify(ev.data.delta)
        if (ev.data.error !== undefined) extra = " error=" + JSON.stringify(ev.data.error)
        console.log("EV", ev.type, extra)
      }
    }
  } catch (e) {
    console.log("sub erro:", String(e?.message || e))
  }
})()

await client.session.prompt({ sessionID: session.id, text: "Responda apenas com a palavra: PRONTO" })
console.log("prompt enviado, aguardando...")

const timeout = new Promise((r) => setTimeout(() => r("timeout"), 60000))
await Promise.race([client.session.wait({ sessionID: session.id }), timeout])
console.log("wait terminou")

await new Promise((r) => setTimeout(r, 1500))
try {
  const msgs = await client.message.list({ sessionID: session.id })
  console.log("MENSAGENS:", JSON.stringify(msgs).slice(0, 2000))
} catch (e) {
  console.log("message.list erro:", String(e?.message || e))
}
process.exit(0)
