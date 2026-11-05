# estimar_modelo.py
# Estima a força de cada time (ataque α e defesa β) e o fator casa h
# usando os jogos já disputados, e salva tudo em data/modelo.json.
#
# O modelo:
#   gols do mandante  ~ Poisson(α_mandante · β_visitante · h)
#   gols do visitante ~ Poisson(α_visitante · β_mandante)
#   com a restrição: média dos α = 1
#
# Como rodar (depois do baixar_jogos.py):
#     python scripts/estimar_modelo.py

import json
import math       # funções matemáticas: logaritmo, exponencial, fatorial
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

PASTA_PROJETO = Path(__file__).resolve().parent.parent
ARQUIVO_JOGOS = PASTA_PROJETO / "data" / "jogos.json"
ARQUIVO_MODELO = PASTA_PROJETO / "data" / "modelo.json"
FUSO_BRASILIA = timezone(timedelta(hours=-3))

# A estimação é feita por repetição: cada "volta" melhora a estimativa.
# Paramos quando, de uma volta para a outra, nenhum número muda mais que a
# TOLERANCIA (um valor minúsculo), ou depois de MAX_VOLTAS voltas.
TOLERANCIA = 1e-10    # 1e-10 é a notação científica de 0,0000000001
MAX_VOLTAS = 10_000   # o "_" só separa os milhares, para facilitar a leitura


# ---------------------------------------------------------------------------
# DADOS: ler o arquivo de jogos
# ---------------------------------------------------------------------------

def carregar_dados():
    """Lê o data/jogos.json."""
    if not ARQUIVO_JOGOS.exists():
        sys.exit("Erro: data/jogos.json não existe. Rode antes: python scripts/baixar_jogos.py")
    return json.loads(ARQUIVO_JOGOS.read_text(encoding="utf-8"))


# ---------------------------------------------------------------------------
# LÓGICA: as contas do modelo
# ---------------------------------------------------------------------------

def probabilidade_poisson(k, media):
    """Chance de sair exatamente k gols quando a média esperada é "media".
    Fórmula da Poisson: media^k · e^(-media) / k!"""
    # "**" é potência; math.exp(x) é e elevado a x; math.factorial(k) é k! (k fatorial).
    return media ** k * math.exp(-media) / math.factorial(k)


def gols_esperados(jogo, ataque, defesa, h):
    """Média de gols que o modelo espera de cada lado de um jogo."""
    m = jogo["mandante"]
    v = jogo["visitante"]
    media_mandante = ataque[m] * defesa[v] * h     # α_mandante · β_visitante · h
    media_visitante = ataque[v] * defesa[m]        # α_visitante · β_mandante
    return media_mandante, media_visitante


def log_verossimilhanca(jogos, ataque, defesa, h):
    """Mede o quanto os parâmetros "explicam" os placares que aconteceram.
    Quanto maior, melhor. É a soma dos logaritmos das chances de cada placar real."""
    total = 0.0
    for jogo in jogos:
        media_m, media_v = gols_esperados(jogo, ataque, defesa, h)
        # Usamos logaritmo porque multiplicar centenas de chances pequenas
        # daria um número pequeno demais para o computador; somar os logaritmos
        # dá o mesmo resultado sem esse problema.
        total += math.log(probabilidade_poisson(jogo["gols_mandante"], media_m))
        total += math.log(probabilidade_poisson(jogo["gols_visitante"], media_v))
    return total


