# baixar_libertadores.py
# Baixa todos os jogos da Copa Libertadores (CONMEBOL Libertadores) da API pública da ESPN e salva
# em data/copas/libertadores-<ano>/jogos.json, com os escudos em assets/escudos/libertadores/ e
# onde assistir aos próximos jogos (ge.globo). As ferramentas comuns às copas ficam em comum_copas.py.
#
# Como rodar (na pasta do projeto):
#     python scripts/copas/baixar_libertadores.py
# Depois:
#     python scripts/estaduais/estimar_estadual.py libertadores-2026
#     node scripts/estaduais/calcular_chances.js libertadores-2026
#
# O formato (as regras) fica em site/js/copas/libertadores-2026.js.
# O que fica de fora: as três fases preliminares (fevereiro e março), que só decidem quem entra
# na fase de grupos. Aqui o campeonato começa na fase de grupos, com 32 times.
#
# Os times não precisam de uma lista feita à mão: os clubes brasileiros são reconhecidos pelo nome
# na ESPN (e ganham o mesmo id do Brasileirão); os outros recebem um id feito do nome, e o país vem
# do estádio onde jogam em casa.

import comum_copas as cc

ANO = 2026
MESES = ["04", "05", "06", "07", "08", "09", "10", "11", "12"]   # da fase de grupos à final
LIGA_ESPN = "conmebol.libertadores"
PASTA_DADOS = cc.PASTA_PROJETO / "data" / "copas" / f"libertadores-{ANO}"
PASTA_ESCUDOS = cc.PASTA_PROJETO / "assets" / "escudos" / "libertadores"
TOTAL_JOGOS = 125   # 96 da fase de grupos + 16 das oitavas + 8 das quartas + 4 das semis + a final
TOTAL_TIMES = 32

# Nome da fase na ESPN -> nome da fase no nosso arquivo ("primeira-fase" é a fase de grupos).
FASES = {
    "group-stage": "primeira-fase",
    "round-of-16": "oitavas",
    "quarterfinals": "quartas",
    "semifinals": "semifinal",
    "final": "final",
}
FASES_IGNORADAS = {"first-stage", "second-stage", "third-stage"}   # as fases preliminares
FASES_EM_CAMPO_NEUTRO = {"final"}   # a final é jogo único, em sede escolhida pela CONMEBOL

# Onde assistir: a página da Libertadores no ge.globo. Os clubes brasileiros já são conhecidos (pelas
# fichas da Série A e da Série B); aqui ficam os estrangeiros que chegaram à reta final.
GE = {
    "endereco": "https://ge.globo.com/futebol/libertadores/",
    "nomes": {**cc.nomes_do_ge_brasileirao(), "Estudiantes": "estudiantes-de-la-plata"},
}


def main():
    clubes_br = cc.clubes_do_brasileirao()
    eventos = cc.baixar_eventos(LIGA_ESPN, ANO, MESES)
    jogos, info = cc.ler_jogos(eventos, cc.identificador_automatico(clubes_br), FASES, "lib", ANO,
                               FASES_IGNORADAS, FASES_EM_CAMPO_NEUTRO)
    times = cc.times_automaticos(info, clubes_br)
    cc.salvar_copa(competicao="Copa Libertadores", ano=ANO, liga=LIGA_ESPN, pasta_dados=PASTA_DADOS,
                   pasta_escudos=PASTA_ESCUDOS, times=times, info=info, jogos=jogos, ge=GE,
                   total_jogos=TOTAL_JOGOS, total_times=TOTAL_TIMES)


if __name__ == "__main__":
    main()
