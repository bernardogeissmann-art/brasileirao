# baixar_sulamericana.py
# Baixa todos os jogos da Copa Sul-Americana (CONMEBOL Sudamericana) da API pública da ESPN
# e salva em data/copas/sulamericana-<ano>/jogos.json. Também junta os escudos em
# assets/escudos/sulamericana/ (os clubes brasileiros usam o mesmo escudo do Brasileirão)
# e anota onde assistir aos próximos jogos (canais informados pelo ge.globo).
#
# Como rodar (na pasta do projeto):
#     python scripts/copas/baixar_sulamericana.py
# Depois:
#     python scripts/estaduais/estimar_estadual.py sulamericana-2026
#     node scripts/estaduais/calcular_chances.js sulamericana-2026
#
# A Sul-Americana usa as mesmas ferramentas dos estaduais (fase de grupos + mata-mata,
# "momentos" do campeonato). O formato dela (as regras) fica em site/js/copas/sulamericana-2026.js.
#
# O que fica de fora: a "primeira fase" (jogos únicos de março entre clubes do mesmo país, que só
# decidem quem entra na fase de grupos). O campeonato, aqui, começa na fase de grupos.
#
# Para outro ano: troque ANO e MESES e confira as listas TIMES e FASES (a ESPN avisa time novo).

import sys
from datetime import datetime
from pathlib import Path

# Este script usa ferramentas que moram em outras pastas (scripts/ e scripts/estaduais/).
# "sys.path" é a lista de pastas onde o Python procura os arquivos importados.
PASTA_SCRIPTS = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PASTA_SCRIPTS))
sys.path.insert(0, str(PASTA_SCRIPTS / "estaduais"))

import comum          # noqa: E402  (scripts/estaduais/comum.py)
import espn           # noqa: E402  (scripts/estaduais/espn.py)
import transmissoes   # noqa: E402  (scripts/transmissoes.py)

ANO = 2026
MESES = ["04", "05", "06", "07", "08", "09", "10", "11", "12"]   # da fase de grupos à final
LIGA_ESPN = "conmebol.sudamericana"
PASTA_DADOS = comum.PASTA_PROJETO / "data" / "copas" / f"sulamericana-{ANO}"
PASTA_ESCUDOS = comum.PASTA_PROJETO / "assets" / "escudos" / "sulamericana"
TOTAL_JOGOS = 141   # 96 da fase de grupos + 16 dos playoffs + 16 das oitavas + 8 das quartas + 4 das semis + a final

