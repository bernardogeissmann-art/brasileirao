# fonte_espn_brasileirao.py
# Lê os jogos de um Brasileirão na ESPN (hoje, a Série B: liga "bra.2") e monta os dados
# no MESMO formato que o baixar_jogos.py grava para a Série A. Assim o resto do projeto
# (modelo, simulação, páginas) não precisa saber de onde os jogos vieram.
#
# Por que a ESPN: o plano grátis do football-data.org só tem a Série A, e a ESPN é grátis,
# não pede chave e já é usada pelo projeto (estaduais e placar ao vivo).
#
# Este arquivo não é rodado sozinho: o baixar_jogos.py usa a função baixar_jogos().

import json
import re
import sys
import unicodedata
import urllib.request
from collections import Counter
from datetime import datetime, timedelta, timezone

CABECALHOS = {"User-Agent": "ProbCom/1.0 (projeto pessoal de estatistica)"}
URL_MES = "https://site.api.espn.com/apis/site/v2/sports/soccer/{liga}/scoreboard?dates={ano}{mes:02d}&limit=500"
FUSO_BRASILIA = timezone(timedelta(hours=-3))

# Situação do jogo na ESPN -> o mesmo código que o football-data.org usa na Série A.
# (As páginas olham, por exemplo, se o jogo está "POSTPONED", adiado.)
STATUS = {
    "STATUS_FULL_TIME": "FINISHED",
    "STATUS_FINAL": "FINISHED",
    "STATUS_SCHEDULED": "SCHEDULED",
    "STATUS_POSTPONED": "POSTPONED",
    "STATUS_CANCELED": "CANCELLED",
    "STATUS_SUSPENDED": "SUSPENDED",
    "STATUS_FIRST_HALF": "IN_PLAY",
    "STATUS_SECOND_HALF": "IN_PLAY",
    "STATUS_HALFTIME": "PAUSED",
}


def criar_id(nome):
    """Transforma o nome do time num identificador simples: "Náutico" -> "nautico"."""
    sem_acento = unicodedata.normalize("NFKD", nome).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "-", sem_acento.lower()).strip("-")


def escudo_pequeno(endereco):
    """A ESPN guarda os escudos com 500 x 500 pixels (até 300 KB). O site mostra cada um com
    36 pixels, então pedimos ao "combiner" da ESPN uma cópia de 128 x 128, bem mais leve."""
    caminho = re.match(r"https://a\.espncdn\.com(/i/teamlogos/.+\.png)$", endereco or "")
    if not caminho:
        return endereco
    return f"https://a.espncdn.com/combiner/i?img={caminho.group(1)}&w=128&h=128"


def baixar_mes(liga, ano, mes):
    pedido = urllib.request.Request(URL_MES.format(liga=liga, ano=ano, mes=mes), headers=CABECALHOS)
    with urllib.request.urlopen(pedido, timeout=60) as resposta:
        return json.loads(resposta.read().decode("utf-8"))


def baixar_eventos(liga, ano, meses):
    """Todos os jogos ("eventos", para a ESPN) dos meses indicados, sem repetir."""
    eventos = {}
    for mes in meses:
        try:
            resposta = baixar_mes(liga, ano, mes)
        except OSError as erro:
            sys.exit(f"Erro: não consegui ler a ESPN ({erro}). Confira a internet e tente de novo.")
        for evento in resposta.get("events", []):
            eventos[evento["id"]] = evento   # guardado pelo número do jogo: nunca repete
    return list(eventos.values())


