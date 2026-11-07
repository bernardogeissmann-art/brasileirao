# baixar_sulamericana.py
# Baixa todos os jogos da Copa Sul-Americana (CONMEBOL Sudamericana) da API pública da ESPN
# e salva em data/copas/sulamericana-<ano>/jogos.json. Também junta os escudos em
# assets/escudos/sulamericana/ (os clubes brasileiros usam o mesmo escudo do Brasileirão)
# e anota onde assistir aos próximos jogos (canais informados pelo ge.globo).
# As ferramentas comuns às copas ficam em comum_copas.py.
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

import comum_copas as cc

ANO = 2026
MESES = ["04", "05", "06", "07", "08", "09", "10", "11", "12"]   # da fase de grupos à final
LIGA_ESPN = "conmebol.sudamericana"
PASTA_DADOS = cc.PASTA_PROJETO / "data" / "copas" / f"sulamericana-{ANO}"
PASTA_ESCUDOS = cc.PASTA_PROJETO / "assets" / "escudos" / "sulamericana"
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


def identificar(time_espn):
    """O nosso id de um time da ESPN, pela tabela TIMES (time ainda indefinido, "TBD": fica de fora)."""
    if "TBD" in time_espn["displayName"]:
        return None
    if time_espn["id"] not in TIMES:
        sys.exit(f"Erro: time desconhecido na ESPN: {time_espn['id']} ({time_espn['displayName']}). "
                 "Atualize a lista TIMES.")
    return TIMES[time_espn["id"]][0]


def main():
    eventos = cc.baixar_eventos(LIGA_ESPN, ANO, MESES)
    jogos, info = cc.ler_jogos(eventos, identificar, FASES, "sul", ANO, FASES_IGNORADAS, FASES_EM_CAMPO_NEUTRO)
    times = {id_: {"nome": nome, "sigla": sigla, "grupo": grupo, "pais": pais}
             for (id_, nome, sigla, grupo, pais) in TIMES.values()}
    # O nome de cada time na ESPN: o placar ao vivo (lido pelo navegador) encontra o jogo por ele.
    for id_time, i in info.items():
        times[id_time]["nome_espn"] = i["nome_espn"]
    cc.salvar_copa(competicao="Copa Sul-Americana", ano=ANO, liga=LIGA_ESPN, pasta_dados=PASTA_DADOS,
                   pasta_escudos=PASTA_ESCUDOS, times=times, info=info, jogos=jogos, ge=GE,
                   total_jogos=TOTAL_JOGOS, total_times=len(TIMES))


if __name__ == "__main__":
    main()
