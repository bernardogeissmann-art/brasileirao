// trabalhador-simulacao.js
// Um "Web Worker": um ajudante que roda separado da página. As 10.000 simulações
// acontecem aqui, então a página continua respondendo (dá para digitar e rolar)
// enquanto as contas são feitas.
//
// A página e o ajudante conversam por mensagens:
//   página -> ajudante: { tipo: "dados", dados }               (uma vez, no começo)
//   página -> ajudante: { tipo: "simular", versao, fixados, semente }
//   ajudante -> página: { versao, resultado, milissegundos }

import { simular } from "./simulacao.js";

let dados = null;

// "self" é o próprio ajudante. Ele fica esperando mensagens da página.
self.addEventListener("message", (evento) => {
  const pedido = evento.data;

  if (pedido.tipo === "dados") {
    dados = pedido.dados;
    return;
  }

  if (pedido.tipo === "simular") {
    const inicio = performance.now();
    const resultado = simular(dados, { fixados: pedido.fixados, semente: pedido.semente });
    // postMessage manda a resposta de volta para a página.
    self.postMessage({ versao: pedido.versao, resultado, milissegundos: performance.now() - inicio });
  }
});
