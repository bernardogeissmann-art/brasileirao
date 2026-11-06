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
    Placar ao vivo: `scripts/placar_ao_vivo.py` lê a ESPN e grava `data/ao-vivo.json` (não vai para o git; só existe
    na cópia publicada). A rotina `.github/workflows/placar-ao-vivo.yml` roda a cada 5 minutos das 11h à meia-noite e
    só republica quando há jogo rolando (do horário marcado até 130 minutos depois). A montagem do site publicado
    (com `?v=<versão>` nos endereços .js/.css/.json, contra cópias velhas no navegador) fica em `scripts/montar_site.sh`.
  - **Simulador**: o usuário pode fixar resultados de jogos específicos e ver a tabela e as probabilidades mudarem em tempo real.
  - **Meu Time**: página personalizada com as cores do clube escolhido. O texto "Situação atual" e as
    notícias são gerados por `scripts/meu_time/atualizar_meu_time.js` (quartas e domingos, 23h) e ficam em
    `data/meu-time.json`; as cores dos clubes ficam em `data/cores-times.json`. O texto é escrito por IA
    (Claude, da Anthropic) em `scripts/meu_time/texto_ia.js`, com a chave `ANTHROPIC_API_KEY` (no `.env` e nos
    secrets do GitHub). Sem chave, ou se a IA falhar, usa as frases prontas de `scripts/meu_time/texto.js`.
    No fim da página, a seção Vídeos: o player do próprio YouTube (youtube-nocookie, lista "UULF" + código do canal =
    últimos vídeos, sem Shorts) para os canais de cada time em `data/canais-youtube.json` (imprensa dedicada ou oficial).
    O player se atualiza sozinho; não há script diário. Não usar os feeds RSS do YouTube: o robots.txt deles proíbe.
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
