# baixar_catarinense.py
# Baixa todos os jogos do Campeonato Catarinense (Série A) do sistema oficial de
# resultados da Federação Catarinense de Futebol (FCF) e salva em
# data/estaduais/catarinense-<ano>/jogos.json. Também baixa os escudos para
# assets/escudos/catarinense/.
#
# Como rodar (na pasta do projeto):
#     python scripts/estaduais/baixar_catarinense.py
#
# Para outro ano (ex.: 2027), troque ANO e CODIGO_COMPETICAO abaixo e confira a lista TIMES
# (times que sobem e caem mudam a cada ano).

import html
import re
import sys
from datetime import datetime

import comum

ANO = 2026
# Código da competição no sistema da FCF (o "SelStart2" do endereço). Muda a cada ano.
CODIGO_COMPETICAO = 686
URL_JOGOS = (
    "https://egol.fcf.com.br/sisgol/DERW700B.asp?"
    f"SelStart1={ANO}&SelStop1={ANO}&SelStart2={CODIGO_COMPETICAO}&SelStop2={CODIGO_COMPETICAO}"
    "&SelStart3=&SelStop3=&SelStart4=&SelStop4=&SelStart5=&SelStop5=&RunReport=Executar+relat%F3rio"
)
PASTA_DADOS = comum.PASTA_PROJETO / "data" / "estaduais" / f"catarinense-{ANO}"
PASTA_ESCUDOS = comum.PASTA_PROJETO / "assets" / "escudos" / "catarinense"
TOTAL_JOGOS = 70

# Nome do time no sistema da FCF -> (id, nome para mostrar, sigla, grupo da 1ª fase, escudo).
# Os escudos vêm da Wikipédia (Wikimedia).
W = "https://upload.wikimedia.org/wikipedia"
TIMES = {
    "AVAÍ": ("avai", "Avaí", "AVA", "A", f"{W}/commons/8/8c/Ava%C3%AD_Futebol_Clube_logo.svg"),
    "BRUSQUE SAF": ("brusque", "Brusque", "BRU", "A", f"{W}/commons/b/ba/Brusque_Futebol_Clube_logo.svg"),
    "CAMBORIÚ SAF": ("camboriu", "Camboriú", "CAM", "A", f"{W}/pt/1/17/Escudo_do_Cambori%C3%BA_FC_%282022%29.png"),
    "CONCÓRDIA": ("concordia", "Concórdia", "CON", "A", f"{W}/pt/1/16/Conc%C3%B3rdia_Atl%C3%A9tico_Clube.png"),
    "JOINVILLE": ("joinville", "Joinville", "JEC", "A", f"{W}/pt/3/31/Joinville-SC.png"),
    "MARCÍLIO DIAS": ("marcilio-dias", "Marcílio Dias", "MAR", "A", f"{W}/pt/3/3f/Clube_N%C3%A1utico_Marc%C3%ADlio_Dias.png"),
    "BARRA": ("barra", "Barra", "BAR", "B", f"{W}/commons/4/40/Barra_FC_2021_crest.png"),
    "CARLOS RENAUX": ("carlos-renaux", "Carlos Renaux", "CRE", "B", f"{W}/pt/f/f1/CACarlos_Renaux.png"),
    # Chapecoense: o mesmo escudo usado no Brasileirão (football-data.org), para o site ficar igual em todas as páginas.
    "CHAPECOENSE": ("chapecoense", "Chapecoense", "CHA", "B", "https://crests.football-data.org/1772_large.png"),
    "CRICIÚMA": ("criciuma", "Criciúma", "CRI", "B", f"{W}/commons/9/9b/Crici%C3%BAma_EC_2025_crest.svg"),
    "FIGUEIRENSE SAF": ("figueirense", "Figueirense", "FIG", "B", f"{W}/commons/d/da/Figueirense_Futebol_Clube_logo.svg"),
    "SANTA CATARINA": ("santa-catarina", "Santa Catarina", "SAN", "B", f"{W}/pt/3/3e/Santa_Catarina_Clube_logo.png"),
}

# Como cada fase aparece nos cabeçalhos do relatório da FCF -> nome da fase no nosso arquivo.
# A ordem importa: "TAÇA ACESC ... SEMIFINAL" tem que ser reconhecida antes de "SEMIFINAIS".
FASES = [
    ("RODADA INICIAL", "primeira-fase"),
    ("QUADRANGULAR", "quadrangular"),
    ("QUARTAS", "quartas"),
    ("ACESC 70 ANOS - ELIMINAT", "acesc-eliminatorias"),
    ("ACESC 70 ANOS - SEMIFINAL", "acesc-semifinal"),
    ("ACESC 70 ANOS - FINAL", "acesc-final"),
    ("SEMIFINAIS", "semifinal"),
    ("FINAIS", "final"),
]


