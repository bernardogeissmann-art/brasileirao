# estimar_estadual.py
# Estima a força dos times (ataque, defesa e fator casa) de um campeonato estadual em vários
# "momentos": antes do 1º jogo, depois de cada rodada da 1ª fase e depois de cada fase do
# mata-mata. Salva tudo em data/estaduais/<campeonato>/modelos.json, para o site mostrar
# como as chances mudaram ao longo do campeonato.
#
# Como rodar (na pasta do projeto):
#     python scripts/estaduais/estimar_estadual.py catarinense-2026
#     python scripts/estaduais/estimar_estadual.py gaucho-2026
#     python scripts/estaduais/estimar_estadual.py sulamericana-2026   (a Copa Sul-Americana)
#
# O modelo é o mesmo do Brasileirão (Poisson com ataque, defesa e fator casa), com uma
# diferença: como os estaduais têm poucos jogos, cada time começa com alguns "jogos
# imaginários" contra um adversário médio. Isso evita que um único resultado (uma goleada
# na estreia, por exemplo) faça um time parecer imbatível. Quanto mais jogos de verdade,
# menos esses jogos imaginários pesam. (Em estatística, isso se chama "encolhimento".)

import json
import sys

import comum

FORCA_PRIOR = 3            # quantos "jogos imaginários" cada time começa tendo
GOLS_POR_JOGO_PRIOR = 2.5  # média de gols por jogo usada antes de haver dados
FATOR_CASA_PRIOR = 1.25    # fator casa usado antes de haver dados
FORCA_PRIOR_CASA = 6       # quantos "jogos imaginários" seguram o fator casa
TOLERANCIA = 1e-10
MAX_VOLTAS = 10_000

# Fases do caminho principal até o título, na ordem (playoffs e oitavas só existem na Sul-Americana). Cada uma vira um ou dois momentos
# (ida e volta). Fases paralelas (quadrangular, Taça ACESC, Troféu Farroupilha) não criam
# momentos próprios, mas os seus jogos entram no modelo quando já aconteceram.
FASES_DO_CAMINHO = [("playoffs", "dos playoffs", "os playoffs", "PO"),
                    ("oitavas", "das oitavas", "as oitavas", "OF"),
                    ("quartas", "das quartas", "as quartas", "QF"),
                    ("semifinal", "das semifinais", "as semifinais", "SF"),
                    ("final", "da final", "a final", "F")]


def estimar(jogos, ids_times):
    """Encontra ataque, defesa e fator casa com os "jogos imaginários" (encolhimento).
    Com nenhum jogo, todos os times ficam iguais (ataque 1 e defesa média)."""
    gols_feitos = {t: 0 for t in ids_times}
    gols_sofridos = {t: 0 for t in ids_times}
    for jogo in jogos:
        m, v = jogo["mandante"], jogo["visitante"]
        gols_feitos[m] += jogo["gols_mandante"]
        gols_sofridos[v] += jogo["gols_mandante"]
        gols_feitos[v] += jogo["gols_visitante"]
        gols_sofridos[m] += jogo["gols_visitante"]
    gols_dos_mandantes = sum(j["gols_mandante"] for j in jogos)

    h = FATOR_CASA_PRIOR
    defesa_inicial = GOLS_POR_JOGO_PRIOR / (1 + FATOR_CASA_PRIOR)
    ataque = {t: 1.0 for t in ids_times}
    defesa = {t: defesa_inicial for t in ids_times}

    for volta in range(1, MAX_VOLTAS + 1):
        antes = (dict(ataque), dict(defesa), h)
        # "e" = gols que um ataque médio faz, em média, num jogo (metade em casa, metade fora),
        # contra uma defesa de nota 1. Os jogos imaginários usam esse ritmo.
        e = (1 + h) / 2
        defesa_media = sum(defesa.values()) / len(defesa)

        # Ataques: (gols de verdade + gols imaginários) / (oportunidades de verdade + imaginárias).
        base = {t: 0.0 for t in ids_times}
        for jogo in jogos:
            base[jogo["mandante"]] += defesa[jogo["visitante"]] * h
            base[jogo["visitante"]] += defesa[jogo["mandante"]]
        imaginario = FORCA_PRIOR * defesa_media * e
        ataque = {t: (gols_feitos[t] + imaginario) / (base[t] + imaginario) for t in ids_times}

        # Restrição: média dos ataques = 1 (compensando nas defesas, como no Brasileirão).
        media = sum(ataque.values()) / len(ataque)
        ataque = {t: a / media for t, a in ataque.items()}
        defesa = {t: b * media for t, b in defesa.items()}
        defesa_media = sum(defesa.values()) / len(defesa)

        # Defesas: puxadas para a defesa média pelos jogos imaginários.
        base = {t: 0.0 for t in ids_times}
        for jogo in jogos:
            base[jogo["mandante"]] += ataque[jogo["visitante"]]
            base[jogo["visitante"]] += ataque[jogo["mandante"]] * h
        defesa = {t: (gols_sofridos[t] + FORCA_PRIOR * defesa_media * e) / (base[t] + FORCA_PRIOR * e)
                  for t in ids_times}

        # Fator casa: puxado para FATOR_CASA_PRIOR pelos jogos imaginários.
        gols_casa_com_h_1 = sum(ataque[j["mandante"]] * defesa[j["visitante"]] for j in jogos)
        peso = FORCA_PRIOR_CASA * defesa_media
        h = (gols_dos_mandantes + peso * FATOR_CASA_PRIOR) / (gols_casa_com_h_1 + peso)

        mudanca = max(
            max(abs(ataque[t] - antes[0][t]) for t in ids_times),
            max(abs(defesa[t] - antes[1][t]) for t in ids_times),
            abs(h - antes[2]),
        )
        if mudanca < TOLERANCIA:
            return ataque, defesa, h
    sys.exit("Erro: a estimação não estabilizou.")


