# placar_ao_vivo.py
# Busca o placar dos jogos do Brasileirão que estão acontecendo agora (ou que acabaram há
# pouco) e salva em data/ao-vivo.json, para a seção "Jogos do dia" mostrar o placar de momento.
#
# Quem roda: o GitHub Actions, a cada 5 minutos no horário dos jogos (placar-ao-vivo.yml),
# e também a publicação normal do site. Se não houver jogo rolando, o script só diz
# "sem jogo agora" e nada é publicado (assim a rotina sai quase de graça).
#
# A fonte é a API pública da ESPN (a mesma dos estádios). O arquivo ao-vivo.json NÃO vai
# para o git: ele só existe na cópia publicada do site. O placar muda o tempo todo, e o
# placar final entra no jogos.json pela atualização da madrugada.
#
# Duas perguntas diferentes:
#   - QUANDO publicar: só quando há jogo rolando (do horário marcado até 130 minutos depois);
#   - O QUE publicar: o placar de todos os jogos do dia que já começaram (inclusive os que
#     já acabaram, para o placar final aparecer até a atualização da madrugada).
#
# Como rodar (na pasta do projeto):
#     python scripts/placar_ao_vivo.py                (só confere; busca o placar se houver jogo rolando)
#     python scripts/placar_ao_vivo.py --publicando   (sempre busca: usado na hora de publicar o site)
# Para testar como se fosse outro horário:
#     python scripts/placar_ao_vivo.py 2026-11-05T21:55:00-03:00

import json
import os
import sys
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

from estadios import TIMES_ESPN   # nome do time na ESPN -> o nosso identificador

PASTA_PROJETO = Path(__file__).resolve().parent.parent
ARQUIVO_JOGOS = PASTA_PROJETO / "data" / "jogos.json"
ARQUIVO_SAIDA = PASTA_PROJETO / "data" / "ao-vivo.json"
URL_DIA = "https://site.api.espn.com/apis/site/v2/sports/soccer/bra.1/scoreboard?dates={dia}"
CABECALHOS = {"User-Agent": "ProbCom/1.0 (projeto pessoal de estatistica)"}
FUSO_BRASILIA = timezone(timedelta(hours=-3))

# Quando um jogo conta como "rolando": de 5 minutos antes do horário marcado até 130 minutos
# depois. Um jogo leva uns 110 minutos do apito inicial ao final (45 + intervalo de 15 + 45 +
# acréscimos); o resto é folga para atrasos.
ANTES_DO_INICIO = timedelta(minutes=5)
DEPOIS_DO_INICIO = timedelta(minutes=130)


def jogos_rolando(jogos, agora):
    """Os jogos (ainda sem placar final no arquivo) que estão dentro da janela agora."""
    escolhidos = []
    for jogo in jogos:
        if jogo["disputado"] or jogo.get("status_fonte") == "POSTPONED":
            continue
        inicio = datetime.fromisoformat(jogo["data"])
        if inicio - ANTES_DO_INICIO <= agora <= inicio + DEPOIS_DO_INICIO:
            escolhidos.append(jogo)
    return escolhidos


def jogos_ja_comecados(jogos, agora):
    """Os jogos (ainda sem placar final no arquivo) que começaram nas últimas 24 horas."""
    escolhidos = []
    for jogo in jogos:
        if jogo["disputado"] or jogo.get("status_fonte") == "POSTPONED":
            continue
        inicio = datetime.fromisoformat(jogo["data"])
        if agora - timedelta(hours=24) <= inicio <= agora + ANTES_DO_INICIO:
            escolhidos.append(jogo)
    return escolhidos


def baixar_dia(dia):
    """Os jogos de um dia na ESPN (dia no formato 20261105)."""
    pedido = urllib.request.Request(URL_DIA.format(dia=dia), headers=CABECALHOS)
    with urllib.request.urlopen(pedido, timeout=30) as resposta:
        return json.load(resposta).get("events", [])


