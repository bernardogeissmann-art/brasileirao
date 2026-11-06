# espn.py
# Lê os jogos de um campeonato estadual na API pública da ESPN. É usado pelos scripts dos
# campeonatos que a ESPN cobre (Gaúcho e Paulista). Este arquivo não é rodado sozinho.
#
# A ESPN organiza os jogos por mês: pedimos um mês de cada vez e juntamos tudo.

import sys
from datetime import datetime

import comum

URL_MES = "https://site.api.espn.com/apis/site/v2/sports/soccer/{liga}/scoreboard?dates={ano}{mes}"


def baixar_eventos(liga, ano, meses):
    """Baixa os jogos ("eventos", para a ESPN) dos meses indicados. Ex.: liga "bra.camp.paulista"."""
    eventos = {}
    for mes in meses:
        resposta = comum.baixar_json(URL_MES.format(liga=liga, ano=ano, mes=mes))
        for evento in resposta.get("events", []):
            eventos[evento["id"]] = evento   # guardado pelo número do jogo: nunca repete
    return list(eventos.values())


def ler_jogos(eventos, times, fases, prefixo, ano, fases_de_pontos=("primeira-fase",)):
    """Transforma os eventos da ESPN na nossa lista de jogos.
      times:  sigla da ESPN -> (id, nome, sigla, grupo)
      fases:  nome da fase na ESPN -> nome da fase no nosso arquivo
      prefixo: começo do id de cada jogo (ex.: "gau" vira "gau2026-401234")
      fases_de_pontos: fases em que os times somam pontos numa tabela (têm rodadas);
                       as outras são mata-mata (têm confrontos de um ou dois jogos).
    Também devolve o endereço do escudo de cada time na ESPN (quando existe)."""
    jogos = []
    escudos = {}
    for evento in eventos:
        competicao = evento["competitions"][0]
        lados = {c["homeAway"]: c for c in competicao["competitors"]}
        casa, fora = lados["home"], lados["away"]
        siglas = [casa["team"]["abbreviation"], fora["team"]["abbreviation"]]
        for sigla, lado in zip(siglas, (casa, fora)):
            if sigla not in times:
                sys.exit(f"Erro: time desconhecido na ESPN: {sigla} ({lado['team']['displayName']}). "
                         "Atualize a lista TIMES.")
            escudos[times[sigla][0]] = lado["team"].get("logo")

        slug = evento["season"]["slug"]
        if slug not in fases:
            sys.exit(f"Erro: fase desconhecida na ESPN: '{slug}'. Atualize a lista FASES.")
        fase = fases[slug]
        mandante, visitante = times[siglas[0]][0], times[siglas[1]][0]
        disputado = bool(competicao["status"]["type"].get("completed"))
        # A ESPN dá a hora em UTC ("2026-01-10T22:00Z"); convertemos para Brasília.
        data = datetime.fromisoformat(evento["date"].replace("Z", "+00:00")).astimezone(comum.FUSO_BRASILIA)
        mata_mata = fase not in fases_de_pontos
        jogos.append({
            "id": f"{prefixo}{ano}-{evento['id']}",
            "numero": int(evento["id"]),
            "fase": fase,
            "rodada": None,
            "confronto": f"{fase}-{'-'.join(sorted([mandante, visitante]))}" if mata_mata else None,
            "data": data.isoformat(),
            "mandante": mandante,
            "visitante": visitante,
            "disputado": disputado,
            "gols_mandante": int(casa["score"]) if disputado else None,
            "gols_visitante": int(fora["score"]) if disputado else None,
            "penaltis_mandante": casa.get("shootoutScore"),
            "penaltis_visitante": fora.get("shootoutScore"),
        })
    for fase in fases_de_pontos:
        comum.numerar_rodadas([j for j in jogos if j["fase"] == fase])
    comum.numerar_pernas([j for j in jogos if j["confronto"]])
    return sorted(jogos, key=lambda j: (j["data"], j["numero"])), escudos
