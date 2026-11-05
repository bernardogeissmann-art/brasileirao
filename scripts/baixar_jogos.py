# baixar_jogos.py
# Baixa os 380 jogos do Brasileirão Série A 2026 do site football-data.org
# (os que já aconteceram, com placar, e os que ainda faltam) e salva em data/jogos.json.
#
# Como rodar: abra o terminal na pasta do projeto e digite
#     python scripts/baixar_jogos.py

# ---------------------------------------------------------------------------
# 1) FERRAMENTAS
# "import" traz ferramentas prontas que já vêm junto com o Python.
# Nada aqui precisa ser instalado à parte.
# ---------------------------------------------------------------------------
import json              # lê e escreve arquivos JSON (um formato de texto para guardar dados)
import re                # "expressões regulares": busca e troca de padrões dentro de textos
import sys               # permite encerrar o programa mostrando uma mensagem de erro
import unicodedata       # ajuda a tirar acentos ("São Paulo" vira "Sao Paulo")
import urllib.error      # os tipos de erro que podem acontecer ao acessar a internet
import urllib.request    # faz pedidos a sites, ou seja, baixa os dados
from datetime import datetime, timedelta, timezone  # datas, horas e fusos horários
from pathlib import Path  # monta caminhos de arquivos (funciona igual no Windows e no Mac)

# Este "import" é diferente: traz funções de um arquivo nosso, o scripts/escudos.py.
import escudos

# ---------------------------------------------------------------------------
# 2) CONSTANTES
# Valores fixos que o programa usa. Por costume, ficam em MAIÚSCULAS.
# Deixá-los aqui em cima facilita mudar depois (ex.: trocar a temporada).
# ---------------------------------------------------------------------------

# __file__ é o caminho deste arquivo. .parent sobe uma pasta (para scripts/)
# e o segundo .parent sobe mais uma (para a pasta do projeto).
# Assim o script acha os arquivos de qualquer lugar de onde for rodado.
PASTA_PROJETO = Path(__file__).resolve().parent.parent

# O operador "/" junta pedaços de caminho: pasta do projeto + ".env".
ARQUIVO_ENV = PASTA_PROJETO / ".env"
ARQUIVO_SAIDA = PASTA_PROJETO / "data" / "jogos.json"

TEMPORADA = 2026

# Endereço da API. "BSA" é o código do Brasileirão Série A no football-data.org.
# O "f" antes das aspas permite colocar variáveis dentro de {chaves}.
URL_JOGOS = f"https://api.football-data.org/v4/competitions/BSA/matches?season={TEMPORADA}"

# Horário de Brasília = 3 horas a menos que o horário universal (UTC).
FUSO_BRASILIA = timezone(timedelta(hours=-3))

# Situações em que o jogo conta como disputado:
# FINISHED = terminou; AWARDED = resultado decidido fora de campo (ex.: W.O.).
# Jogos em andamento, adiados ou ainda não jogados contam como "restantes".
STATUS_DISPUTADO = {"FINISHED", "AWARDED"}


# ---------------------------------------------------------------------------
# 3) FUNÇÕES
# Uma função é um bloco de código com nome, que só roda quando é "chamada".
# "def" cria a função; o que está entre parênteses são as informações que ela recebe;
# "return" devolve o resultado. Tudo que está recuado (com espaços) pertence a ela.
# ---------------------------------------------------------------------------

def ler_chave_api():
    """Lê a chave da API guardada no arquivo .env."""
    # Se o arquivo .env não existe, encerra o programa explicando o que fazer.
    if not ARQUIVO_ENV.exists():
        sys.exit("Erro: não achei o arquivo .env. Copie o .env.example para .env "
                 "e coloque nele a sua chave do football-data.org.")

    # Lê o arquivo inteiro como texto e separa em linhas.
    # "for ... in ..." repete o bloco abaixo uma vez para cada linha.
    for linha in ARQUIVO_ENV.read_text(encoding="utf-8").splitlines():
        # partition("=") corta a linha no primeiro "=":
        # "FOOTBALL_DATA_API_KEY=abc123" vira ("FOOTBALL_DATA_API_KEY", "=", "abc123").
        # O "_" guarda o "=" do meio, que não nos interessa.
        nome, _, valor = linha.partition("=")
        # strip() tira espaços (e aqui também aspas) das pontas do texto.
        if nome.strip() == "FOOTBALL_DATA_API_KEY":
            chave = valor.strip().strip('"')
            # Confere se a chave foi mesmo preenchida.
            if chave and chave != "coloque_sua_chave_aqui":
                return chave

    # Se chegou aqui, não havia chave válida no arquivo.
    sys.exit("Erro: coloque sua chave no arquivo .env, na linha "
             "FOOTBALL_DATA_API_KEY=sua_chave")