def situacao_na_espn(status):
    """Traduz a situação do jogo na ESPN: "antes", "andamento", "intervalo" ou "encerrado"."""
    estado = status["type"]["state"]   # "pre" (antes), "in" (rolando) ou "post" (acabou)
    if estado == "post":
        return "encerrado"
    if estado == "in":
        return "intervalo" if status["type"]["name"] == "STATUS_HALFTIME" else "andamento"
    return "antes"


def ler_placares(eventos, jogos):
    """Junta os eventos da ESPN com os nossos jogos (pelo par mandante x visitante)."""
    por_par = {(j["mandante"], j["visitante"]): j for j in jogos}
    placares = {}
    for evento in eventos:
        competicao = evento["competitions"][0]
        lados = {c["homeAway"]: c for c in competicao["competitors"]}
        par = (TIMES_ESPN.get(lados["home"]["team"]["displayName"]),
               TIMES_ESPN.get(lados["away"]["team"]["displayName"]))
        jogo = por_par.get(par)
        if jogo is None:
            continue
        situacao = situacao_na_espn(competicao["status"])
        if situacao == "antes":
            continue   # ainda não começou: o site mostra o horário normalmente
        placares[str(jogo["id"])] = {
            "gols_mandante": int(lados["home"]["score"]),
            "gols_visitante": int(lados["away"]["score"]),
            "situacao": situacao,
            "minuto": competicao["status"].get("displayClock") if situacao == "andamento" else None,
        }
    return placares


def avisar_github(tem_jogo):
    """Conta ao GitHub Actions se há jogo rolando (ele só publica o site quando há)."""
    saida = os.environ.get("GITHUB_OUTPUT")
    if saida:
        with open(saida, "a", encoding="utf-8") as arquivo:
            arquivo.write(f"tem_jogo={'true' if tem_jogo else 'false'}\n")


def salvar(placares, agora):
    dados = {"atualizado_em": agora.isoformat(timespec="seconds"), "fonte": "ESPN", "jogos": placares}
    ARQUIVO_SAIDA.write_text(json.dumps(dados, ensure_ascii=False, indent=1), encoding="utf-8")


def main():
    publicando = "--publicando" in sys.argv
    horario = [a for a in sys.argv[1:] if not a.startswith("--")]
    agora = datetime.fromisoformat(horario[0]) if horario else datetime.now(FUSO_BRASILIA)
    jogos = json.loads(ARQUIVO_JOGOS.read_text(encoding="utf-8"))["jogos"]

    rolando = jogos_rolando(jogos, agora)
    if not rolando and not publicando:
        print("Sem jogo agora.")
        avisar_github(False)
        return

    comecados = jogos_ja_comecados(jogos, agora)
    placares = {}
    if comecados:
        # A ESPN separa os jogos pelo dia do horário marcado (no horário de Brasília dá certo).
        dias = sorted({datetime.fromisoformat(j["data"]).strftime("%Y%m%d") for j in comecados})
        try:
            eventos = [evento for dia in dias for evento in baixar_dia(dia)]
        except (OSError, ValueError) as erro:
            # Sem a ESPN: na conferência, não publica nada (o site fica com o último placar);
            # na publicação normal, o site sai sem placar ao vivo.
            print(f"Não consegui consultar a ESPN ({erro}).")
            if not publicando:
                avisar_github(False)
                return
            eventos = []
        placares = ler_placares(eventos, comecados)

    salvar(placares, agora)
    for jogo in comecados:
        p = placares.get(str(jogo["id"]))
        if p:
            minuto = f", {p['minuto']}" if p["minuto"] else ""
            print(f"{jogo['mandante']} x {jogo['visitante']}: {p['gols_mandante']} x {p['gols_visitante']} ({p['situacao']}{minuto})")
    if not placares:
        print("Nenhum placar para mostrar agora.")
    avisar_github(bool(rolando))


if __name__ == "__main__":
    main()
