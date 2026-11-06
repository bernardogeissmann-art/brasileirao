# baixar_paranaense.py
# Baixa todos os jogos do Campeonato Paranaense (1ª divisão) do site da Federação Paranaense
# de Futebol (FPF) e salva em data/estaduais/paranaense-<ano>/jogos.json. Também junta os
# escudos em assets/escudos/paranaense/ (do Brasileirão ou da Wikipédia).
#
# A ESPN não cobre o Paranaense. Por isso lemos a página do campeonato no site da FPF:
# ela mostra cada jogo num "cartão" com fase, rodada, estádio, data, times e placar.
#
# Como rodar (na pasta do projeto):
#     python scripts/estaduais/baixar_paranaense.py
#
# Para outro ano (ex.: 2027), troque ANO e URL_CAMPEONATO (o número no fim do endereço muda
# a cada edição) e confira as listas TIMES e PENALTIS.

import html
import re
import sys
import unicodedata
from datetime import datetime

import comum

ANO = 2026
URL_CAMPEONATO = "https://federacaopr.com.br/competicoes/Profissional/2026/33/"
PASTA_DADOS = comum.PASTA_PROJETO / "data" / "estaduais" / f"paranaense-{ANO}"
PASTA_ESCUDOS = comum.PASTA_PROJETO / "assets" / "escudos" / "paranaense"
TOTAL_JOGOS = 54   # 36 da 1ª fase + 8 quartas + 4 semifinais + 2 finais + 4 do descenso

# Nome do time no site da FPF (sem acentos) -> (id, nome para mostrar, sigla, grupo da 1ª fase).
# Os grupos vêm do arbitral (reunião dos clubes) e não aparecem nos cartões dos jogos.
TIMES = {
    "ATHLETICO": ("athletico", "Athletico Paranaense", "CAP", "A"),
    "CASCAVEL": ("cascavel", "Cascavel", "CAS", "A"),
    "FOZ DO IGUACU": ("foz-do-iguacu", "Foz do Iguaçu", "FOZ", "A"),
    "LONDRINA": ("londrina", "Londrina", "LEC", "A"),
    "MARINGA": ("maringa", "Maringá", "MAR", "A"),
    "SAO JOSEENSE": ("sao-joseense", "São Joseense", "SJO", "A"),
    "ANDRAUS": ("andraus", "Andraus", "AND", "B"),
    "AZURIZ": ("azuriz", "Azuriz", "AZU", "B"),
    "CIANORTE": ("cianorte", "Cianorte", "CIA", "B"),
    "CORITIBA": ("coritiba", "Coritiba", "CFC", "B"),
    "GALO MARINGA": ("galo-maringa", "Galo Maringá", "GAL", "B"),
    "OPERARIO": ("operario", "Operário", "OPE", "B"),
}

# Nome da fase no site da FPF -> nome da fase no nosso arquivo.
FASES = {
    "primeira-fase": "primeira-fase",
    "quartas-final": "quartas",
    "semifinal": "semifinal",
    "final": "final",
    "descenso": "descenso",   # o "Torneio da Morte": quem perde cai para a 2ª divisão
}

# Disputas por pênaltis. O site da FPF mostra só o placar do jogo, então anotamos à mão
# (número do jogo no site da FPF -> pênaltis do mandante e do visitante).
# Fonte: Wikipédia, "Campeonato Paranaense de Futebol de 2026" (fase final).
PENALTIS = {
    "1022": (3, 0),   # quartas, volta: Londrina 1 x 1 São Joseense
    "1135": (5, 6),   # semifinal, volta: Coritiba 2 x 2 Operário
    "1354": (3, 4),   # final, volta: Londrina 0 x 0 Operário
}

# Clubes que também estão no Brasileirão: usam o mesmo escudo de lá (id aqui -> id lá).
DO_BRASILEIRAO = {"athletico": "paranaense", "coritiba": "coritiba"}

# Os outros escudos: endereços na Wikipédia (Wikimedia).
ESCUDOS = {
    "andraus": "https://upload.wikimedia.org/wikipedia/commons/1/1c/Clube_Andraus_Brasil_Ltda_%282019%29.png",
    "azuriz": "https://upload.wikimedia.org/wikipedia/commons/3/3f/Azuriz_FC.png",
    "cascavel": "https://upload.wikimedia.org/wikipedia/pt/2/29/FC_Cascavel.png",
    "cianorte": "https://upload.wikimedia.org/wikipedia/pt/1/11/Cianorte.png",
    "foz-do-iguacu": "https://upload.wikimedia.org/wikipedia/pt/c/c2/FOZ-FC-2014-229x300_%281%29.png",
    "galo-maringa": "https://upload.wikimedia.org/wikipedia/commons/c/c2/Galo_maringa_vetor_%281%29.png",
    "londrina": "https://upload.wikimedia.org/wikipedia/pt/9/96/Londrina_EC.png",
    "maringa": "https://upload.wikimedia.org/wikipedia/commons/b/b0/Escudo_do_Maring%C3%A1_FC_2026.png",
    "operario": "https://upload.wikimedia.org/wikipedia/commons/f/f0/Oper%C3%A1rio_Ferrovi%C3%A1rio_Esporte_Clube_logo.svg",
    "sao-joseense": "https://upload.wikimedia.org/wikipedia/commons/5/5d/S%C3%A3o_Joseense_2021_logo.png",
}


