# comum_copas.py
# Ferramentas usadas pelos scripts das copas (Sul-Americana, Libertadores e Copa do Brasil):
# ler os jogos da ESPN, reconhecer os clubes brasileiros, juntar os escudos, anotar onde
# assistir (ge.globo) e salvar o jogos.json. Este arquivo não é rodado sozinho.

import json
import re
import sys
import unicodedata
from collections import Counter
from datetime import datetime
from pathlib import Path

# Estas ferramentas usam outras que moram em scripts/ e scripts/estaduais/.
# "sys.path" é a lista de pastas onde o Python procura os arquivos importados.
PASTA_SCRIPTS = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PASTA_SCRIPTS))
sys.path.insert(0, str(PASTA_SCRIPTS / "estaduais"))

import comum          # noqa: E402  (scripts/estaduais/comum.py)
import espn           # noqa: E402  (scripts/estaduais/espn.py)
import transmissoes   # noqa: E402  (scripts/transmissoes.py)

PASTA_PROJETO = comum.PASTA_PROJETO

# A ESPN escreve o país do estádio em inglês; aqui, em português.
PAISES = {"Brazil": "Brasil", "Uruguay": "Uruguai", "Paraguay": "Paraguai", "Colombia": "Colômbia",
          "Ecuador": "Equador", "Bolivia": "Bolívia", "Peru": "Peru", "Chile": "Chile",
          "Argentina": "Argentina", "Venezuela": "Venezuela"}


def escudo_espn(numero):
    """O escudo de um time na ESPN, numa versão pequena (128 x 128): a página carrega mais rápido."""
    return f"https://a.espncdn.com/combiner/i?img=/i/teamlogos/soccer/500/{numero}.png&w=128&h=128"


def slug(nome):
    """Um identificador a partir do nome: "Estudiantes de La Plata" vira "estudiantes-de-la-plata"."""
    sem_acento = unicodedata.normalize("NFD", nome).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", sem_acento.lower()).strip("-")


def clubes_do_brasileirao():
    """Os clubes das Séries A e B, pelo nome que a ESPN usa: {"Atlético-MG": ("mineiro", "Atlético Mineiro")}.
    Assim um clube brasileiro tem nas copas o mesmo id (e o mesmo escudo, as mesmas cores, a mesma loja
    de ingressos) que tem no Brasileirão."""
    clubes = {}
    for campeonato in ("serie-a", "serie-b"):
        dados = json.loads((PASTA_PROJETO / "data" / campeonato / "jogos.json").read_text(encoding="utf-8"))
        for id_, time in dados["times"].items():
            if time.get("nome_espn"):
                clubes[time["nome_espn"]] = (id_, time["nome"])
    return clubes


def nomes_do_ge_brasileirao():
    """O nome de cada clube das Séries A e B no ge.globo -> o nosso id (das fichas dos campeonatos)."""
    nomes = {}
    for campeonato in ("serie-a", "serie-b"):
        ficha = json.loads((PASTA_PROJETO / "data" / campeonato / "configuracao.json").read_text(encoding="utf-8"))
        nomes.update(ficha["ge"]["nomes"])
    return nomes


def ler_jogos(eventos, identificar, fases, prefixo, ano, ignoradas=(), neutras=()):
    """Transforma os eventos da ESPN na nossa lista de jogos.
      identificar: função que recebe o time da ESPN e devolve o nosso id (ou None para pular o jogo,
                   ex.: a final ainda sem os finalistas, que a ESPN mostra como "TBD")
      fases:       nome da fase na ESPN -> nome no nosso arquivo ("primeira-fase" = fase de grupos)
      ignoradas:   fases da ESPN que ficam de fora (ex.: as preliminares)
      neutras:     fases jogadas em campo neutro (ex.: a final em jogo único)
    Devolve (jogos, info), em que info[id] guarda o que a ESPN diz de cada time: nome, sigla,
    número (para o escudo), grupo e os países dos estádios onde ele jogou em casa."""
    jogos = []
    info = {}
    for evento in eventos:
        slug_fase = evento["season"]["slug"]
        if slug_fase in ignoradas:
            continue
        if slug_fase not in fases:
            sys.exit(f"Erro: fase desconhecida na ESPN: '{slug_fase}'. Atualize a lista FASES.")
        fase = fases[slug_fase]
        competicao = evento["competitions"][0]
        lados = {c["homeAway"]: c for c in competicao["competitors"]}
        casa, fora = lados["home"], lados["away"]
        ids = [identificar(lado["team"]) for lado in (casa, fora)]
        if None in ids:
            continue
        grupo = (competicao.get("group") or {}).get("abbreviation", "")   # "Group G"
        pais_do_estadio = ((competicao.get("venue") or {}).get("address") or {}).get("country")
        for id_, lado in zip(ids, (casa, fora)):
            t = lado["team"]
            dados_time = info.setdefault(id_, {"nome_espn": t["displayName"], "sigla": t.get("abbreviation", ""),
                                               "numero": t["id"], "grupo": None, "paises": Counter()})
            if fase == "primeira-fase" and grupo:
                dados_time["grupo"] = grupo.split()[-1]
            if lado is casa and pais_do_estadio and fase not in neutras:
                dados_time["paises"][pais_do_estadio] += 1

        status = competicao["status"]["type"]
        disputado = bool(status.get("completed"))
        # A ESPN dá a hora em UTC ("2026-11-21T22:30Z"); convertemos para Brasília.
        data = datetime.fromisoformat(evento["date"].replace("Z", "+00:00")).astimezone(comum.FUSO_BRASILIA)
        mandante, visitante = ids
        mata_mata = fase != "primeira-fase"
        jogos.append({
            "id": f"{prefixo}{ano}-{evento['id']}",
            "numero": int(evento["id"]),
            "fase": fase,
            "rodada": None,
            "confronto": f"{fase}-{'-'.join(sorted(ids))}" if mata_mata else None,
            "data": data.isoformat(),
            "mandante": mandante,
            "visitante": visitante,
            "neutro": fase in neutras,
            "disputado": disputado,
            "gols_mandante": int(casa["score"]) if disputado else None,
            "gols_visitante": int(fora["score"]) if disputado else None,
            "penaltis_mandante": casa.get("shootoutScore"),
            "penaltis_visitante": fora.get("shootoutScore"),
            # O site esconde os jogos adiados dos "Jogos do dia" (a data deles não vale mais).
            "status_fonte": "POSTPONED" if "POSTPONED" in (status.get("name") or "") else status.get("name"),
            "estadio": (competicao.get("venue") or {}).get("fullName"),
        })
    comum.numerar_rodadas([j for j in jogos if j["fase"] == "primeira-fase"])
    comum.numerar_pernas([j for j in jogos if j["confronto"]])
    return sorted(jogos, key=lambda j: (j["data"], j["numero"])), info


