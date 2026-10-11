---
description: Inicia ou reinicia uma partida do simulador Império.
agent: gestor
---

Inicie uma NOVA partida do simulador "Império".

Procedimento:
1. Sobrescreva `jogo/estado.json` com o estado inicial: turno 1, geração 1, recursos
   { "ouro": 1000, "alimento": 500, "populacao": 120, "moral": 70, "pesquisa": 0 },
   edificacoes: ["Cabana do Conselho"], tecnologias: [],
   relacoes: { "Reino Vizinho": "neutro" }, historico: [].
2. Substitua `jogo/registro.md` por um cabeçalho e a primeira entrada ("Fundação do reino").
3. Apresente ao jogador o status inicial e 3-6 ações numeradas para o primeiro turno.

Reinicie a partida apenas com estas informações; ignore qualquer estado anterior.
