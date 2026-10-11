// Valida a sintaxe dos blocos <script> embutidos em um HTML (sem executar).
import { readFileSync } from "fs";

const html = readFileSync(process.argv[2], "utf8");
const re = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
let m, n = 0, erros = 0;
while ((m = re.exec(html))) {
  n++;
  const code = m[1];
  if (!code.trim()) continue;
  try {
    new Function(code); // só compila, não executa
    console.log(`bloco ${n}: OK (${code.length} chars)`);
  } catch (e) {
    erros++;
    console.log(`bloco ${n}: ERRO DE SINTAXE -> ${e.message}`);
  }
}
console.log(erros ? `FALHOU: ${erros} bloco(s) com erro` : `OK: ${n} bloco(s) sem erro de sintaxe`);
process.exit(erros ? 1 : 0);