def ler_texto():
    """Baixa o relatório e transforma o HTML em texto corrido."""
    pagina = comum.baixar(URL_JOGOS).decode("cp1252")    # o site usa a codificação do Windows
    texto = re.sub(r"<[^>]+>", " ", pagina)                # tira as etiquetas HTML
    texto = html.unescape(texto).replace("\xa0", " ")
    return re.sub(r"\s+", " ", texto)                     # junta espaços repetidos


def separar_times(trecho):
    """O relatório escreve "MANDANTE VISITANTE" grudados. Separa pelos nomes conhecidos."""
    nomes = sorted(TIMES, key=len, reverse=True)           # nomes mais longos primeiro
    mandante = next((n for n in nomes if trecho.startswith(n)), None)
    if mandante is None:
        sys.exit(f"Erro: time desconhecido no começo de '{trecho[:40]}'. Atualize a lista TIMES.")
    resto = trecho[len(mandante):].strip()
    visitante = next((n for n in nomes if resto.startswith(n)), None)
    if visitante is None:
        sys.exit(f"Erro: time desconhecido no começo de '{resto[:40]}'. Atualize a lista TIMES.")
    return mandante, visitante


def ler_jogos(texto):
    # Um jogo: "Jogo: 37 - 01/02/2026 - Dom / 18:00 - Estádio: ... / Cidade 0 x 0 CONCÓRDIA BRUSQUE SAF"
    # Jogos ainda não disputados podem vir sem os números do placar.
    padrao = re.compile(
        r"Jogo: (\d+) - (\d{2})/(\d{2})/(\d{4}) - \S+ / (\d{2}):(\d{2}) - Estádio: .+? / \S+(?: \S+)*? "
        r"(\d*) ?x ?(\d*) ((?:[A-ZÀ-Ú ]+?))(?: Pênaltis: (\d+) x (\d+))?(?= Súmula| Jogo:| Boletim|$)")
    jogos = []
    fase = None
    confronto = None
    fim_anterior = 0
    for m in padrao.finditer(texto):
        cabecalho = texto[fim_anterior:m.start()].split("Boletim Financeiro")[-1]
        fim_anterior = m.end()
        for marca, nome_fase in FASES:
            if marca in cabecalho:
                fase = nome_fase
                break
        grupo = re.search(r"Grupo (\w)", cabecalho)
        if grupo:
            confronto = grupo.group(1)
        rodada = re.search(r"(\d+)ª RODADA", cabecalho)

        mandante, visitante = separar_times(m.group(9).strip())
        disputado = m.group(7) != "" and m.group(8) != ""
        data = datetime(int(m.group(4)), int(m.group(3)), int(m.group(2)), int(m.group(5)), int(m.group(6)),
                        tzinfo=comum.FUSO_BRASILIA)
        jogos.append({
            "id": f"cat{ANO}-{m.group(1)}",
            "numero": int(m.group(1)),
            "fase": fase,
            "rodada": int(rodada.group(1)) if rodada else None,
            "confronto": None if fase in ("primeira-fase", "quadrangular") else f"{fase}-{confronto}",
            "data": data.isoformat(),
            "mandante": TIMES[mandante][0],
            "visitante": TIMES[visitante][0],
            "disputado": disputado,
            "gols_mandante": int(m.group(7)) if disputado else None,
            "gols_visitante": int(m.group(8)) if disputado else None,
            "penaltis_mandante": int(m.group(10)) if m.group(10) else None,
            "penaltis_visitante": int(m.group(11)) if m.group(11) else None,
        })
    # A rodada da 1ª fase vem no cabeçalho, mas só no primeiro jogo de cada rodada:
    # os jogos seguintes herdam a rodada do anterior.
    ultima = None
    for jogo in jogos:
        if jogo["fase"] == "primeira-fase":
            jogo["rodada"] = jogo["rodada"] or ultima
            ultima = jogo["rodada"]
        elif jogo["fase"] != "quadrangular":
            jogo["rodada"] = None
    comum.numerar_rodadas([j for j in jogos if j["fase"] == "quadrangular"])
    comum.numerar_pernas([j for j in jogos if j["confronto"]])
    return sorted(jogos, key=lambda j: j["data"])


def main():
    print("Baixando os jogos do sistema da FCF...")
    jogos = ler_jogos(ler_texto())
    times = {id_: {"nome": nome, "sigla": sigla, "grupo": grupo}
             for (id_, nome, sigla, grupo, _) in TIMES.values()}
    escudos = {id_: url for (id_, _, _, _, url) in TIMES.values()}

    print("Baixando os escudos...")
    problemas_escudos = comum.baixar_escudos(times, PASTA_ESCUDOS, escudos.get)

    dados = {
        "competicao": "Campeonato Catarinense Série A",
        "temporada": ANO,
        "fonte": "Federação Catarinense de Futebol (egol.fcf.com.br)",
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
