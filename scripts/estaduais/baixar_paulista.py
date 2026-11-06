# baixar_paulista.py
# Baixa todos os jogos do Campeonato Paulista (Série A1 / Paulistão) da API pública da ESPN
# e salva em data/estaduais/paulista-<ano>/jogos.json. Também junta os escudos em
# assets/escudos/paulista/ (do Brasileirão, da ESPN ou da Wikipédia).
#
# Como rodar (na pasta do projeto):
#     python scripts/estaduais/baixar_paulista.py
#
# Para outro ano (ex.: 2027), troque ANO e MESES abaixo e confira as listas TIMES e FASES.

import sys

import comum
import espn

ANO = 2026
MESES = ["01", "02", "03"]           # meses em que o campeonato acontece
LIGA_ESPN = "bra.camp.paulista"
PASTA_DADOS = comum.PASTA_PROJETO / "data" / "estaduais" / f"paulista-{ANO}"
PASTA_ESCUDOS = comum.PASTA_PROJETO / "assets" / "escudos" / "paulista"
TOTAL_JOGOS = 72                     # 64 da fase de liga + 4 quartas + 2 semifinais + 2 finais

# Sigla do time na ESPN -> (id, nome para mostrar, sigla, grupo).
# Em 2026 a 1ª fase foi uma "fase de liga" única, com os 16 times numa tabela só (grupo "A").
TIMES = {
    "BFC": ("botafogo-sp", "Botafogo-SP", "BOT", "A"),
    "BRA": ("bragantino", "Bragantino", "RBB", "A"),
    "CAP": ("capivariano", "Capivariano", "CAP", "A"),
    "COR": ("corinthians", "Corinthians", "COR", "A"),
    "GUA": ("guarani", "Guarani", "GUA", "A"),
    "MIR": ("mirassol", "Mirassol", "MIR", "A"),
    "NOR": ("noroeste", "Noroeste", "NOR", "A"),
    "NOV": ("novorizontino", "Novorizontino", "NOV", "A"),
    "PAL": ("palmeiras", "Palmeiras", "PAL", "A"),
    "PON": ("ponte-preta", "Ponte Preta", "PON", "A"),
    "PSP": ("primavera", "Primavera", "PRI", "A"),
    "PTG": ("portuguesa", "Portuguesa", "POR", "A"),
    "SAN": ("santos", "Santos", "SAN", "A"),
    "SAO": ("sao-paulo", "São Paulo", "SAO", "A"),
    "BER": ("sao-bernardo", "São Bernardo", "SBE", "A"),
    "VELO": ("velo-clube", "Velo Clube", "VEL", "A"),
}

# Clubes que também estão no Brasileirão: usam o mesmo escudo de lá (id aqui -> id lá).
DO_BRASILEIRAO = {"palmeiras": "palmeiras", "corinthians": "corinthians", "sao-paulo": "sao-paulo",
                  "santos": "santos", "bragantino": "bragantino", "mirassol": "mirassol"}

# Escudos que a ESPN não tem: endereços na Wikipédia (Wikimedia).
ESCUDOS_RESERVA = {
    "capivariano": "https://upload.wikimedia.org/wikipedia/commons/4/43/Capivariano_FC.png",
    "noroeste": "https://upload.wikimedia.org/wikipedia/commons/e/e6/Esporte_Clube_Noroeste.svg",
    "primavera": "https://upload.wikimedia.org/wikipedia/pt/0/0c/Esporte_Clube_Primavera_logo.png",
    "velo-clube": "https://upload.wikimedia.org/wikipedia/commons/7/74/Escudo_Oficial_da_Associa%C3%A7%C3%A3o_Esportiva_Velo_Clube_Rioclarense.svg",
}

# Nome da fase na ESPN -> nome da fase no nosso arquivo.
FASES = {
    "league-phase": "primeira-fase",
    "quarterfinals": "quartas",
    "semifinals": "semifinal",
    "finals": "final",
}


def main():
    print("Baixando os jogos da ESPN...")
    eventos = espn.baixar_eventos(LIGA_ESPN, ANO, MESES)
    jogos, escudos = espn.ler_jogos(eventos, TIMES, FASES, "pau", ANO)
    times = {id_: {"nome": nome, "sigla": sigla, "grupo": grupo} for (id_, nome, sigla, grupo) in TIMES.values()}

    print("Juntando os escudos...")
    comum.copiar_escudos_do_brasileirao(PASTA_ESCUDOS, DO_BRASILEIRAO)
    problemas_escudos = comum.baixar_escudos(
        times, PASTA_ESCUDOS, lambda id_time: escudos.get(id_time) or ESCUDOS_RESERVA.get(id_time))

    dados = {
        "competicao": "Campeonato Paulista Série A1 (Paulistão)",
        "temporada": ANO,
        "fonte": "ESPN (site.api.espn.com)",
        "baixado_em": comum.agora_iso(),
        "times": dict(sorted(times.items())),
        "jogos": jogos,
    }
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
    salvos = sum(1 for t in times.values() if t["escudo"])
    print(f"Escudos salvos em {PASTA_ESCUDOS}: {salvos} de {len(times)}")
    for p in problemas_escudos:
        print(f"  - {p}")


if __name__ == "__main__":
    main()
