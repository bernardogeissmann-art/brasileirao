# campeonatos.py
# Ajudante comum aos scripts do Brasileirão (Série A e Série B).
# Cada campeonato tem uma "ficha" em data/<campeonato>/configuracao.json, com tudo o que
# muda de um para o outro: de onde vêm os jogos, quantos times, as faixas de posições, etc.
#
# Os scripts escolhem o campeonato pelo que foi digitado no terminal:
#     python scripts/baixar_jogos.py                         -> Série A (o padrão)
#     python scripts/baixar_jogos.py --campeonato serie-b    -> Série B
#
# Este arquivo não é rodado sozinho: os outros scripts usam a função ler_campeonato().

import json
import sys
from pathlib import Path

PASTA_PROJETO = Path(__file__).resolve().parent.parent
PASTA_DADOS = PASTA_PROJETO / "data"
PADRAO = "serie-a"


def campeonato_pedido(argumentos=None):
    """Lê o nome do campeonato depois de "--campeonato" (ex.: "serie-b"). Sem ele, Série A."""
    # sys.argv é a lista do que foi digitado: [nome do script, argumentos...].
    argumentos = sys.argv[1:] if argumentos is None else argumentos
    if "--campeonato" in argumentos:
        posicao = argumentos.index("--campeonato")
        if posicao + 1 >= len(argumentos):
            sys.exit("Erro: escreva o nome do campeonato depois de --campeonato (ex.: serie-b).")
        return argumentos[posicao + 1]
    return PADRAO


def ler_campeonato(nome=None):
    """Devolve a ficha do campeonato (um dicionário), com mais três campos:
    "pasta" (a pasta dos dados), "arquivo_jogos" e "arquivo_modelo"."""
    nome = nome or campeonato_pedido()
    pasta = PASTA_DADOS / nome
    arquivo = pasta / "configuracao.json"
    if not arquivo.exists():
        sys.exit(f"Erro: não achei a ficha do campeonato '{nome}' ({arquivo}).")
    ficha = json.loads(arquivo.read_text(encoding="utf-8"))
    ficha["pasta"] = pasta
    ficha["arquivo_jogos"] = pasta / "jogos.json"
    ficha["arquivo_modelo"] = pasta / "modelo.json"
    return ficha
