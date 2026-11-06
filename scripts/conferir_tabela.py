# conferir_tabela.py
# Calcula a tabela atual do Brasileirão a partir de data/serie-a/jogos.json,
# para comparar com a tabela oficial e ter certeza de que os dados estão certos.
#
# Como rodar (depois de rodar o baixar_jogos.py):
#     python scripts/conferir_tabela.py

import json               # lê o arquivo JSON
import sys                # encerra o programa com mensagem de erro
from pathlib import Path  # monta caminhos de arquivos

# Mesma ideia do outro script: sobe duas pastas a partir deste arquivo
# para chegar na pasta do projeto, e de lá aponta para data/serie-a/jogos.json.
PASTA_PROJETO = Path(__file__).resolve().parent.parent
ARQUIVO_JOGOS = PASTA_PROJETO / "data" / "serie-a" / "jogos.json"


def carregar_jogos():
    """Lê o data/serie-a/jogos.json e devolve os dados."""
    if not ARQUIVO_JOGOS.exists():
        sys.exit("Erro: data/serie-a/jogos.json não existe. Rode antes: python scripts/baixar_jogos.py")
    # json.loads transforma o texto do arquivo em dicionários e listas do Python.
    return json.loads(ARQUIVO_JOGOS.read_text(encoding="utf-8"))


def registrar_resultado(linha, gols_feitos, gols_sofridos):
    """Soma um jogo na linha da tabela de um time."""
    # "+=" quer dizer "some a este valor": x += 1 é o mesmo que x = x + 1.
    linha["jogos"] += 1
    linha["gols_pro"] += gols_feitos
    linha["gols_contra"] += gols_sofridos

    # if / elif / else = "se / senão, se / senão".
    if gols_feitos > gols_sofridos:      # venceu: 3 pontos
        linha["vitorias"] += 1
        linha["pontos"] += 3
    elif gols_feitos == gols_sofridos:   # empatou: 1 ponto ("==" compara; "=" guarda valor)
        linha["empates"] += 1
        linha["pontos"] += 1
    else:                                # perdeu: 0 pontos
        linha["derrotas"] += 1


def calcular_tabela(dados):
    """Monta a tabela de classificação e devolve uma lista já ordenada."""
    # Cria uma linha zerada para cada time. O resultado é um dicionário
    # onde a "chave" é o id do time e o "valor" é a linha dele na tabela.
    linhas = {}
    for id_time, time in dados["times"].items():
        linhas[id_time] = {
            "nome": time["nome"],
            "pontos": 0, "jogos": 0, "vitorias": 0, "empates": 0, "derrotas": 0,
            "gols_pro": 0, "gols_contra": 0,
        }

    # Passa por todos os jogos e soma os que já foram disputados.
    for jogo in dados["jogos"]:
        # "continue" pula para o próximo jogo: jogos não disputados não entram na tabela.
        if not jogo["disputado"]:
            continue
        gols_casa = jogo["gols_mandante"]
        gols_fora = jogo["gols_visitante"]
        # O mesmo jogo conta para os dois times, cada um do seu ponto de vista.
        registrar_resultado(linhas[jogo["mandante"]], gols_casa, gols_fora)
        registrar_resultado(linhas[jogo["visitante"]], gols_fora, gols_casa)

    # Saldo de gols = gols marcados - gols sofridos.
    for linha in linhas.values():
        linha["saldo"] = linha["gols_pro"] - linha["gols_contra"]

    # Ordena pelos critérios de desempate da CBF: pontos, vitórias, saldo, gols pró.
    # O sinal de menos inverte a ordem (maior primeiro). O nome entra no fim
    # só para a ordem nunca ficar "aleatória" quando tudo empatar.
    # (Confronto direto e cartões, os critérios seguintes, não estão no jogos.json.)
    return sorted(
        linhas.values(),
        key=lambda l: (-l["pontos"], -l["vitorias"], -l["saldo"], -l["gols_pro"], l["nome"]),
    )


def imprimir_tabela(tabela, dados):
    """Mostra a tabela na tela, com colunas alinhadas."""
    disputados = sum(1 for j in dados["jogos"] if j["disputado"])
    print(f"Tabela calculada com {disputados} jogos disputados "
          f"(dados baixados em {dados['baixado_em']})")
    print()
    # ":>4" = alinhar à direita em 4 espaços; ":<22" = à esquerda em 22 espaços.
    print(f"{'Pos':>3}  {'Time':<22}{'P':>4}{'J':>4}{'V':>4}{'E':>4}{'D':>4}"
          f"{'GP':>5}{'GC':>5}{'SG':>5}")

    # enumerate() numera os itens da lista; start=1 faz começar do 1 (e não do 0).
    for posicao, l in enumerate(tabela, start=1):
        # ":+d" mostra o número sempre com sinal: +12, -3, +0.
        print(f"{posicao:>3}  {l['nome']:<22}{l['pontos']:>4}{l['jogos']:>4}"
              f"{l['vitorias']:>4}{l['empates']:>4}{l['derrotas']:>4}"
              f"{l['gols_pro']:>5}{l['gols_contra']:>5}{l['saldo']:>+5d}")

    print()
    print("P = pontos, J = jogos, V = vitórias, E = empates, D = derrotas,")
    print("GP = gols pró, GC = gols contra, SG = saldo de gols")


def main():
    dados = carregar_jogos()           # 1) dados: lê o arquivo
    tabela = calcular_tabela(dados)    # 2) lógica: faz as contas
    imprimir_tabela(tabela, dados)     # 3) visual: mostra na tela


if __name__ == "__main__":
    main()
