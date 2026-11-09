# Prob.com

Site de probabilidades do Brasileirão 2026: a Série A (foco principal e página inicial) e a Série B. Projeto pessoal, sem fins comerciais.

## O que é o projeto

O usuário nunca programou antes, então todo código e explicação devem ser pensados para um iniciante total.

- Um script em **Python** baixa os dados do campeonato e estima um modelo de Poisson (ataque α e defesa β por time, mais um fator casa h), usando máxima verossimilhança.
- Esse modelo é usado para rodar uma **simulação de Monte Carlo** — isso é feito em **JavaScript**, direto no navegador do usuário.
- Cada Brasileirão tem uma pasta em `data/` (`data/serie-a/`, `data/serie-b/`) com `jogos.json`, `modelo.json` e a
  ficha `configuracao.json`: fonte dos jogos, nº de times, faixas de posições, desempate, playoff, nomes no ge.globo.
  Os scripts recebem `--campeonato serie-b` (sem nada, Série A): `baixar_jogos.py` → `conferir_dados.py` →
  `estimar_modelo.py`. A Série A vem do football-data.org (chave `FOOTBALL_DATA_API_KEY`); a Série B, da ESPN
  (`scripts/fonte_espn_brasileirao.py`, liga `bra.2`, sem chave; o plano grátis do football-data não tem a Série B).
  O motor `site/js/simulacao.js` é o mesmo: lê as faixas da ficha e, na Série B, simula o playoff (REC 2026, Art. 13:
  3º x 6º e 4º x 5º, ida e volta; pontos, saldo, melhor campanha). "acesso" = 1º/2º + vencedores do playoff.
  Na página da Série B, o painel "Reta final" (quando faltam até 2 rodadas) mostra cada disputa em aberto com a
  chance se o time vencer, empatar ou perder o último jogo, e o quadro do playoff (candidatos a cada vaga, confrontos
  mais prováveis, quem passa). Contas em `site/js/reta-final.js` (a partir do `ultimoJogo` e `confrontosPlayoff` que
  o `simular` devolve na Série B), HTML em `componentes-reta-final.js`, visual em `css/reta-final.css`.
  A ESPN não informa a rodada da Série B: ela é calculada pela ordem dos jogos de cada time.
- Páginas do site (o menu fica em `site/js/abas.js`):
  - **Início**: mostra as probabilidades calculadas (título, rebaixamento, etc). No fim, a seção **Jogos do dia**
    (lógica em `site/js/jogos-do-dia.js`, cartão em `componentes.js`): os jogos de hoje (ou do próximo dia com jogo),
    com chances do modelo, posição, sequência recente e onde assistir. Os canais vêm do ge.globo, lidos por
    `scripts/transmissoes.py` (chamado pelo `baixar_jogos.py`) e guardados no campo `transmissao` do `jogos.json`.
    Placar ao vivo: a própria página lê a ESPN a cada minuto enquanto há jogo (a ESPN permite leitura pelo navegador;
    cada time do `jogos.json` guarda o `nome_espn`). Os jogos que a ESPN já dá como encerrados entram na tabela e nas chances na hora, sem esperar o GitHub (`atualizarComEspn`, usado no Início, no Simulador e no Meu Time). Reserva: `scripts/placar_ao_vivo.py` grava `data/ao-vivo.json` a cada
    publicação (não vai para o git). As rotinas agendadas do GitHub atrasam muito (rodam a cada ~45 min mesmo pedindo
    5), por isso nada que precise ser rápido depende delas. A montagem do site publicado
    (com `?v=<versão>` nos endereços .js/.css/.json, contra cópias velhas no navegador) fica em `scripts/montar_site.sh`.
  - **Simulador**: o usuário pode fixar resultados de jogos específicos e ver a tabela e as probabilidades mudarem em tempo real.
  - **Meu Time**: página personalizada com as cores do clube escolhido (cores em `data/cores-times.json`). A escolha
    mostra os times da Série A e, abaixo, os da Série B; os arquivos de cores, conteúdo, canais e rádios valem para os
    dois (os identificadores não se repetem). `contexto.js` carrega as duas séries e diz em qual o time joga. Conteúdo
    guardado em `data/meu-time.json` (texto, notícias e as horas de cada um). Quem atualiza (nada é gerado na visita):
    - Notícias: toda madrugada (`scripts/meu_time/atualizar_noticias.js`, sem IA); as novas se juntam às antigas (6 mais recentes).
    - Texto "Situação atual": escrito por IA (Claude Haiku 5.5, em `texto_ia.js`; reserva com frases prontas em `texto.js`)
      só para os times que jogaram, ~120 min depois do início do jogo: a rotina `.github/workflows/depois-dos-jogos.yml`
      roda `quem_jogou.js` (de graça) e, se preciso, baixa o resultado e roda `atualizar_textos.js --times ...`.
      De madrugada, `atualizar_textos.js --depois-dos-jogos` pega quem tiver ficado para trás. Chave `ANTHROPIC_API_KEY`
      no `.env` e nos secrets do GitHub. `atualizar_meu_time.js` atualiza tudo de uma vez (uso manual).
    - Vídeos: player do YouTube (youtube-nocookie) com a lista de vídeos de cada canal (`UULF` + código do canal),
      uma playlist (`PL...`) ou um vídeo avulso, conforme `data/canais-youtube.json`. A lista de vídeos de cada
      time fica guardada em `data/meu-time.json` e só muda 20 horas depois do início de cada jogo dele (pedido do usuário):
      `quem_jogou.js` decide e `atualizar_videos.js` busca na YouTube Data API (chave `YOUTUBE_API_KEY`). Sem lista
      guardada, o player mostra a lista do próprio YouTube. Regras comuns à página e ao script em `site/js/videos.js`.
      Não usar os feeds RSS do YouTube: o robots.txt deles proíbe.
    - Rádios ("Oldschool / Old is cool"): player próprio (`<audio>`, e hls.js sob demanda para .m3u8) com as transmissões
      publicadas pela RadiosNet, em `data/radios.json` (só endereços https). O player da própria RadiosNet só funciona em
      http, por isso não serve. `scripts/meu_time/atualizar_radios.py` confere os endereços de madrugada.
    - Não escrever na página de quanto em quanto tempo cada parte é atualizada (pedido do usuário).
  - **Campeonatos** (menu suspenso com três seções): **Série B** (`site/serie-b.html`: a mesma página e o mesmo
    `simulador.js` do Simulador, com `<body data-campeonato="serie-b">`; a página inicial mostra os jogos do dia
    da Série B abaixo dos da Série A, com o botão "Ver Série B"), **Copas** (Copa Sul-Americana, ver abaixo) e
    **Estaduais** (Catarinense, Gaúcho, Paranaense e Paulista). Para um novo estadual, acrescentar uma linha em
    `abas.js` (com o símbolo em `assets/simbolos/`).
