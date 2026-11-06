# conferir_dados.py
# Confere se o data/serie-a/jogos.json está completo e coerente ANTES de publicar o site.
# Se algo estiver errado, lista os problemas e termina com "código de erro" 1.
# O GitHub Actions entende esse código como falha: para tudo e não publica nada.
#
# Como rodar:
#     python scripts/conferir_dados.py
# (Também aceita outro arquivo: python scripts/conferir_dados.py caminho/do/arquivo.json)

import json
import sys
from collections import Counter   # Counter conta quantas vezes cada coisa aparece
from pathlib import Path

import campeonatos


TOTAL_JOGOS = 380        # 20 times, turno e returno: 20 x 19
TOTAL_TIMES = 20
JOGOS_EM_CASA = 19       # cada time recebe cada um dos outros 19 uma vez


def placar_valido(gols):
    """Um placar válido é um número inteiro, 0 ou maior."""
    # (Em Python, True e False também contam como números; por isso a segunda checagem.)
    return isinstance(gols, int) and not isinstance(gols, bool) and gols >= 0


def conferir(dados):
    """Devolve a lista de problemas encontrados (vazia se estiver tudo certo)."""
    problemas = []
    times = dados["times"]
    jogos = dados["jogos"]

    # 1) Quantidades
    if len(jogos) != TOTAL_JOGOS:
        problemas.append(f"há {len(jogos)} jogos (esperado: {TOTAL_JOGOS})")
    if len(times) != TOTAL_TIMES:
        problemas.append(f"há {len(times)} times (esperado: {TOTAL_TIMES})")

    # 2) Nenhum jogo repetido
    ids_repetidos = [i for i, vezes in Counter(j["id"] for j in jogos).items() if vezes > 1]
    if ids_repetidos:
        problemas.append(f"jogos com o mesmo id: {ids_repetidos}")
    confrontos_repetidos = [c for c, vezes in Counter((j["mandante"], j["visitante"]) for j in jogos).items() if vezes > 1]
    if confrontos_repetidos:
        problemas.append(f"confrontos repetidos (mesmo mandante e visitante): {confrontos_repetidos}")

    # 3) Cada jogo: times conhecidos e, se já foi disputado, placar preenchido
    for jogo in jogos:
        descricao = f"jogo {jogo['id']} (rodada {jogo['rodada']}, {jogo['mandante']} x {jogo['visitante']})"
        for lado in ("mandante", "visitante"):
            if jogo[lado] not in times:
                problemas.append(f"{descricao}: time desconhecido '{jogo[lado]}'")
        if jogo["mandante"] == jogo["visitante"]:
            problemas.append(f"{descricao}: um time jogando contra ele mesmo")
        if jogo["disputado"]:
            if not (placar_valido(jogo["gols_mandante"]) and placar_valido(jogo["gols_visitante"])):
                problemas.append(f"{descricao}: encerrado, mas sem placar válido")

    # 4) Cada time: 19 jogos em casa e 19 fora
    em_casa = Counter(j["mandante"] for j in jogos)
    fora = Counter(j["visitante"] for j in jogos)
    for id_time, time in times.items():
        if em_casa[id_time] != JOGOS_EM_CASA or fora[id_time] != JOGOS_EM_CASA:
            problemas.append(f"{time['nome']}: {em_casa[id_time]} jogos em casa e {fora[id_time]} fora "
                             f"(esperado: {JOGOS_EM_CASA} e {JOGOS_EM_CASA})")

    return problemas


def main():
    # sys.argv é a lista do que foi digitado depois de "python": [nome do script, argumentos...].
    # Pode receber o caminho de um arquivo ou "--campeonato serie-b"; sem nada, a Série A.
    if len(sys.argv) > 1 and sys.argv[1] != "--campeonato":
        arquivo = Path(sys.argv[1])
    else:
        arquivo = campeonatos.ler_campeonato()["arquivo_jogos"]
    if not arquivo.exists():
        sys.exit(f"Erro: o arquivo {arquivo} não existe.")
    dados = json.loads(arquivo.read_text(encoding="utf-8"))

    problemas = conferir(dados)
    if problemas:
        print("Os dados NÃO passaram na conferência:")
        for problema in problemas:
            print(f"  - {problema}")
        sys.exit(1)   # código 1 = falhou

    disputados = sum(1 for j in dados["jogos"] if j["disputado"])
    print(f"Dados conferidos: {len(dados['jogos'])} jogos, {len(dados['times'])} times, "
          f"{disputados} jogos encerrados, todos com placar.")


if __name__ == "__main__":
    main()