# Número do time na ESPN -> (id, nome para mostrar, sigla, grupo, país).
# Usamos o número (e não a sigla) porque a ESPN repete siglas: "RAC" é o Racing da Argentina e
# também o Racing do Uruguai. Os clubes brasileiros têm o mesmo id do Brasileirão.
# Grupo "LIB": os 8 terceiros colocados da Libertadores, que caem para os playoffs da Sul-Americana.
TIMES = {
    "5267": ("alianza-atletico", "Alianza Atlético", "AAT", "A", "Peru"),
    "8109": ("america-de-cali", "América de Cali", "AME", "A", "Colômbia"),
    "18439": ("macara", "Macará", "MAC", "A", "Equador"),
    "7767": ("tigre", "Tigre", "TIG", "A", "Argentina"),
    "18995": ("academia-puerto-cabello", "Academia Puerto Cabello", "APC", "B", "Venezuela"),
    "7632": ("mineiro", "Atlético Mineiro", "CAM", "B", "Brasil"),
    "3372": ("cienciano", "Cienciano", "CIE", "B", "Peru"),
    "8416": ("juventud", "Juventud", "JUV", "B", "Uruguai"),
    "9999": ("boston-river", "Boston River", "BOS", "C", "Uruguai"),
    "5484": ("millonarios", "Millonarios", "MIL", "C", "Colômbia"),
    "6072": ("ohiggins", "O'Higgins", "OHI", "C", "Chile"),
    "2026": ("sao-paulo", "São Paulo", "SAO", "C", "Brasil"),
    "4812": ("deportivo-cuenca", "Deportivo Cuenca", "CUE", "D", "Equador"),
    "22517": ("deportivo-recoleta", "Deportivo Recoleta", "REC", "D", "Paraguai"),
    "18": ("san-lorenzo", "San Lorenzo", "SLO", "D", "Argentina"),
    "2674": ("santos", "Santos", "SAN", "D", "Brasil"),
    "6086": ("botafogo", "Botafogo", "BOT", "E", "Brasil"),
    "4811": ("caracas", "Caracas", "CAR", "E", "Venezuela"),
    "20889": ("independiente-petrolero", "Independiente Petrolero", "PET", "E", "Bolívia"),
    "15": ("racing", "Racing", "RAC", "E", "Argentina"),
    "17702": ("deportivo-riestra", "Deportivo Riestra", "RIE", "F", "Argentina"),
    "6273": ("gremio", "Grêmio", "GRE", "F", "Brasil"),
    "19002": ("montevideo-city-torque", "Montevideo City Torque", "MCT", "F", "Uruguai"),
    "4422": ("palestino", "Palestino", "PAL", "F", "Chile"),
    "4138": ("audax-italiano", "Audax Italiano", "AUD", "G", "Chile"),
    "10060": ("barracas-central", "Barracas Central", "BAR", "G", "Argentina"),
    "2675": ("olimpia", "Olimpia", "OLI", "G", "Paraguai"),
    "3454": ("vasco-da-gama", "Vasco da Gama", "VAS", "G", "Brasil"),
    "6047": ("blooming", "Blooming", "BLO", "H", "Bolívia"),
    "6037": ("carabobo", "Carabobo", "CRB", "H", "Venezuela"),
    "6079": ("bragantino", "Bragantino", "RBB", "H", "Brasil"),
    "16": ("river-plate", "River Plate", "RIV", "H", "Argentina"),
    "5": ("boca-juniors", "Boca Juniors", "BOC", "LIB", "Argentina"),
    "2681": ("bolivar", "Bolívar", "BOL", "LIB", "Bolívia"),
    "2690": ("independiente-medellin", "Independiente Medellín", "DIM", "LIB", "Colômbia"),
    "5488": ("santa-fe", "Santa Fe", "SFE", "LIB", "Colômbia"),
    "12": ("lanus", "Lanús", "LAN", "LIB", "Argentina"),
    "2684": ("nacional", "Nacional", "NAC", "LIB", "Uruguai"),
    "2673": ("sporting-cristal", "Sporting Cristal", "SCR", "LIB", "Peru"),
    "10094": ("ucv", "UCV", "UCV", "LIB", "Venezuela"),
}

# Clubes que também estão no Brasileirão: usam o mesmo escudo de lá (o id é o mesmo).
DO_BRASILEIRAO = {id_: id_ for (id_, _, _, _, pais) in TIMES.values() if pais == "Brasil"}

# Nome da fase na ESPN -> nome da fase no nosso arquivo. "primeira-fase" é a fase de grupos
# (o nome usado por todas as ferramentas dos estaduais para a fase com tabela).
FASES = {
    "group-stage": "primeira-fase",
    "knockout-round-playoffs": "playoffs",
    "round-of-16": "oitavas",
    "quarterfinals": "quartas",
    "semifinals": "semifinal",
    "final": "final",
}
FASES_IGNORADAS = {"first-stage"}   # a primeira fase (ver o começo deste arquivo)
FASES_EM_CAMPO_NEUTRO = {"final"}   # a final é jogo único, em sede escolhida pela CONMEBOL

# Onde assistir: a página da Sul-Americana no ge.globo e o nome de cada time lá -> o nosso id.
# Basta ter os times dos próximos jogos (o ge só mostra os jogos da fase atual).
GE = {
    "endereco": "https://ge.globo.com/futebol/copa-sul-americana/",
    "nomes": {
        "Atlético-MG": "mineiro", "Boca Juniors": "boca-juniors", "São Paulo": "sao-paulo", "Santos": "santos",
        "Botafogo": "botafogo", "Grêmio": "gremio", "Vasco": "vasco-da-gama", "Bragantino": "bragantino",
        "Montevideo City Torque": "montevideo-city-torque",
    },
}


