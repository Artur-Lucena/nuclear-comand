const assert = require("node:assert/strict");
const test = require("node:test");
const { mensagemOpenCode } = require("./opencode-error.js");

test("mostra orientação útil quando o provedor atinge a cota", () => {
  assert.match(
    mensagemOpenCode({ type: "provider.quota", message: "Rate limit exceeded.", status: 429 }),
    /Limite de uso do modelo atingido/,
  );
});

test("preserva a mensagem de outros erros estruturados", () => {
  assert.equal(mensagemOpenCode({ type: "provider.auth", message: "Credenciais inválidas" }), "Credenciais inválidas");
  assert.equal(mensagemOpenCode(new Error("Conexão perdida")), "Conexão perdida");
});
