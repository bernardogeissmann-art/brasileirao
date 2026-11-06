#!/usr/bin/env bash
# montar_site.sh
# Monta a pasta _site/ com só o que vai para a internet (nada de scripts, .env etc.).
# É usado pelas duas rotinas do GitHub que publicam o site: a normal
# (atualizar-e-publicar.yml) e a do placar ao vivo (placar-ao-vivo.yml).
#
# Como rodar (na pasta do projeto, num terminal bash):  bash scripts/montar_site.sh

set -euo pipefail   # para na primeira linha que der erro

rm -rf _site
mkdir -p _site/data
cp index.html _site/
cp -r site assets _site/
cp data/jogos.json data/modelo.json data/meu-time.json data/cores-times.json _site/data/
cp -r data/estaduais _site/data/
# O placar ao vivo só existe se o placar_ao_vivo.py acabou de rodar.
if [ -f data/ao-vivo.json ]; then
  cp data/ao-vivo.json _site/data/
fi

# Número da versão nos endereços dos arquivos .js, .css e .json (ex.: inicio.js?v=a7cd2be).
# O navegador guarda cópias por até 10 minutos; com um endereço novo a cada versão, quem
# visita logo depois de uma publicação recebe os arquivos novos, e não uma mistura.
VERSAO="$(git rev-parse --short=7 HEAD)"
find _site/site \( -name '*.html' -o -name '*.js' \) -print0 \
  | xargs -0 sed -i -E "s/\.(js|css|json)([\"'])/.\1?v=${VERSAO}\2/g"
echo "Site montado em _site/ (versão $VERSAO)."