- **Copas 2026** (Libertadores, Copa do Brasil e Sul-Americana; `site/libertadores.html`, `copa-do-brasil.html`,
  `sulamericana.html`): usam o motor e a página dos estaduais (`estadual.js`), com o formato de cada uma em
  `site/js/copas/<copa>-2026.js` (registrado em `formatos.js`) e os dados em `data/copas/<copa>-2026/`.
  - Libertadores e Sul-Americana: regras do Manual de Clubes CONMEBOL 2026 (desempate por confronto direto primeiro,
    "numeração" da CONMEBOL para o mando da volta, chaves sorteadas que valem até a final, final em campo neutro com
    prorrogação). As fases preliminares ficam de fora; na Sula, os 8 que vieram da Libertadores têm grupo `LIB`.
  - Copa do Brasil: mata-mata do começo ao fim (sem grupos: todos os times no "grupo" `CDB`), a partir da 5ª fase
    (as quatro primeiras ficam de fora); confrontos e mandos sorteados a cada fase (antes do sorteio, a simulação
    sorteia); pênaltis direto no empate; final em jogo único em Brasília (campo neutro, sem prorrogação). Enquanto os
    finalistas não são conhecidos, a ESPN mostra a final com times "TBD" e ela fica fora do arquivo.
  - Modelo das copas (`estimar_estadual.py`, quando a pasta é `data/copas/`): além dos jogos da copa, entram os
    jogos do Brasileirão (Séries A e B, só as que têm time na copa) até cada momento, numa estimação só (pedido do
    usuário: com só 7 ou 8 jogos de copa, um time do Z4 parecia mais forte que o vice-líder). Os estrangeiros ficam
    na mesma régua pelos jogos das copas. Jogos em campo neutro não têm fator casa.
  - Ordem para atualizar (a rotina diária do GitHub faz isso): `scripts/copas/baixar_<copa>.py` (ESPN; ferramentas
    comuns em `scripts/copas/comum_copas.py`) → `estimar_estadual.py <copa>-2026` → `calcular_chances.js <copa>-2026`.
    Na Libertadores e na Copa do Brasil os times saem sozinhos dos dados: clube brasileiro com o mesmo id, nome e
    escudo do Brasileirão (e, por isso, as mesmas cores e a mesma loja de ingressos); os outros com id feito do nome
    e país pelo estádio onde jogam em casa. A Sula tem a lista de times feita à mão.
  - Jogos do dia: quando o dia das copas (o mais próximo entre elas) vem antes ou junto do das Séries A e B, as copas
    desse dia aparecem primeiro (Libertadores, Copa do Brasil, Sul-Americana) e as Séries A e B só se jogarem no mesmo
    dia (pedido do usuário). Lógica em `copasNoDia` (`jogos-do-dia.js`); a lista das copas fica em `COPAS`
    (`inicio.js`). Nos cartões: país só em copa internacional; num jogo de volta, o placar da ida; ingressos só fora
    de campo neutro. Os times das copas não entram no Meu Time (pedido do usuário).