def baixar_dados(chave):
    """Pede os jogos à API e devolve a resposta já convertida em dados do Python."""
    # Monta o pedido: o endereço + a chave no cabeçalho "X-Auth-Token",
    # que é onde o football-data.org espera recebê-la.
    pedido = urllib.request.Request(URL_JOGOS, headers={"X-Auth-Token": chave})

    # "try" significa "tente fazer isto". Se der erro, o Python pula para
    # o "except" correspondente em vez de travar com uma mensagem confusa.
    try:
        # urlopen faz o pedido de fato (espera até 30 segundos pela resposta).
        # "with" garante que a conexão é fechada no final.
        with urllib.request.urlopen(pedido, timeout=30) as resposta:
            # json.load transforma o texto JSON recebido em listas e dicionários.
            return json.load(resposta)

    # HTTPError: o site respondeu, mas com um código de erro.
    except urllib.error.HTTPError as erro:
        if erro.code in (400, 401, 403):
            sys.exit("Erro: a API recusou a chave. Confira se a chave no .env "
                     "está certa e sem espaços.")
        if erro.code == 429:
            sys.exit("Erro: muitos pedidos seguidos (o limite grátis é 10 por minuto). "
                     "Espere um minuto e tente de novo.")
        sys.exit(f"Erro {erro.code} ao baixar os dados: {erro.reason}")

    # URLError: nem conseguiu falar com o site (sem internet, por exemplo).
    except urllib.error.URLError as erro:
        sys.exit(f"Erro: não consegui conectar ao football-data.org ({erro.reason}). "
                 "Confira sua internet.")


def criar_id(nome):
    """Transforma o nome do time num identificador simples: "São Paulo" -> "sao-paulo"."""
    # normalize("NFKD") separa a letra do acento ("ã" vira "a" + "~");
    # encode("ascii", "ignore") joga fora o que não é letra simples (os acentos);
    # decode("ascii") transforma de volta em texto normal.
    sem_acento = unicodedata.normalize("NFKD", nome).encode("ascii", "ignore").decode("ascii")
    # lower() deixa tudo minúsculo. re.sub troca qualquer sequência de caracteres
    # que não seja letra (a-z) ou número (0-9) por um hífen. strip("-") tira
    # hífens que sobrarem nas pontas.
    return re.sub(r"[^a-z0-9]+", "-", sem_acento.lower()).strip("-")


def registrar_time(times, time_api):
    """Guarda as informações de um time no dicionário "times" e devolve o id dele."""
    # Usa o nome curto ("Flamengo"); se a API não tiver, usa o nome completo.
    # .get() busca um campo e devolve None (vazio) se ele não existir.
    nome = time_api.get("shortName") or time_api["name"]
    id_time = criar_id(nome)

    # Segurança: se dois times diferentes gerarem o mesmo id, para tudo,
    # porque isso misturaria os resultados dos dois.
    if id_time in times and times[id_time]["id_fonte"] != time_api["id"]:
        sys.exit(f"Erro: dois times diferentes geraram o mesmo identificador '{id_time}'.")

    # Um dicionário guarda pares "campo: valor", como uma ficha de cadastro.
    times[id_time] = {
        "nome": nome,
        "sigla": time_api.get("tla"),          # sigla de 3 letras, ex.: "FLA"
        "id_fonte": time_api["id"],            # o número que o football-data.org usa
        "escudo_url": time_api.get("crest"),   # endereço da imagem do escudo na internet
        "escudo": None,   # arquivo do escudo no nosso projeto; o escudos.py preenche depois
    }
    return id_time


def organizar(dados_api):
    """Converte a resposta da API para o nosso formato, mais simples e em português."""
    times = {}   # dicionário vazio: vai receber os times
    jogos = []   # lista vazia: vai receber os jogos

    # A API devolve os jogos dentro do campo "matches". Passamos por cada um.
    for partida in dados_api["matches"]:
        mandante = registrar_time(times, partida["homeTeam"])
        visitante = registrar_time(times, partida["awayTeam"])

        # True (verdadeiro) se o jogo já foi disputado; False (falso) se não.
        disputado = partida["status"] in STATUS_DISPUTADO
        # Placar final do jogo, no formato {"home": gols do mandante, "away": gols do visitante}.
        placar = partida["score"]["fullTime"]
        # A API manda a data em horário universal; convertemos para Brasília.
        data = datetime.fromisoformat(partida["utcDate"]).astimezone(FUSO_BRASILIA)

        # append() adiciona um item no fim da lista.
        jogos.append({
            "id": partida["id"],
            "rodada": partida["matchday"],
            "data": data.isoformat(),   # ex.: "2026-04-12T16:00:00-03:00"
            "mandante": mandante,
            "visitante": visitante,
            "disputado": disputado,
            # "X if condição else Y": usa os gols só se o jogo foi disputado;
            # se não, guarda None (vazio). Isso evita gravar placar parcial de jogo em andamento.
            "gols_mandante": placar["home"] if disputado else None,
            "gols_visitante": placar["away"] if disputado else None,
            "status_fonte": partida["status"],  # situação original, como a API informou
        })

    # Ordena os jogos por rodada e, dentro da rodada, por data.
    # "lambda j: (...)" é uma mini-função que diz o critério de ordenação.
    jogos.sort(key=lambda j: (j["rodada"], j["data"]))

    return {
        "fonte": "football-data.org",
        "competicao": "Campeonato Brasileiro Série A",
        "temporada": TEMPORADA,
        "baixado_em": datetime.now(FUSO_BRASILIA).isoformat(timespec="seconds"),
        # sorted() coloca os times em ordem alfabética de id, para ficar fácil de achar.
        "times": dict(sorted(times.items())),
        "jogos": jogos,
    }