def estimar(jogos, ids_times):
    """Encontra os α, β e h de máxima verossimilhança.

    Método: com os outros números fixos, existe uma conta exata para o melhor
    valor de cada parâmetro. Repetimos essas contas (ataques, defesas, h) até
    nada mais mudar. Cada volta só pode melhorar a verossimilhança, e no fim
    chegamos ao ponto máximo."""

    # Quantos gols cada time fez e sofreu no total, e quantos gols os mandantes fizeram.
    gols_feitos = {t: 0 for t in ids_times}     # cria {"bahia": 0, "botafogo": 0, ...}
    gols_sofridos = {t: 0 for t in ids_times}
    for jogo in jogos:
        m, v = jogo["mandante"], jogo["visitante"]   # duas variáveis de uma vez
        gols_feitos[m] += jogo["gols_mandante"]
        gols_sofridos[v] += jogo["gols_mandante"]
        gols_feitos[v] += jogo["gols_visitante"]
        gols_sofridos[m] += jogo["gols_visitante"]
    gols_dos_mandantes = sum(jogo["gols_mandante"] for jogo in jogos)

    # Ponto de partida: todo mundo igual (1,0). A repetição corrige isso.
    ataque = {t: 1.0 for t in ids_times}
    defesa = {t: 1.0 for t in ids_times}
    h = 1.0

    for volta in range(1, MAX_VOLTAS + 1):
        # Guarda os valores atuais para medir depois quanto mudaram.
        # dict(...) faz uma cópia; sem ela, a "cópia" mudaria junto com o original.
        ataque_antes, defesa_antes, h_antes = dict(ataque), dict(defesa), h

        # PASSO 1 - ATAQUES.
        # Para cada time, somamos quantos gols ele faria se o ataque dele fosse 1
        # (contra as defesas que enfrentou, com o fator casa quando jogou em casa).
        # O melhor ataque é: gols que fez / gols que faria com ataque 1.
        # Ex.: se com ataque 1 faria 40 gols e fez 50, o ataque dele é 50/40 = 1,25.
        gols_com_ataque_1 = {t: 0.0 for t in ids_times}
        for jogo in jogos:
            m, v = jogo["mandante"], jogo["visitante"]
            gols_com_ataque_1[m] += defesa[v] * h    # em casa: β do adversário · h
            gols_com_ataque_1[v] += defesa[m]        # fora: só o β do adversário
        ataque = {t: gols_feitos[t] / gols_com_ataque_1[t] for t in ids_times}

        # PASSO 2 - RESTRIÇÃO (média dos α = 1).
        # Dividir todos os ataques e multiplicar todas as defesas pelo mesmo número
        # não muda nenhuma média de gols (α·β fica igual), então pode ser feito livremente.
        media_ataques = sum(ataque.values()) / len(ataque)
        ataque = {t: a / media_ataques for t, a in ataque.items()}
        defesa = {t: b * media_ataques for t, b in defesa.items()}

        # PASSO 3 - DEFESAS. Mesma ideia: gols que sofreu / gols que sofreria com defesa 1.
        gols_com_defesa_1 = {t: 0.0 for t in ids_times}
        for jogo in jogos:
            m, v = jogo["mandante"], jogo["visitante"]
            gols_com_defesa_1[m] += ataque[v]        # em casa, sofre gols do visitante: α_v
            gols_com_defesa_1[v] += ataque[m] * h    # fora, sofre gols do mandante: α_m · h
        defesa = {t: gols_sofridos[t] / gols_com_defesa_1[t] for t in ids_times}

        # PASSO 4 - FATOR CASA. Gols reais dos mandantes / gols que fariam com h = 1.
        gols_casa_com_h_1 = sum(ataque[j["mandante"]] * defesa[j["visitante"]] for j in jogos)
        h = gols_dos_mandantes / gols_casa_com_h_1

        # Quanto o número que mais mudou mudou nesta volta? abs() tira o sinal (|x|).
        mudanca = max(
            max(abs(ataque[t] - ataque_antes[t]) for t in ids_times),
            max(abs(defesa[t] - defesa_antes[t]) for t in ids_times),
            abs(h - h_antes),
        )
        if mudanca < TOLERANCIA:
            return ataque, defesa, h, volta

    sys.exit(f"Erro: a estimação não estabilizou em {MAX_VOLTAS} voltas.")


def comparar_com_realidade(jogos, ataque, defesa, h):
    """Compara o que o modelo espera com o que aconteceu de verdade."""
    esperado_total = 0.0
    real_total = 0
    # Quantas vezes um time marcou 0, 1, 2, 3 e 4 ou mais gols num jogo.
    faixas = ["0", "1", "2", "3", "4+"]
    esperado_faixa = {f: 0.0 for f in faixas}
    real_faixa = {f: 0 for f in faixas}
    empates_esperados = 0.0
    empates_reais = 0

    for jogo in jogos:
        media_m, media_v = gols_esperados(jogo, ataque, defesa, h)
        esperado_total += media_m + media_v
        real_total += jogo["gols_mandante"] + jogo["gols_visitante"]

        # Cada jogo tem dois "lados" (mandante e visitante); olhamos os dois.
        for gols, media in ((jogo["gols_mandante"], media_m), (jogo["gols_visitante"], media_v)):
            chances = [probabilidade_poisson(k, media) for k in range(4)]   # chances de 0,1,2,3
            for k in range(4):
                esperado_faixa[str(k)] += chances[k]
            esperado_faixa["4+"] += 1 - sum(chances)   # o que sobra é a chance de 4 ou mais
            # min(gols, 4) transforma 5, 6, 7... em 4, para cair na faixa "4+".
            real_faixa[faixas[min(gols, 4)]] += 1

        # Chance de empate = chance de 0x0 + chance de 1x1 + chance de 2x2 + ...
        # (até 15x15 é mais que suficiente: placares maiores têm chance quase zero.)
        empates_esperados += sum(probabilidade_poisson(k, media_m) * probabilidade_poisson(k, media_v)
                                 for k in range(16))
        if jogo["gols_mandante"] == jogo["gols_visitante"]:
            empates_reais += 1

    return {
        "esperado_total": esperado_total, "real_total": real_total,
        "faixas": faixas, "esperado_faixa": esperado_faixa, "real_faixa": real_faixa,
        "empates_esperados": empates_esperados, "empates_reais": empates_reais,
    }


