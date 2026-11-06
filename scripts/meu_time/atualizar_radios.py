# atualizar_radios.py
# Confere, na RadiosNet (radios.com.br), o endereço da transmissão de cada rádio da seção
# "Oldschool / Old is cool" da página Meu Time, e troca o endereço quando a rádio mudar.
#
# A RadiosNet publica, para cada rádio, um arquivo .m3u com o endereço da transmissão (é o
# arquivo que ela oferece para ouvir em outros programas). O site precisa de endereços com
# cadeado (https), porque é servido com https e o navegador bloqueia áudio sem cadeado.
#
# Só troca um endereço por outro que responda com áudio de verdade. Se der problema, mantém o
# endereço antigo e avisa. Roda de madrugada, junto com a atualização diária.
#
# Como rodar (na pasta do projeto):
#     python scripts/meu_time/atualizar_radios.py

import json
import time
import urllib.request
from pathlib import Path

PASTA_PROJETO = Path(__file__).resolve().parent.parent.parent
ARQUIVO = PASTA_PROJETO / "data" / "radios.json"
CABECALHOS = {"User-Agent": "ProbCom/1.0 (projeto pessoal de estatistica)"}
URL_M3U = "https://www.radios.com.br/play/playlist/{numero}/listen-radio.m3u"


def baixar(url, limite=20000):
    pedido = urllib.request.Request(url, headers=CABECALHOS)
    with urllib.request.urlopen(pedido, timeout=15) as resposta:
        return resposta.headers.get("Content-Type", ""), resposta.read(limite)


def toca_audio(url):
    """O endereço responde com áudio (ou com uma lista de pedaços de áudio, no formato HLS)?"""
    try:
        tipo, dados = baixar(url, 2048)
    except OSError:
        return False
    tipo = tipo.lower()
    return len(dados) > 0 and ("audio" in tipo or "mpegurl" in tipo or "ogg" in tipo)


def endereco_com_cadeado(numero):
    """O endereço com https da transmissão de uma rádio, segundo a RadiosNet (ou None)."""
    _, m3u = baixar(URL_M3U.format(numero=numero))
    linhas = [l.strip() for l in m3u.decode("utf-8", "replace").splitlines() if l.strip().startswith("http")]
    for linha in linhas:
        # Muitas rádios publicam o endereço sem cadeado, mas também atendem com cadeado.
        candidato = linha if linha.startswith("https://") else "https://" + linha[len("http://"):]
        if toca_audio(candidato):
            return candidato
    return None


def main():
    dados = json.loads(ARQUIVO.read_text(encoding="utf-8"))
    trocadas, avisos = 0, []
    for chave, radio in dados["radios"].items():
        try:
            novo = endereco_com_cadeado(radio["radiosnet"])
        except OSError as erro:
            avisos.append(f"{radio['nome']}: não consegui ler a RadiosNet ({erro})")
            continue
        if novo is None:
            avisos.append(f"{radio['nome']}: nenhuma transmissão com https funcionando; mantive a antiga")
        elif novo != radio["transmissao"]:
            print(f"{radio['nome']}: endereço novo -> {novo}")
            radio["transmissao"] = novo
            trocadas += 1
        time.sleep(0.5)   # uma pausa entre as rádios, para não sobrecarregar a RadiosNet
    ARQUIVO.write_text(json.dumps(dados, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Rádios conferidas: {len(dados['radios'])}; endereços trocados: {trocadas}")
    for aviso in avisos:
        print(f"Aviso: {aviso}")


if __name__ == "__main__":
    main()