def montar_momentos(jogos):
    """A lista de momentos: antes do início, cada rodada da 1ª fase e cada parte do mata-mata.
    Só entram momentos cujos jogos já aconteceram todos. "ate" é a data do último jogo."""
    momentos = [{"id": "inicio", "rotulo": "Antes do 1º jogo", "curto": "Início", "ate": None}]

    primeira = [j for j in jogos if j["fase"] == "primeira-fase"]
    for rodada in sorted({j["rodada"] for j in primeira}):
        da_rodada = [j for j in primeira if j["rodada"] == rodada]
        if not all(j["disputado"] for j in da_rodada):
            break
        momentos.append({"id": f"rodada-{rodada}", "rotulo": f"Após a {rodada}ª rodada",
                         "curto": f"R{rodada}", "ate": max(j["data"] for j in da_rodada)})

    for fase, de_fase, a_fase, sigla in FASES_DO_CAMINHO:
        da_fase = [j for j in jogos if j["fase"] == fase]
        pernas = sorted({j["perna"] for j in da_fase})
        for perna in pernas:
            da_perna = [j for j in da_fase if j["perna"] == perna]
            if not da_perna or not all(j["disputado"] for j in da_perna):
                break
            ultima = perna == pernas[-1]
            if fase == "final" and ultima:
                rotulo, curto = "Fim do campeonato", "Fim"
            elif ultima:
                rotulo, curto = f"Após {a_fase}", sigla
            else:
                rotulo, curto = f"Após a ida {de_fase}", f"{sigla} ida"
            momentos.append({"id": f"{fase}-{perna}", "rotulo": rotulo, "curto": curto,
                             "ate": max(j["data"] for j in da_perna)})

    # Campeonato em andamento: se houver jogos depois do último momento completo,
    # acrescenta o momento "agora" (com tudo o que já aconteceu).
    disputados = [j for j in jogos if j["disputado"]]
    if disputados:
        ultimo_jogo = max(j["data"] for j in disputados)
        ultimo_momento = momentos[-1]["ate"]
        if ultimo_momento is None or ultimo_jogo > ultimo_momento:
            momentos.append({"id": "agora", "rotulo": "Agora", "curto": "Agora", "ate": ultimo_jogo})
    return momentos


def main():
    if len(sys.argv) != 2:
        sys.exit("Uso: python scripts/estaduais/estimar_estadual.py <campeonato>  (ex.: catarinense-2026)")
    # Os estaduais ficam em data/estaduais/; as copas (ex.: a Sul-Americana), em data/copas/.
    pasta = comum.PASTA_PROJETO / "data" / "estaduais" / sys.argv[1]
    if not pasta.exists():
        pasta = comum.PASTA_PROJETO / "data" / "copas" / sys.argv[1]
    arquivo_jogos = pasta / "jogos.json"
    if not arquivo_jogos.exists():
        sys.exit(f"Erro: {arquivo_jogos} não existe. Rode antes o script que baixa os jogos.")
    dados = json.loads(arquivo_jogos.read_text(encoding="utf-8"))
    ids_times = list(dados["times"])

    momentos = montar_momentos(dados["jogos"])
    for momento in momentos:
        conhecidos = [j for j in dados["jogos"]
                      if j["disputado"] and momento["ate"] is not None and j["data"] <= momento["ate"]]
        ataque, defesa, h = estimar(conhecidos, ids_times)
        momento["jogos_usados"] = len(conhecidos)
        momento["fator_casa"] = h
        momento["times"] = {t: {"ataque": ataque[t], "defesa": defesa[t]} for t in ids_times}

    saida = {
        "competicao": dados["competicao"],
        "temporada": dados["temporada"],
        "dados_baixados_em": dados["baixado_em"],
        "estimado_em": comum.agora_iso(),
        "parametros": {"forca_prior": FORCA_PRIOR, "gols_por_jogo_prior": GOLS_POR_JOGO_PRIOR,
                       "fator_casa_prior": FATOR_CASA_PRIOR, "forca_prior_casa": FORCA_PRIOR_CASA},
        "momentos": momentos,
    }
    comum.salvar_json(pasta / "modelos.json", saida)

    print(f"Salvo: {pasta / 'modelos.json'} ({len(momentos)} momentos)")
    nomes = {t: dados["times"][t]["nome"] for t in ids_times}
    for momento in momentos:
        forca = {t: v["ataque"] / v["defesa"] for t, v in momento["times"].items()}
        melhor = max(forca, key=forca.get)
        print(f"  {momento['rotulo']:<24} {momento['jogos_usados']:>3} jogos · casa {momento['fator_casa']:.2f}"
              f" · mais forte: {nomes[melhor]} ({forca[melhor]:.2f})")


if __name__ == "__main__":
    main()
