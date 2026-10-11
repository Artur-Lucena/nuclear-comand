// Smoke test do app em execução: envia uma ordem para /api/chat e imprime a resposta.
const resp = await fetch("http://localhost:5173/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ text: process.argv[2] || "Responda apenas com: APP OK" }),
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
    if (ev === "delta") texto += j.d || "";
    else if (ev === "passo") console.log("PASSO:", JSON.stringify(j));
    else if (ev === "error") console.log("ERRO:", j.message);
  }
}
console.log("RESPOSTA:", JSON.stringify(texto));
process.exit(0);
