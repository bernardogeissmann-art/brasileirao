// abas.js
// A lista das abas do menu, na ordem em que aparecem.
// Para criar uma aba nova, acrescente uma linha aqui; todas as páginas mostram o mesmo menu.
//   id:       nome interno da aba (cada página diz qual é a sua)
//   rotulo:   o texto que aparece no menu
//   endereco: o arquivo da página
//   itens:    (opcional) transforma a aba num menu suspenso com estas opções;
//             cada opção pode ter um "simbolo" (imagem mostrada ao lado do nome)

export const ABAS = [
  { id: "inicio", rotulo: "Início", endereco: "index.html" },
  { id: "simulador", rotulo: "Simulador", endereco: "simulador.html" },
  { id: "meu-time", rotulo: "Meu Time", endereco: "meu-time.html" },
  {
    id: "estaduais",
    rotulo: "Estaduais",
    // Para acrescentar um campeonato estadual, basta uma linha nova aqui.
    itens: [
      { id: "catarinense", rotulo: "Campeonato Catarinense", endereco: "catarinense.html", simbolo: "assets/simbolos/catarinense.png" },
      { id: "gaucho", rotulo: "Campeonato Gaúcho", endereco: "gaucho.html", simbolo: "assets/simbolos/gaucho.png" },
    ],
  },
  { id: "metodo", rotulo: "O Método", endereco: "metodo.html" },
];
