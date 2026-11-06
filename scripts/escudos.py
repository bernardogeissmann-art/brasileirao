# escudos.py
# Baixa o escudo de cada time e salva em assets/escudos/<identificador>.svg (ou .png).
# O identificador é o mesmo usado no data/serie-a/jogos.json (ex.: "sao-paulo").
#
# Este arquivo não é rodado sozinho: o baixar_jogos.py usa as funções daqui.
# (Um arquivo .py cujas funções são usadas por outro se chama "módulo".)

from pathlib import Path   # monta caminhos de arquivos
import urllib.request      # baixa arquivos da internet

PASTA_PROJETO = Path(__file__).resolve().parent.parent
PASTA_ESCUDOS = PASTA_PROJETO / "assets" / "escudos"

# Alguns sites recusam pedidos que não dizem quem está pedindo.
# O "User-Agent" funciona como um crachá que se apresenta ao site.
# Repare que a chave da API NÃO vai aqui: os escudos são públicos e não precisam dela.
CABECALHOS = {"User-Agent": "Prob.com/1.0 (projeto pessoal)"}


def enderecos_para_tentar(url):
    """Lista os endereços a tentar, nesta ordem. Preferimos SVG (fica nítido em qualquer tamanho)."""
    # O football-data.org costuma ter o mesmo escudo em .png e em .svg.
    # Se a API informou o .png, tentamos antes o .svg e, se não existir, o .png.
    # url[:-4] é o texto sem os 4 últimos caracteres (tira o ".png").
    if url.endswith(".png"):
        return [url[:-4] + ".svg", url]
    return [url]


def descobrir_formato(conteudo):
    """Olha o começo do arquivo para saber se ele é mesmo uma imagem PNG ou SVG."""
    # Todo arquivo PNG começa com os mesmos bytes: \x89 seguido das letras "PNG".
    # (O "b" antes das aspas indica bytes, ou seja, o arquivo "cru", não texto.)
    if conteudo.startswith(b"\x89PNG"):
        return ".png"
    # Um SVG é um texto que contém a etiqueta <svg logo no começo.
    if b"<svg" in conteudo[:5000].lower():
        return ".svg"
    # Se não é nenhum dos dois (ex.: uma página de erro), devolve None (vazio).
    return None


def baixar_arquivo(url):
    """Baixa um endereço e devolve o conteúdo em bytes."""
    pedido = urllib.request.Request(url, headers=CABECALHOS)
    with urllib.request.urlopen(pedido, timeout=30) as resposta:
        return resposta.read()


def salvar_escudo(id_time, formato, conteudo):
    """Grava o escudo no disco e devolve o caminho dele (relativo à pasta do projeto)."""
    # Apaga um escudo antigo do mesmo time, se houver. Assim nunca ficam
    # dois arquivos (ex.: flamengo.png e flamengo.svg) para o mesmo time.
    # glob("flamengo.*") encontra todos os arquivos que se chamam "flamengo.<qualquer coisa>".
    for antigo in PASTA_ESCUDOS.glob(f"{id_time}.*"):
        antigo.unlink()   # unlink() apaga o arquivo
    nome_arquivo = f"{id_time}{formato}"            # ex.: "flamengo.svg"
    (PASTA_ESCUDOS / nome_arquivo).write_bytes(conteudo)
    return f"assets/escudos/{nome_arquivo}"


def baixar_escudos(times):
    """Baixa o escudo de cada time e anota o caminho no campo "escudo" do time.
    Devolve a lista de problemas encontrados (vazia se deu tudo certo)."""
    # parents=True cria também as pastas de cima, se faltarem; exist_ok=True
    # não reclama se a pasta já existir.
    PASTA_ESCUDOS.mkdir(parents=True, exist_ok=True)
    problemas = []

    for id_time, time in times.items():
        url = time.get("escudo_url")
        # Se a API não informou nenhum escudo para este time, anota e pula para o próximo.
        if not url:
            problemas.append(f"{time['nome']}: a API não informou o endereço do escudo")
            continue

        caminho = None   # vai guardar onde o escudo foi salvo (se der certo)
        motivo = ""      # vai guardar o porquê, se der errado
        for endereco in enderecos_para_tentar(url):
            try:
                conteudo = baixar_arquivo(endereco)
            # OSError reúne os erros de rede: página não encontrada (404),
            # sem internet, demora demais, etc. Anotamos e tentamos o próximo endereço.
            except OSError as erro:
                motivo = f"não consegui baixar {endereco} ({erro})"
                continue
            formato = descobrir_formato(conteudo)
            if formato is None:
                motivo = f"o arquivo de {endereco} não é PNG nem SVG"
                continue
            caminho = salvar_escudo(id_time, formato, conteudo)
            break   # "break" sai do "for": já temos o escudo, não precisa tentar outro endereço

        # Anota o caminho no time (vai parar no jogos.json) ou registra o problema.
        if caminho:
            time["escudo"] = caminho
        else:
            problemas.append(f"{time['nome']}: {motivo}")

    return problemas


def imprimir_resultado(times, problemas):
    """Mostra quantos escudos foram salvos e quais faltaram ou falharam."""
    salvos = sum(1 for time in times.values() if time["escudo"])
    print()
    print(f"Escudos salvos em assets/escudos/: {salvos} de {len(times)}")
    if problemas:
        print("Escudos que faltaram ou falharam:")
        for problema in problemas:
            print(f"  - {problema}")