def salvar(dados):
    """Grava os dados em data/jogos.json."""
    # Cria a pasta data/ se, por algum motivo, ela não existir.
    ARQUIVO_SAIDA.parent.mkdir(exist_ok=True)
    # json.dumps transforma os dados em texto JSON.
    # ensure_ascii=False mantém os acentos; indent=2 deixa o arquivo legível para humanos.
    texto = json.dumps(dados, ensure_ascii=False, indent=2)
    ARQUIVO_SAIDA.write_text(texto, encoding="utf-8")


def imprimir_resumo(dados):
    """Mostra na tela um resumo do que foi baixado."""
    times = dados["times"]
    jogos = dados["jogos"]
    # "Compreensão de lista": cria uma nova lista só com os jogos disputados.
    disputados = [j for j in jogos if j["disputado"]]
    restantes = len(jogos) - len(disputados)   # len() conta quantos itens há

    print()   # print() sem nada imprime uma linha em branco
    print(f"Resumo - Brasileirão Série A {dados['temporada']}")
    print(f"  Total de jogos:   {len(jogos)}")
    print(f"  Número de times:  {len(times)}")
    print(f"  Jogos disputados: {len(disputados)}")
    print(f"  Jogos restantes:  {restantes}")
    print()

    # Cabeçalho da tabela. ":<22" = alinhar à esquerda ocupando 22 espaços;
    # ":>8" = alinhar à direita ocupando 8 espaços. Isso deixa as colunas retinhas.
    print(f"  {'Jogos em casa por time':<24}{'Total':>6}{'Disputados':>12}{'Restantes':>11}")

    avisos = []   # lista para guardar problemas encontrados
    # .items() devolve cada par (id, ficha do time).
    for id_time, time in times.items():
        em_casa = [j for j in jogos if j["mandante"] == id_time]
        # sum(1 for ...) conta quantos jogos em casa já foram disputados.
        feitos = sum(1 for j in em_casa if j["disputado"])
        print(f"  {time['nome']:<24}{len(em_casa):>6}{feitos:>12}{len(em_casa) - feitos:>11}")
        # Num campeonato de 20 times em turno e returno, cada um joga 19 vezes em casa.
        if len(em_casa) != 19:
            avisos.append(f"{time['nome']} tem {len(em_casa)} jogos em casa (esperado: 19)")

    # Confere os números gerais do campeonato.
    if len(jogos) != 380:
        avisos.append(f"total de jogos é {len(jogos)} (esperado: 380)")
    if len(times) != 20:
        avisos.append(f"número de times é {len(times)} (esperado: 20)")

    # Uma lista com itens conta como "verdadeira" no if; uma lista vazia, como "falsa".
    if avisos:
        print()
        print("ATENÇÃO, algo não bate:")
        for aviso in avisos:
            print(f"  - {aviso}")


def main():
    """Função principal: chama as outras na ordem certa."""
    chave = ler_chave_api()
    print("Baixando os jogos do football-data.org...")
    dados_api = baixar_dados(chave)
    dados = organizar(dados_api)
    # Os escudos são baixados antes de salvar, para o jogos.json já guardar
    # o caminho de cada escudo (ex.: "assets/escudos/flamengo.svg").
    print("Baixando os escudos dos times...")
    problemas_escudos = escudos.baixar_escudos(dados["times"])
    salvar(dados)
    print(f"Jogos salvos em {ARQUIVO_SAIDA}")
    imprimir_resumo(dados)
    escudos.imprimir_resultado(dados["times"], problemas_escudos)


# Esta linha quer dizer: "se este arquivo foi rodado diretamente, execute main()".
# Ela permite que outros arquivos reaproveitem as funções acima sem baixar nada.
if __name__ == "__main__":
    main()
