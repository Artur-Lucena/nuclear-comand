const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const { startServer } = require("./servidor.js");

function request(port, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: "127.0.0.1",
      port,
      path,
      method: "POST",
      headers,
    }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, body }));
    });
    req.on("error", reject);
    req.end("{}");
  });
}

test("API local recusa hosts externos e POST sem cabeçalho do painel", async (t) => {
  let chamadas = 0;
  const server = await new Promise((resolve, reject) => {
    startServer({ portStart: 0, tries: 0, routes: {
      "/api/ps": (_req, res) => { chamadas++; res.end("executou"); },
    } }, (_port, instance) => instance ? resolve(instance) : reject(new Error("Servidor indisponível")));
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const { address, port } = server.address();
  assert.equal(address, "127.0.0.1");

  const hostExterno = await request(port, "/api/ps", {
    Host: `example.com:${port}`,
    "X-Nuclear-Command-Request": "1",
  });
  assert.equal(hostExterno.status, 403);

  const semCabecalho = await request(port, "/api/ps");
  assert.equal(semCabecalho.status, 403);
  assert.equal(chamadas, 0);

  const valido = await request(port, "/api/ps", { "X-Nuclear-Command-Request": "1" });
  assert.equal(valido.status, 200);
  assert.equal(valido.body, "executou");
  assert.equal(chamadas, 1);
});