def sem_acentos(texto):
    """'FOZ DO IGUAÇU' -> 'FOZ DO IGUACU' (para comparar nomes sem se preocupar com acentos)."""
    decomposto = unicodedata.normalize("NFKD", texto)
    return "".join(c for c in decomposto if not unicodedata.combining(c)).upper().strip()


def ler_cartoes(pagina):
    """Lê os cartões de jogo da página. Cada cartão fica dentro de um "slide" de rodada.
    Os jogos do mata-mata aparecem mais de uma vez na página: guardamos pelo número do jogo."""
    pagina = re.sub(r"\s+", " ", pagina)
    pedacos = re.split(r'(?=<div class="zabmcbf-carousel-slide[ "])|(?=<div class="zabmcbf-carousel-jogo" )', pagina)
    cartoes = {}
    rodada = None
    for pedaco in pedacos:
        slide = re.match(r'<div class="zabmcbf-carousel-slide[^"]*" data-rodada="(\d+)"', pedaco)
        if slide:
            rodada = int(slide.group(1))
            continue
        jogo = re.match(r'<div class="zabmcbf-carousel-jogo" data-fase-key="([^"]*)">', pedaco)
        if not jogo:
            continue
        numero = re.search(r"/jogo/(\d+)/", pedaco).group(1)
        nomes = re.findall(r'class="zabmcbf-carousel-jogo-time-nome">(.*?)</div>', pedaco)
        placar = re.search(r'class="zabmcbf-carousel-jogo-placar-numero">(.*?)</span>', pedaco)
        data = re.search(r'class="zabmcbf-carousel-jogo-data">(.*?)</span>', pedaco)
        estadio = re.search(r'class="zabmcbf-carousel-jogo-estadio">(.*?)</span>', pedaco)
        cartoes.setdefault(numero, {
            "numero": numero, "fase": jogo.group(1), "rodada": rodada,
            "mandante": html.unescape(nomes[0]), "visitante": html.unescape(nomes[1]),
            "placar": html.unescape(placar.group(1)) if placar else "",
            "data": html.unescape(data.group(1)) if data else "",
            "estadio": html.unescape(estadio.group(1)).strip() if estadio else "",
        })
    return list(cartoes.values())


def ler_jogos(cartoes):
    jogos = []
    for c in cartoes:
        for lado in ("mandante", "visitante"):
            if sem_acentos(c[lado]) not in TIMES:
                sys.exit(f"Erro: time desconhecido no site da FPF: {c[lado]}. Atualize a lista TIMES.")
        if c["fase"] not in FASES:
            sys.exit(f"Erro: fase desconhecida no site da FPF: '{c['fase']}'. Atualize a lista FASES.")
        fase = FASES[c["fase"]]
        mandante = TIMES[sem_acentos(c["mandante"])][0]
        visitante = TIMES[sem_acentos(c["visitante"])][0]

        # Data no formato "01/02 · Dom · 18:30" (sem o ano).
        quando = re.search(r"(\d{2})/(\d{2}).*?(\d{2}):(\d{2})", c["data"])
        if not quando:
            sys.exit(f"Erro: data que não entendi no jogo {c['numero']}: '{c['data']}'")
        dia, mes, hora, minuto = (int(x) for x in quando.groups())
        data = datetime(ANO, mes, dia, hora, minuto, tzinfo=comum.FUSO_BRASILIA)

        # Placar "2 x 1" quando o jogo já aconteceu; sem números quando ainda não.
        gols = re.match(r"\s*(\d+)\s*x\s*(\d+)\s*$", c["placar"])
        disputado = gols is not None
        penaltis = PENALTIS.get(c["numero"], (None, None))
        mata_mata = fase != "primeira-fase"
        jogos.append({
            "id": f"par{ANO}-{c['numero']}",
            "numero": int(c["numero"]),
            "fase": fase,
            "rodada": c["rodada"] if fase == "primeira-fase" else None,
            "confronto": f"{fase}-{'-'.join(sorted([mandante, visitante]))}" if mata_mata else None,
            "data": data.isoformat(),
            "mandante": mandante,
            "visitante": visitante,
            "estadio": c["estadio"] or None,
            "disputado": disputado,
            "gols_mandante": int(gols.group(1)) if disputado else None,
            "gols_visitante": int(gols.group(2)) if disputado else None,
            "penaltis_mandante": penaltis[0],
            "penaltis_visitante": penaltis[1],
        })
    comum.numerar_pernas([j for j in jogos if j["confronto"]])
    return sorted(jogos, key=lambda j: (j["data"], j["numero"]))


def main():
    print("Baixando a página do campeonato no site da FPF...")
    pagina = comum.baixar(URL_CAMPEONATO).decode("utf-8", errors="replace")
    jogos = ler_jogos(ler_cartoes(pagina))
    times = {id_: {"nome": nome, "sigla": sigla, "grupo": grupo} for (id_, nome, sigla, grupo) in TIMES.values()}

    print("Juntando os escudos...")
    comum.copiar_escudos_do_brasileirao(PASTA_ESCUDOS, DO_BRASILEIRAO)
    problemas_escudos = comum.baixar_escudos(times, PASTA_ESCUDOS, ESCUDOS.get)

    dados = {
        "competicao": "Campeonato Paranaense",
        "temporada": ANO,
        "fonte": "Federação Paranaense de Futebol (federacaopr.com.br)",
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