def ler_evento(evento, times, nomes_corrigidos):
    """Um evento da ESPN vira um jogo no nosso formato (ou None, se os times ainda não
    foram definidos: a ESPN mostra o playoff como "TBD", "a definir")."""
    competicao = evento["competitions"][0]
    lados = {c["homeAway"]: c for c in competicao["competitors"]}
    ids = []
    for lado in (lados["home"], lados["away"]):
        time_espn = lado["team"]
        if time_espn["displayName"].startswith("TBD"):
            return None
        nome_espn = time_espn["displayName"]
        id_time = criar_id(nome_espn)
        if id_time in times and times[id_time]["id_fonte"] != int(time_espn["id"]):
            sys.exit(f"Erro: dois times diferentes geraram o mesmo identificador '{id_time}'.")
        times[id_time] = {
            "nome": nomes_corrigidos.get(nome_espn, nome_espn),
            "sigla": time_espn.get("abbreviation"),
            "id_fonte": int(time_espn["id"]),
            "escudo_url": escudo_pequeno(time_espn.get("logo")),
            "escudo": None,              # o escudos.py preenche depois
            "nome_espn": nome_espn,      # a página acha o placar ao vivo por este nome
        }
        ids.append(id_time)

    situacao = competicao["status"]["type"]
    disputado = bool(situacao.get("completed")) and situacao.get("name") != "STATUS_POSTPONED"
    data = datetime.fromisoformat(evento["date"].replace("Z", "+00:00")).astimezone(FUSO_BRASILIA)
    return {
        "id": int(evento["id"]),
        "rodada": None,   # a ESPN não informa; é calculada depois, em numerar_rodadas()
        "data": data.isoformat(),
        "mandante": ids[0],
        "visitante": ids[1],
        "disputado": disputado,
        "gols_mandante": int(lados["home"]["score"]) if disputado else None,
        "gols_visitante": int(lados["away"]["score"]) if disputado else None,
        "status_fonte": STATUS.get(situacao.get("name"), situacao.get("name")),
        "estadio": (competicao.get("venue") or {}).get("fullName"),
        "transmissao": None,
    }


def numerar_rodadas(jogos):
    """A ESPN não diz a rodada. Em pontos corridos, cada time joga uma vez por rodada; então,
    em ordem de data, o 1º jogo de um time é da rodada 1, o 2º da rodada 2, e assim por diante.
    (Um jogo adiado fica na "rodada" de quando ele for jogado.) Devolve os avisos."""
    jogos_de = Counter()
    avisos = []
    for jogo in sorted(jogos, key=lambda j: (j["data"], j["id"])):
        jogos_de[jogo["mandante"]] += 1
        jogos_de[jogo["visitante"]] += 1
        a, b = jogos_de[jogo["mandante"]], jogos_de[jogo["visitante"]]
        jogo["rodada"] = max(a, b)
        if a != b:
            avisos.append(f"rodada incerta em {jogo['mandante']} x {jogo['visitante']} ({a} ou {b})")
    return avisos


def baixar_jogos(ficha):
    """Baixa os jogos do campeonato descrito na ficha (configuracao.json) e devolve
    (dados no formato do jogos.json, lista de avisos)."""
    fonte = ficha["fonte"]
    eventos = baixar_eventos(fonte["liga"], ficha["temporada"], fonte["meses"])
    times = {}
    jogos, playoff = [], []
    pares_vistos = set()
    # Em ordem de data: a 1ª vez que um par mandante x visitante aparece é da fase de pontos
    # corridos. Se ele aparecer de novo, é um jogo do playoff (que só existe na Série B).
    for evento in sorted(eventos, key=lambda e: (e["date"], e["id"])):
        jogo = ler_evento(evento, times, ficha.get("nomes_corrigidos", {}))
        if jogo is None:
            continue
        par = (jogo["mandante"], jogo["visitante"])
        if par in pares_vistos:
            jogo.pop("rodada")
            playoff.append(jogo)
        else:
            pares_vistos.add(par)
            jogos.append(jogo)

    avisos = numerar_rodadas(jogos)
    jogos.sort(key=lambda j: (j["rodada"], j["data"]))
    dados = {
        "fonte": "ESPN",
        "competicao": ficha["nome"].replace("Brasileirão", "Campeonato Brasileiro"),
        "temporada": ficha["temporada"],
        "baixado_em": datetime.now(FUSO_BRASILIA).isoformat(timespec="seconds"),
        "times": dict(sorted(times.items())),
        "jogos": jogos,
    }
    if ficha.get("playoff") is not None:
        dados["playoff"] = playoff   # jogos do playoff já marcados (vazio até a ESPN definir os times)
    return dados, avisos
