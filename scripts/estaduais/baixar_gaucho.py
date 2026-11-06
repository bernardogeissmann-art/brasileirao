# baixar_gaucho.py
# Baixa todos os jogos do Campeonato Gaúcho (Série A / Gauchão) da API pública da ESPN
# e salva em data/estaduais/gaucho-<ano>/jogos.json. Também baixa os escudos (da ESPN)
# para assets/escudos/gaucho/.
#
# Como rodar (na pasta do projeto):
#     python scripts/estaduais/baixar_gaucho.py
#
# Para outro ano (ex.: 2027), troque ANO e MESES abaixo e confira a lista TIMES.

import sys

import comum
import espn

ANO = 2026
MESES = ["01", "02", "03"]           # meses em que o campeonato acontece
LIGA_ESPN = "bra.camp.gaucho"
PASTA_DADOS = comum.PASTA_PROJETO / "data" / "estaduais" / f"gaucho-{ANO}"
PASTA_ESCUDOS = comum.PASTA_PROJETO / "assets" / "escudos" / "gaucho"
TOTAL_JOGOS = 64

# Sigla do time na ESPN -> (id, nome para mostrar, sigla, grupo da 1ª fase).
# Os grupos vêm do sorteio do Conselho Técnico (não estão na ESPN).
TIMES = {
    "AVE": ("avenida", "Avenida", "AVE", "A"),
    "GDB": ("guarany", "Guarany de Bagé", "GUA", "A"),
    "INT": ("internacional", "Internacional", "INT", "A"),
    "JUV": ("juventude", "Juventude", "JUV", "A"),
    "SJO": ("sao-jose", "São José", "SJO", "A"),
    "SLU": ("sao-luiz", "São Luiz", "SLU", "A"),
    "CAX": ("caxias", "Caxias", "CAX", "B"),
    "GRE": ("gremio", "Grêmio", "GRE", "B"),
    "ISM": ("inter-sm", "Inter de Santa Maria", "ISM", "B"),
    "MON": ("monsoon", "Monsoon", "MON", "B"),
    "NVH": ("novo-hamburgo", "Novo Hamburgo", "NHA", "B"),
    "YPI": ("ypiranga", "Ypiranga", "YPI", "B"),
}

# Escudos que a ESPN não tem: endereços na Wikipédia (Wikimedia Commons).
# O Inter de Santa Maria não tem escudo em nenhuma das duas fontes: o arquivo
# assets/escudos/gaucho/inter-sm.png foi colocado à mão, e o script o reaproveita.
ESCUDOS_RESERVA = {
    "guarany": "https://upload.wikimedia.org/wikipedia/commons/5/57/Guarany_Futebol_Clube.svg",
    "monsoon": "https://upload.wikimedia.org/wikipedia/commons/0/09/Monsoon_Futebol_Clube_logo.png",
}

# Nome da fase na ESPN -> nome da fase no nosso arquivo.
FASES = {
    "first-round": "primeira-fase",
    "gaucho---relegation": "quadrangular",
    "quarterfinals": "quartas",
    "semifinals": "semifinal",
    "finals": "final",
    "farroupilha---semifinals": "farroupilha-semifinal",
    "farroupilha---finals": "farroupilha-final",
}


def main():
    print("Baixando os jogos da ESPN...")
    eventos = espn.baixar_eventos(LIGA_ESPN, ANO, MESES)
    jogos, escudos = espn.ler_jogos(eventos, TIMES, FASES, "gau", ANO, fases_de_pontos=("primeira-fase", "quadrangular"))
    times = {id_: {"nome": nome, "sigla": sigla, "grupo": grupo} for (id_, nome, sigla, grupo) in TIMES.values()}

    print("Baixando os escudos...")
    problemas_escudos = comum.baixar_escudos(
        times, PASTA_ESCUDOS, lambda id_time: escudos.get(id_time) or ESCUDOS_RESERVA.get(id_time))

    dados = {
        "competicao": "Campeonato Gaúcho Série A (Gauchão)",
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
