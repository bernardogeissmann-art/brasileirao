# transmissoes.py
# Descobre onde assistir (TV e internet) aos próximos jogos do Brasileirão e anota no campo
# "transmissao" de cada jogo (ex.: ["Premiere", "sportv"]).
#
# Nem o football-data.org nem a ESPN informam isso. Quem informa é o ge.globo:
#   1) a página da tabela do Brasileirão traz os jogos da rodada atual, cada um com o
#      endereço da sua página;
#   2) a página de cada jogo traz a lista "onde assistir" (liveWatchSources).
# Lemos poucas páginas por dia (só os jogos da rodada que ainda não acabaram), com pausa entre elas.
#
# Este arquivo não é rodado sozinho: o baixar_jogos.py usa a função anotar_transmissoes().
# Se o ge mudar a página ou estiver fora do ar, os jogos só ficam sem transmissão.

import json
import re
import time
import urllib.request

CABECALHOS = {"User-Agent": "ProbCom/1.0 (projeto pessoal de estatistica)"}
PAUSA_ENTRE_PAGINAS = 1.0   # segundos

# O endereço da tabela no ge e o nome de cada time lá (-> o nosso identificador) ficam na
# ficha de cada campeonato (data/<campeonato>/configuracao.json, campo "ge").

# O ge mistura propagandas dos próprios produtos na lista: estes nomes não são canais.
NAO_SAO_CANAIS = {"Cartola"}
# Grafia oficial de alguns canais (o ge às vezes escreve diferente).
GRAFIA = {"Prime Vídeo": "Prime Video"}


def baixar_pagina(url):
    pedido = urllib.request.Request(url, headers=CABECALHOS)
    with urllib.request.urlopen(pedido, timeout=60) as resposta:
        return resposta.read().decode("utf-8", errors="replace")


def jogos_da_rodada(pagina):
    """Os jogos da rodada atual que aparecem na página da tabela. Cada jogo é um pedaço de
    JSON que começa com {"data_realizacao": ...}; o "decodificador" lê um pedaço de cada vez."""
    decodificador = json.JSONDecoder()
    jogos = {}
    for achado in re.finditer(r'\{"data_realizacao"', pagina):
        try:
            jogo, _ = decodificador.raw_decode(pagina, achado.start())
        except ValueError:
            continue
        jogos[jogo["id"]] = jogo   # pelo número do jogo: a página repete alguns
    return list(jogos.values())


def canais_do_jogo(pagina):
    """Os canais da lista "onde assistir" da página de um jogo (sem repetir e sem propagandas)."""
    inicio = pagina.find('"liveWatchSources":')
    if inicio < 0:
        return []
    lista, _ = json.JSONDecoder().raw_decode(pagina, inicio + len('"liveWatchSources":'))
    canais = []
    for fonte in lista or []:
        nome = (fonte.get("name") or "").strip()
        nome = GRAFIA.get(nome, nome)
        if nome and nome not in NAO_SAO_CANAIS and nome not in canais:
            canais.append(nome)
    return canais


def anotar_transmissoes(dados, ge):
    """ge: o campo "ge" da ficha do campeonato ({"endereco": ..., "nomes": {...}}).
    Coloca o campo "transmissao" em cada jogo (a lista de canais, ou None quando não se sabe).
    Devolve (quantos jogos ganharam transmissão, lista de avisos)."""
    for jogo in dados["jogos"]:
        jogo["transmissao"] = None
    # Canais anotados à mão na ficha (ge.canais_a_mais), que o ge não mostra ou mostra tarde
    # (ex.: um jogo adiado, que fica fora da rodada atual). Entram antes e somam-se aos do ge.
    a_mais = ge.get("canais_a_mais", {})
    for jogo in dados["jogos"]:
        extras = a_mais.get(f'{jogo["mandante"]} x {jogo["visitante"]}')
        if extras and not jogo.get("disputado"):
            jogo["transmissao"] = list(extras)
    try:
        rodada = jogos_da_rodada(baixar_pagina(ge["endereco"]))
    except OSError as erro:
        return 0, [f"não consegui ler a tabela do ge ({erro}); os jogos ficaram sem transmissão"]
    if not rodada:
        return 0, ["a página da tabela do ge não trouxe jogos (o formato pode ter mudado)"]

    # Cada par mandante x visitante acontece uma vez só no campeonato.
    por_par = {(j["mandante"], j["visitante"]): j for j in dados["jogos"]}
    avisos = []
    anotados = 0
    for jogo_ge in rodada:
        # Jogo encerrado não precisa mais de "onde assistir". Jogo em andamento precisa
        # (quem abre o site no meio do jogo quer saber onde está passando).
        estado = ((jogo_ge.get("transmissao") or {}).get("broadcast") or {}).get("id")
        if estado == "ENCERRADA":
            continue
        nomes = [jogo_ge["equipes"][lado]["nome_popular"] for lado in ("mandante", "visitante")]
        ids = [ge["nomes"].get(nome) for nome in nomes]
        if None in ids:
            avisos.append(f"time do ge que não está na lista ge.nomes da ficha: {nomes}")
            continue
        jogo = por_par.get(tuple(ids))
        endereco = (jogo_ge.get("transmissao") or {}).get("url")
        if jogo is None or not endereco:
            continue
        time.sleep(PAUSA_ENTRE_PAGINAS)
        try:
            canais = canais_do_jogo(baixar_pagina(endereco))
        except (OSError, ValueError) as erro:
            avisos.append(f"não consegui ler a página de {nomes[0]} x {nomes[1]} ({erro})")
            continue
        if canais:
            jogo["transmissao"] = (jogo["transmissao"] or []) + [c for c in canais if c not in (jogo["transmissao"] or [])]
            anotados += 1
    return anotados, avisos