def ler_jogos(eventos):
    """Transforma os eventos da ESPN na nossa lista de jogos (e guarda o escudo de cada time)."""
    jogos = []
    escudos = {}
    for evento in eventos:
        slug = evento["season"]["slug"]
        if slug in FASES_IGNORADAS:
            continue
        if slug not in FASES:
            sys.exit(f"Erro: fase desconhecida na ESPN: '{slug}'. Atualize a lista FASES.")
        fase = FASES[slug]
        competicao = evento["competitions"][0]
        lados = {c["homeAway"]: c for c in competicao["competitors"]}
        casa, fora = lados["home"], lados["away"]
        ids = []
        for lado in (casa, fora):
            numero = lado["team"]["id"]
            if numero not in TIMES:
                sys.exit(f"Erro: time desconhecido na ESPN: {numero} ({lado['team']['displayName']}). "
                         "Atualize a lista TIMES.")
            ids.append(TIMES[numero][0])
            # O escudo numa versão pequena (128 x 128), como na Série B: a página carrega mais rápido.
            escudo = f"https://a.espncdn.com/combiner/i?img=/i/teamlogos/soccer/500/{numero}.png&w=128&h=128"
            escudos[TIMES[numero][0]] = (escudo, lado["team"]["displayName"])

        status = competicao["status"]["type"]
        disputado = bool(status.get("completed"))
        # A ESPN dá a hora em UTC ("2026-11-21T22:30Z"); convertemos para Brasília.
        data = datetime.fromisoformat(evento["date"].replace("Z", "+00:00")).astimezone(comum.FUSO_BRASILIA)
        mandante, visitante = ids
        mata_mata = fase != "primeira-fase"
        jogos.append({
            "id": f"sul{ANO}-{evento['id']}",
            "numero": int(evento["id"]),
            "fase": fase,
            "rodada": None,
            "confronto": f"{fase}-{'-'.join(sorted(ids))}" if mata_mata else None,
            "data": data.isoformat(),
            "mandante": mandante,
            "visitante": visitante,
            "neutro": fase in FASES_EM_CAMPO_NEUTRO,
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
    return sorted(jogos, key=lambda j: (j["data"], j["numero"])), escudos


def main():
    print("Baixando os jogos da ESPN...")
    eventos = espn.baixar_eventos(LIGA_ESPN, ANO, MESES)
    jogos, escudos = ler_jogos(eventos)
    times = {id_: {"nome": nome, "sigla": sigla, "grupo": grupo, "pais": pais}
             for (id_, nome, sigla, grupo, pais) in TIMES.values()}
    # O nome de cada time na ESPN: o placar ao vivo (lido pelo navegador) encontra o jogo por ele.
    for id_time, (_, nome_espn) in escudos.items():
        times[id_time]["nome_espn"] = nome_espn

    print("Juntando os escudos...")
    comum.copiar_escudos_do_brasileirao(PASTA_ESCUDOS, DO_BRASILEIRAO)
    problemas_escudos = comum.baixar_escudos(times, PASTA_ESCUDOS, lambda id_time: (escudos.get(id_time) or (None,))[0])

    dados = {
        "competicao": "Copa Sul-Americana",
        "temporada": ANO,
        "fonte": "ESPN (site.api.espn.com)",
        "baixado_em": comum.agora_iso(),
        # A "liga" da Sul-Americana na ESPN: o site usa para buscar o placar ao vivo.
        "liga_espn": LIGA_ESPN,
        "times": dict(sorted(times.items())),
        "jogos": jogos,
    }

    print("Procurando onde assistir (ge.globo)...")
    anotados, avisos = transmissoes.anotar_transmissoes(dados, GE)
    print(f"  {anotados} jogo(s) com transmissão")
    for aviso in avisos:
        print(f"  aviso: {aviso}")

    problemas = comum.conferir_basico(dados, TOTAL_JOGOS, len(TIMES))
    if problemas:
        print("Os dados NÃO foram salvos. Problemas:")
        for p in problemas:
            print(f"  - {p}")
        sys.exit(1)
    comum.salvar_json(PASTA_DADOS / "jogos.json", dados)

    disputados = sum(1 for j in jogos if j["disputado"])
    print(f"Salvo: {PASTA_DADOS / 'jogos.json'}")
    print(f"  {len(jogos)} jogos ({disputados} disputados), {len(times)} times")
    por_fase = {}
    for j in jogos:
        por_fase[j["fase"]] = por_fase.get(j["fase"], 0) + 1
    for fase, n in por_fase.items():
        print(f"  {fase:<22}{n:>3} jogos")
    rodadas = sorted({j["rodada"] for j in jogos if j["fase"] == "primeira-fase"})
    print(f"  fase de grupos em {len(rodadas)} rodadas")
    salvos = sum(1 for t in times.values() if t["escudo"])
    print(f"Escudos salvos em {PASTA_ESCUDOS}: {salvos} de {len(times)}")
    for p in problemas_escudos:
        print(f"  - {p}")


if __name__ == "__main__":
    main()
