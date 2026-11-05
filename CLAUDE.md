# Prob.com

Site de probabilidades do Brasileirão Série A 2026. Projeto pessoal, sem fins comerciais.

## O que é o projeto

O usuário nunca programou antes, então todo código e explicação devem ser pensados para um iniciante total.

- Um script em **Python** baixa os dados do campeonato e estima um modelo de Poisson (ataque α e defesa β por time, mais um fator casa h), usando máxima verossimilhança.
- Esse modelo é usado para rodar uma **simulação de Monte Carlo** — isso é feito em **JavaScript**, direto no navegador do usuário.
- O site tem duas páginas:
  - **Página principal**: mostra as probabilidades calculadas (título, rebaixamento, etc).
  - **Página de simulador**: o usuário pode fixar resultados de jogos específicos e ver a tabela e as probabilidades mudarem em tempo real.
- Inspirado no projeto "Probabilidades no Futebol" da UFMG, mas com modelo e código próprios.

## Regras para trabalhar neste projeto

1. **Sempre explicar o código em português, como se fosse para alguém que nunca programou.** Evitar jargão sem explicar o que significa. Preferir explicações curtas e diretas, com exemplos quando ajudar.
2. **Separar dados, lógica e visual em arquivos diferentes.** Não misturar, por exemplo, cálculo do modelo estatístico com código de exibição na tela. Isso ajuda a entender e corrigir cada parte isoladamente.
3. **Nunca colocar chaves de API (ou qualquer segredo) diretamente no código.** Chaves devem ficar em um arquivo `.env`, que nunca deve ser enviado ao git (deve estar listado no `.gitignore`).

## Estrutura de pastas

- `data/` — dados baixados ou gerados (ex.: resultados de jogos, tabelas).
- `scripts/` — scripts em Python (coleta de dados, estimação do modelo).
- `site/` — arquivos do site (HTML, CSS, JavaScript da simulação e das páginas).
- `assets/escudos/` — imagens dos escudos dos times.
