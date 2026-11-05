// abas.js
// A lista das abas do menu, na ordem em que aparecem.
// Para criar uma aba nova, acrescente uma linha aqui; todas as páginas mostram o mesmo menu.
//   id:       nome interno da aba (cada página diz qual é a sua)
//   rotulo:   o texto que aparece no menu
//   endereco: o arquivo da página
//   emBreve:  true enquanto a página ainda não existe (a aba aparece, mas sem link)

export const ABAS = [
  { id: "inicio", rotulo: "Início", endereco: "index.html" },
  { id: "simulador", rotulo: "Simulador", endereco: "simulador.html" },
  { id: "metodo", rotulo: "O Método", endereco: "metodo.html" },
];
