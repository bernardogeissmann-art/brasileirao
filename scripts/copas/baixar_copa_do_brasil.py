# baixar_copa_do_brasil.py
# Baixa os jogos da Copa do Brasil da API pública da ESPN e salva em
# data/copas/copa-do-brasil-<ano>/jogos.json, com os escudos em assets/escudos/copa-do-brasil/ e
# onde assistir aos próximos jogos (ge.globo). As ferramentas comuns às copas ficam em comum_copas.py.
#
# Como rodar (na pasta do projeto):
#     python scripts/copas/baixar_copa_do_brasil.py
# Depois:
#     python scripts/estaduais/estimar_estadual.py copa-do-brasil-2026
#     node scripts/estaduais/calcular_chances.js copa-do-brasil-2026
#
# O formato (as regras) fica em site/js/copas/copa-do-brasil-2026.js.
# O que fica de fora: as quatro primeiras fases (jogos únicos de fevereiro e março, com mais de 100
# clubes, que a ESPN nem mostra por inteiro). Aqui o campeonato começa na 5ª fase, com 32 times.
# A final de 2026 é em jogo único, em Brasília; enquanto os finalistas não são conhecidos, a ESPN
# mostra o jogo com times "TBD" (indefinidos), e ele fica de fora até lá.

import comum_copas as cc

ANO = 2026
MESES = ["04", "05", "06", "07", "08", "09", "10", "11", "12"]   # da 5ª fase à final
LIGA_ESPN = "bra.copa_do_brazil"
PASTA_DADOS = cc.PASTA_PROJETO / "data" / "copas" / f"copa-do-brasil-{ANO}"
PASTA_ESCUDOS = cc.PASTA_PROJETO / "assets" / "escudos" / "copa-do-brasil"
TOTAL_JOGOS = 61   # 32 da 5ª fase + 16 das oitavas + 8 das quartas + 4 das semis + a final
TOTAL_TIMES = 32

FASES = {
    "fifth-round": "quinta-fase",
    "round-of-16": "oitavas",
    "quarterfinals": "quartas",
    "semifinals": "semifinal",
    "final": "final",
}
FASES_IGNORADAS = {"first-round", "second-round", "third-round", "fourth-round"}
FASES_EM_CAMPO_NEUTRO = {"final"}   # a final é jogo único, em Brasília

# Onde assistir: a página da Copa do Brasil no ge.globo (os nomes dos clubes vêm das fichas das
# Séries A e B).
GE = {"endereco": "https://ge.globo.com/futebol/copa-do-brasil/", "nomes": cc.nomes_do_ge_brasileirao()}

# Escudos que a ESPN não tem, mas que já estão no site (de um estadual): id aqui -> arquivo lá.
ESCUDOS_DOS_ESTADUAIS = {"barra-fc": "catarinense/barra.png"}


def main():
    clubes_br = cc.clubes_do_brasileirao()
    eventos = cc.baixar_eventos(LIGA_ESPN, ANO, MESES)
    jogos, info = cc.ler_jogos(eventos, cc.identificador_automatico(clubes_br), FASES, "cdb", ANO,
                               FASES_IGNORADAS, FASES_EM_CAMPO_NEUTRO)
    # Não há fase de grupos: todos os times ficam no mesmo "grupo" (só para a página montar a tabela).
    times = cc.times_automaticos(info, clubes_br, grupo_padrao="CDB")
    PASTA_ESCUDOS.mkdir(parents=True, exist_ok=True)
    for id_time, arquivo in ESCUDOS_DOS_ESTADUAIS.items():
        original = cc.PASTA_PROJETO / "assets" / "escudos" / arquivo
        copia = PASTA_ESCUDOS / f"{id_time}{original.suffix}"
        if id_time in times and original.exists() and not copia.exists():
            copia.write_bytes(original.read_bytes())
    cc.salvar_copa(competicao="Copa do Brasil", ano=ANO, liga=LIGA_ESPN, pasta_dados=PASTA_DADOS,
                   pasta_escudos=PASTA_ESCUDOS, times=times, info=info, jogos=jogos, ge=GE,
                   total_jogos=TOTAL_JOGOS, total_times=TOTAL_TIMES)


if __name__ == "__main__":
    main()