# ---------------------------------------------------------------------------
# SALVAR E MOSTRAR
# ---------------------------------------------------------------------------

def salvar(dados, ataque, defesa, h, log_v, jogos, comparacao):
    """Grava os parâmetros em data/modelo.json."""
    modelo = {
        "descricao": ("gols_mandante ~ Poisson(ataque_mandante * defesa_visitante * fator_casa); "
                      "gols_visitante ~ Poisson(ataque_visitante * defesa_mandante). "
                      "Média dos ataques = 1. Defesa maior = sofre mais gols."),
        "temporada": dados["temporada"],
        "dados_baixados_em": dados["baixado_em"],
        "estimado_em": datetime.now(FUSO_BRASILIA).isoformat(timespec="seconds"),
        "jogos_usados": len(jogos),
        "fator_casa": h,
        "log_verossimilhanca": log_v,
        # Guardado para os testes conferirem que o JavaScript faz a mesma conta.
        "empates_esperados": comparacao["empates_esperados"],
        "times": {
            t: {
                "nome": dados["times"][t]["nome"],
                "ataque": ataque[t],
                "defesa": defesa[t],
                "forca": ataque[t] / defesa[t],
            }
            for t in dados["times"]
        },
    }
    ARQUIVO_MODELO.write_text(json.dumps(modelo, ensure_ascii=False, indent=2), encoding="utf-8")


def imprimir(dados, ataque, defesa, h, voltas, jogos, comparacao):
    """Mostra o fator casa, o ranking de força e a comparação com a realidade."""
    print(f"Modelo estimado com {len(jogos)} jogos disputados "
          f"(estabilizou em {voltas} voltas).")
    print()
    print(f"Fator casa (h): {h:.3f}")
    # (h - 1) * 100 transforma 1.25 em 25 (%). ":.1f" mostra 1 casa decimal.
    print(f"  -> jogando em casa, um time marca {(h - 1) * 100:.1f}% gols a mais do que marcaria fora.")
    print()

    # Ordena os times pela força (α/β), da maior para a menor (reverse=True).
    ranking = sorted(ataque, key=lambda t: ataque[t] / defesa[t], reverse=True)
    print("Ranking por força (ataque / defesa):")
    print(f"{'Pos':>3}  {'Time':<20}{'Ataque α':>10}{'Defesa β':>10}{'Força α/β':>11}")
    for posicao, t in enumerate(ranking, start=1):
        print(f"{posicao:>3}  {dados['times'][t]['nome']:<20}"
              f"{ataque[t]:>10.3f}{defesa[t]:>10.3f}{ataque[t] / defesa[t]:>11.3f}")
    print("  Ataque maior = marca mais gols. Defesa menor = sofre menos gols.")
    print()

    c = comparacao
    print("Gols esperados pelo modelo x gols reais:")
    print(f"  Total: {c['esperado_total']:.1f} esperados x {c['real_total']} reais")
    print("  (Esses totais sempre batem: é uma propriedade da máxima verossimilhança")
    print("  neste modelo. Os testes abaixo dizem mais sobre a qualidade do ajuste.)")
    print()
    print("  Quantas vezes um time marcou X gols num jogo:")
    print(f"  {'Gols':>6}{'Esperado':>10}{'Real':>7}")
    for f in c["faixas"]:
        print(f"  {f:>6}{c['esperado_faixa'][f]:>10.1f}{c['real_faixa'][f]:>7}")
    print()
    print(f"  Empates: {c['empates_esperados']:.1f} esperados x {c['empates_reais']} reais")


def main():
    dados = carregar_dados()
    # Só os jogos disputados entram na estimação.
    jogos = [j for j in dados["jogos"] if j["disputado"]]
    ids_times = list(dados["times"])

    # Um time que ainda não jogou não tem como ter força estimada.
    times_que_jogaram = {j["mandante"] for j in jogos} | {j["visitante"] for j in jogos}
    if len(times_que_jogaram) < len(ids_times):
        sys.exit("Erro: todo time precisa ter pelo menos um jogo disputado para estimar o modelo.")

    ataque, defesa, h, voltas = estimar(jogos, ids_times)
    log_v = log_verossimilhanca(jogos, ataque, defesa, h)
    comparacao = comparar_com_realidade(jogos, ataque, defesa, h)

    salvar(dados, ataque, defesa, h, log_v, jogos, comparacao)
    imprimir(dados, ataque, defesa, h, voltas, jogos, comparacao)
    print()
    print(f"Parâmetros salvos em {ARQUIVO_MODELO}")


if __name__ == "__main__":
    main()
