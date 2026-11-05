# comum.py
# Ferramentas usadas pelos scripts dos campeonatos estaduais (Catarinense e Gaúcho):
# baixar páginas, salvar JSON, baixar escudos e numerar as rodadas.
# Este arquivo não é rodado sozinho: os outros scripts desta pasta usam as funções daqui.

import json
import time as time_module   # "time" já é o nome que usamos para um time de futebol
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

# scripts/estaduais/comum.py -> sobe 3 pastas até a pasta do projeto.
PASTA_PROJETO = Path(__file__).resolve().parent.parent.parent
FUSO_BRASILIA = timezone(timedelta(hours=-3))

# Nos apresentamos com um nome honesto: sites públicos pedem que robôs se identifiquem.
CABECALHOS = {"User-Agent": "ProbCom/1.0 (projeto pessoal de estatistica)"}
PAUSA_ENTRE_DOWNLOADS = 1.5   # segundos


def baixar(url):
    """Baixa um endereço e devolve o conteúdo em bytes."""
    pedido = urllib.request.Request(url, headers=CABECALHOS)
    with urllib.request.urlopen(pedido, timeout=60) as resposta:
        return resposta.read()


def baixar_json(url):
    return json.loads(baixar(url).decode("utf-8"))


def salvar_json(caminho, dados):
    caminho.parent.mkdir(parents=True, exist_ok=True)
    caminho.write_text(json.dumps(dados, ensure_ascii=False, indent=2), encoding="utf-8")


def agora_iso():
    return datetime.now(FUSO_BRASILIA).isoformat(timespec="seconds")


def formato_imagem(conteudo):
    """Diz se os bytes são uma imagem PNG, SVG ou JPG (ou None se não for imagem)."""
    if conteudo.startswith(b"\x89PNG"):
        return ".png"
    if conteudo.startswith(b"\xff\xd8"):
        return ".jpg"
    if b"<svg" in conteudo[:5000].lower():
        return ".svg"
    return None


def baixar_com_paciencia(url, tentativas=4):
    """Baixa um endereço; se o site pedir para esperar (erro 429, "muitos pedidos"),
    espera o tempo que ele pedir e tenta de novo."""
    for tentativa in range(1, tentativas + 1):
        try:
            return baixar(url)
        except urllib.error.HTTPError as erro:
            if erro.code != 429 or tentativa == tentativas:
                raise
            espera = int(erro.headers.get("Retry-After", "0") or 0) or 15 * tentativa
            print(f"    o site pediu para esperar; tentando de novo em {espera} s...")
            time_module.sleep(espera)


def baixar_escudos(times, pasta_escudos, endereco_do_escudo):
    """Baixa o escudo de cada time para a pasta indicada, com o nome igual ao id do time.
    "endereco_do_escudo" é uma função que recebe o id do time e devolve o endereço da imagem.
    Escudos que já estão na pasta são reaproveitados (para baixar de novo, apague o arquivo).
    Anota o caminho em times[id]["escudo"] e devolve a lista de problemas."""
    pasta_escudos.mkdir(parents=True, exist_ok=True)
    problemas = []
    for id_time, time in times.items():
        time["escudo"] = None
        existente = next(pasta_escudos.glob(f"{id_time}.*"), None)
        if existente:
            time["escudo"] = existente.relative_to(PASTA_PROJETO).as_posix()
            continue
        url = endereco_do_escudo(id_time)
        if not url:
            problemas.append(f"{time['nome']}: sem endereço de escudo")
            continue
        # Uma pausa entre os downloads, para não sobrecarregar o site.
        time_module.sleep(PAUSA_ENTRE_DOWNLOADS)
        try:
            conteudo = baixar_com_paciencia(url)
        except OSError as erro:
            problemas.append(f"{time['nome']}: não consegui baixar ({erro})")
            continue
        formato = formato_imagem(conteudo)
        if formato is None:
            problemas.append(f"{time['nome']}: o arquivo baixado não é uma imagem")
            continue
        for antigo in pasta_escudos.glob(f"{id_time}.*"):
            antigo.unlink()
        (pasta_escudos / f"{id_time}{formato}").write_bytes(conteudo)
        # Caminho a partir da pasta do projeto, com barras "/" (funciona no site).
        time["escudo"] = (pasta_escudos / f"{id_time}{formato}").relative_to(PASTA_PROJETO).as_posix()
    return problemas


def numerar_rodadas(jogos):
    """Numera as rodadas de uma fase em que cada time joga uma vez por rodada.
    Percorre os jogos em ordem de data; quando um time aparece pela segunda vez,
    começa uma rodada nova. Altera o campo "rodada" de cada jogo."""
    rodada = 1
    times_na_rodada = set()
    for jogo in sorted(jogos, key=lambda j: j["data"]):
        if jogo["mandante"] in times_na_rodada or jogo["visitante"] in times_na_rodada:
            rodada += 1
            times_na_rodada = set()
        jogo["rodada"] = rodada
        times_na_rodada.update((jogo["mandante"], jogo["visitante"]))


def numerar_pernas(jogos):
    """Num mata-mata de ida e volta, marca "perna" 1 (ida) e 2 (volta) em cada confronto."""
    por_confronto = {}
    for jogo in jogos:
        por_confronto.setdefault(jogo["confronto"], []).append(jogo)
    for lista in por_confronto.values():
        for perna, jogo in enumerate(sorted(lista, key=lambda j: j["data"]), start=1):
            jogo["perna"] = perna


def conferir_basico(dados, total_jogos, total_times):
    """Checagens mínimas antes de salvar. Devolve a lista de problemas."""
    problemas = []
    if len(dados["times"]) != total_times:
        problemas.append(f"{len(dados['times'])} times (esperado: {total_times})")
    if len(dados["jogos"]) > total_jogos:
        problemas.append(f"{len(dados['jogos'])} jogos (no máximo {total_jogos})")
    for jogo in dados["jogos"]:
        for lado in ("mandante", "visitante"):
            if jogo[lado] not in dados["times"]:
                problemas.append(f"jogo {jogo['id']}: time desconhecido {jogo[lado]}")
        if jogo["disputado"] and (jogo["gols_mandante"] is None or jogo["gols_visitante"] is None):
            problemas.append(f"jogo {jogo['id']}: encerrado sem placar")
    return problemas