def identificador_automatico(clubes_br):
    """Uma função "identificar" para ler_jogos: clube brasileiro pelo id do Brasileirão; os outros
    pelo nome (slug). Os times ainda indefinidos ("TBD") ficam de fora."""
    def identificar(time_espn):
        nome = time_espn["displayName"]
        if "TBD" in nome:
            return None
        return clubes_br[nome][0] if nome in clubes_br else slug(nome)
    return identificar


def times_automaticos(info, clubes_br, grupo_padrao=None):
    """A ficha de cada time a partir do que a ESPN disse (para as copas sem lista feita à mão):
    clube brasileiro com o nome do Brasileirão; país pelo estádio onde mais jogou em casa."""
    times = {}
    for id_, i in info.items():
        brasileiro = clubes_br.get(i["nome_espn"])
        if brasileiro:
            pais = "Brasil"
        elif i["paises"]:
            no_estadio = i["paises"].most_common(1)[0][0]   # o país que mais aparece
            pais = PAISES.get(no_estadio, no_estadio)
        else:
            pais = ""
        times[id_] = {"nome": brasileiro[1] if brasileiro else i["nome_espn"], "sigla": i["sigla"],
                      "grupo": i["grupo"] or grupo_padrao, "pais": pais, "nome_espn": i["nome_espn"]}
    return times


def salvar_copa(*, competicao, ano, liga, pasta_dados, pasta_escudos, times, info, jogos, ge, total_jogos, total_times):
    """O fim comum a todas as copas: escudos, onde assistir, conferência e o jogos.json."""
    print("Juntando os escudos...")
    # Clubes que também estão no Brasileirão usam o mesmo escudo de lá (o id é o mesmo).
    do_brasileirao = {id_: id_ for id_, t in times.items() if t.get("pais") == "Brasil"}
    comum.copiar_escudos_do_brasileirao(pasta_escudos, do_brasileirao)
    problemas_escudos = comum.baixar_escudos(
        times, pasta_escudos, lambda id_time: escudo_espn(info[id_time]["numero"]) if id_time in info else None)

    dados = {
        "competicao": competicao,
        "temporada": ano,
        "fonte": "ESPN (site.api.espn.com)",
        "baixado_em": comum.agora_iso(),
        # A "liga" da copa na ESPN: o site usa para buscar o placar ao vivo.
        "liga_espn": liga,
        "times": dict(sorted(times.items())),
        "jogos": jogos,
    }

    print("Procurando onde assistir (ge.globo)...")
    anotados, avisos = transmissoes.anotar_transmissoes(dados, ge)
    print(f"  {anotados} jogo(s) com transmissão")
    for aviso in avisos:
        print(f"  aviso: {aviso}")

    problemas = comum.conferir_basico(dados, total_jogos, total_times)
    if problemas:
        print("Os dados NÃO foram salvos. Problemas:")
        for p in problemas:
            print(f"  - {p}")
        sys.exit(1)
    comum.salvar_json(pasta_dados / "jogos.json", dados)

    disputados = sum(1 for j in jogos if j["disputado"])
    print(f"Salvo: {pasta_dados / 'jogos.json'}")
    print(f"  {len(jogos)} jogos ({disputados} disputados), {len(times)} times")
    por_fase = Counter(j["fase"] for j in jogos)
    for fase, n in por_fase.items():
        print(f"  {fase:<22}{n:>3} jogos")
    rodadas = {j["rodada"] for j in jogos if j["fase"] == "primeira-fase"}
    if rodadas:
        print(f"  fase de grupos em {len(rodadas)} rodadas")
    salvos = sum(1 for t in times.values() if t["escudo"])
    print(f"Escudos salvos em {pasta_escudos}: {salvos} de {len(times)}")
    for p in problemas_escudos:
        print(f"  - {p}")


def baixar_eventos(liga, ano, meses):
    print("Baixando os jogos da ESPN...")
    return espn.baixar_eventos(liga, ano, meses)