- **Na disputa** (páginas de copa/estadual enquanto o mata-mata está rolando, ou seja, a 1ª fase acabou e ainda não
  há campeão): no topo, só os times que ainda podem ser campeões (pedido do usuário). Um painel por confronto em
  aberto, com um lado para cada time nas cores do clube (`data/cores-times.json`): chance de passar de fase e de
  título, últimos jogos, caminho até aqui e vídeos do YouTube (canal oficial em `data/canais-youtube.json`; o player
  só carrega no clique). No meio, o próximo jogo (data, contagem, onde assistir, placar ao vivo da ESPN), as chances
  do jogo pelo modelo e a comparação das campanhas. O gráfico e as tabelas com todos os times ficam recolhidos em
  "Como chegamos até aqui". Lógica em `site/js/estaduais/mata-mata.js`, HTML em `site/js/componentes-duelo.js`,
  visual em `site/css/duelo.css`; o `estadual.js` liga tudo. O painel também tem o botão "Comprar ingressos" do
  mandante do próximo jogo (some na hora do jogo; nada em campo neutro) e passa a buscar o placar ao vivo sozinho
  na hora do jogo.
  - **O Método**: explica o modelo para o grande público.
- Botão "Comprar ingressos" (regras em `site/js/ingressos.js`): no Meu Time, só no primeiro próximo jogo; nos Jogos do
  dia, em cada jogo, e some na hora do início. Leva à loja oficial do mandante, em `data/ingressos.json` (só endereços
  conferidos; clube sem loja fica sem botão).
- Contador de acessos: GoatCounter (sem cookies), ligado em `site/js/contador.js` (código `CODIGO`; vazio = desligado;
  não conta no localhost). Painel só local (fora do git, pedido do usuário): `painel/acessos.html`, com os números baixados por
  `scripts/painel/baixar_acessos.py` (`GOATCOUNTER_CODIGO` e `GOATCOUNTER_TOKEN` no `.env`) para `painel/dados/`
  (fora do git). Sem dados, o painel mostra `painel/exemplo-acessos.json` com aviso.
- Inspirado no projeto "Probabilidades no Futebol" da UFMG, mas com modelo e código próprios.
- Estaduais (Catarinense, Gaúcho, Paranaense e Paulista): cada edição tem o seu formato em
  `site/js/estaduais/<campeonato>-<ano>.js` (registrado em `formatos.js`), seguindo o regulamento (REC) daquele ano.
  As chances de cada "momento" (rodada, fase do mata-mata) são calculadas com o mesmo motor do site, no Node.js, e
  guardadas em `data/estaduais/<campeonato>-<ano>/chances.json`.
  Ordem para atualizar: `baixar_<campeonato>.py` → `estimar_estadual.py` → `calcular_chances.js`.
  Fontes dos jogos: Catarinense no sisgol da FCF; Gaúcho e Paulista na ESPN (leitor comum em `scripts/estaduais/espn.py`);
  Paranaense no site da Federação Paranaense (pênaltis anotados à mão no script, porque o site não mostra).
  Clubes que também estão no Brasileirão usam o mesmo escudo de lá (`comum.copiar_escudos_do_brasileirao`).
  O teste de cada estadual confere que, com todos os jogos reais, a simulação reproduz o que aconteceu.

## Regras para trabalhar neste projeto

1. **Sempre explicar o código em português, como se fosse para alguém que nunca programou.** Evitar jargão sem explicar o que significa. Preferir explicações curtas e diretas, com exemplos quando ajudar.
2. **Separar dados, lógica e visual em arquivos diferentes.** Não misturar, por exemplo, cálculo do modelo estatístico com código de exibição na tela. Isso ajuda a entender e corrigir cada parte isoladamente.
3. **Nunca colocar chaves de API (ou qualquer segredo) diretamente no código.** Chaves devem ficar em um arquivo `.env`, que nunca deve ser enviado ao git (deve estar listado no `.gitignore`).

## Estrutura de pastas

- `data/` — dados baixados ou gerados (ex.: resultados de jogos, tabelas). Brasileirão em `data/serie-a/` e
  `data/serie-b/`; estaduais em `data/estaduais/`; copas (Sul-Americana) em `data/copas/`.
- `scripts/` — scripts em Python (coleta de dados, estimação do modelo). Estaduais em `scripts/estaduais/`; copas em `scripts/copas/`.
- `site/` — arquivos do site (HTML, CSS, JavaScript da simulação e das páginas).
- `assets/escudos/` — imagens dos escudos dos times (Séries A e B, pelo mesmo identificador dos dados), com subpastas `catarinense/` e `gaucho/`.
- `testes/` — testes automáticos (`npm test`; antes, uma vez, `npm install` para baixar as bibliotecas do Node).
