# Prob.com

Site de probabilidades do Brasileirão Série A 2026. Projeto pessoal, sem fins comerciais.

## O que é o projeto

O usuário nunca programou antes, então todo código e explicação devem ser pensados para um iniciante total.

- Um script em **Python** baixa os dados do campeonato e estima um modelo de Poisson (ataque α e defesa β por time, mais um fator casa h), usando máxima verossimilhança.
- Esse modelo é usado para rodar uma **simulação de Monte Carlo** — isso é feito em **JavaScript**, direto no navegador do usuário.
- Páginas do site (o menu fica em `site/js/abas.js`):
  - **Início**: mostra as probabilidades calculadas (título, rebaixamento, etc). No fim, a seção **Jogos do dia**
    (lógica em `site/js/jogos-do-dia.js`, cartão em `componentes.js`): os jogos de hoje (ou do próximo dia com jogo),
    com chances do modelo, posição, sequência recente e onde assistir. Os canais vêm do ge.globo, lidos por
    `scripts/transmissoes.py` (chamado pelo `baixar_jogos.py`) e guardados no campo `transmissao` do `jogos.json`.
    Placar ao vivo: a própria página lê a ESPN a cada minuto enquanto há jogo (a ESPN permite leitura pelo navegador;
    cada time do `jogos.json` guarda o `nome_espn`). Reserva: `scripts/placar_ao_vivo.py` grava `data/ao-vivo.json` a cada
    publicação (não vai para o git). As rotinas agendadas do GitHub atrasam muito (rodam a cada ~45 min mesmo pedindo
    5), por isso nada que precise ser rápido depende delas. A montagem do site publicado
    (com `?v=<versão>` nos endereços .js/.css/.json, contra cópias velhas no navegador) fica em `scripts/montar_site.sh`.
  - **Simulador**: o usuário pode fixar resultados de jogos específicos e ver a tabela e as probabilidades mudarem em tempo real.
  - **Meu Time**: página personalizada com as cores do clube escolhido (cores em `data/cores-times.json`). Conteúdo
    guardado em `data/meu-time.json` (texto, notícias e as horas de cada um). Quem atualiza (nada é gerado na visita):
    - Notícias: toda madrugada (`scripts/meu_time/atualizar_noticias.js`, sem IA); as novas se juntam às antigas (6 mais recentes).
    - Texto "Situação atual": escrito por IA (Claude Haiku 5.5, em `texto_ia.js`; reserva com frases prontas em `texto.js`)
      só para os times que jogaram, ~30 min depois do fim do jogo: a rotina `.github/workflows/depois-dos-jogos.yml`
      roda `quem_jogou.js` (de graça) e, se preciso, baixa o resultado e roda `atualizar_textos.js --times ...`.
      De madrugada, `atualizar_textos.js --depois-dos-jogos` pega quem tiver ficado para trás. Chave `ANTHROPIC_API_KEY`
      no `.env` e nos secrets do GitHub. `atualizar_meu_time.js` atualiza tudo de uma vez (uso manual).
    - Vídeos: player do YouTube (youtube-nocookie) com a lista de vídeos de cada canal (`UULF` + código do canal),
      uma playlist (`PL...`) ou um vídeo avulso, conforme `data/canais-youtube.json`. Se atualiza sozinho.
      Não usar os feeds RSS do YouTube: o robots.txt deles proíbe.
    - Rádios ("Oldschool / Old is cool"): player próprio (`<audio>`, e hls.js sob demanda para .m3u8) com as transmissões
      publicadas pela RadiosNet, em `data/radios.json` (só endereços https). O player da própria RadiosNet só funciona em
      http, por isso não serve. `scripts/meu_time/atualizar_radios.py` confere os endereços de madrugada.
    - Não escrever na página de quanto em quanto tempo cada parte é atualizada (pedido do usuário).
  - **Estaduais** (menu suspenso): Catarinense, Gaúcho, Paranaense e Paulista. Para um novo estadual, acrescentar
    uma linha em `abas.js` (com o símbolo em `assets/simbolos/`).
  - **O Método**: explica o modelo para o grande público.
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

- `data/` — dados baixados ou gerados (ex.: resultados de jogos, tabelas). Estaduais em `data/estaduais/`.
- `scripts/` — scripts em Python (coleta de dados, estimação do modelo). Estaduais em `scripts/estaduais/`.
- `site/` — arquivos do site (HTML, CSS, JavaScript da simulação e das páginas).
- `assets/escudos/` — imagens dos escudos dos times (Brasileirão), com subpastas `catarinense/` e `gaucho/`.
- `testes/` — testes automáticos (`npm test`; antes, uma vez, `npm install` para baixar as bibliotecas do Node).
