# baixar_acessos.py
# Baixa do GoatCounter os números de acesso do site e grava em painel/dados/acessos.json,
# que o painel (painel/acessos.html) lê. Os números ficam só no seu computador: a pasta
# painel/dados/ não vai para o git e o painel não é publicado.
#
# Antes, uma vez:
#   1) crie a conta em goatcounter.com (o código escolhido vira CODIGO em site/js/contador.js);
#   2) no GoatCounter, em Settings > API, crie uma chave ("token") só de leitura;
#   3) no arquivo .env, acrescente duas linhas:
#        GOATCOUNTER_CODIGO=o_codigo_escolhido
#        GOATCOUNTER_TOKEN=a_chave
#
# Como rodar (na pasta do projeto):
#     python scripts/painel/baixar_acessos.py            (últimos 30 dias)
#     python scripts/painel/baixar_acessos.py 90         (últimos 90 dias)

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta
from pathlib import Path

PASTA_PROJETO = Path(__file__).resolve().parent.parent.parent
ARQUIVO_ENV = PASTA_PROJETO / ".env"
ARQUIVO_SAIDA = PASTA_PROJETO / "painel" / "dados" / "acessos.json"


def ler_env(nome):
    """Lê uma variável do ambiente ou, se não houver, do arquivo .env."""
    valor = os.environ.get(nome, "").strip()
    if valor or not ARQUIVO_ENV.exists():
        return valor
    for linha in ARQUIVO_ENV.read_text(encoding="utf-8").splitlines():
        chave, _, resto = linha.partition("=")
        if chave.strip() == nome:
            return resto.strip().strip('"').strip("'")
    return ""


def pedir(codigo, token, caminho, **parametros):
    """Faz um pedido à API do GoatCounter e devolve a resposta já como dados do Python."""
    endereco = f"https://{codigo}.goatcounter.com/api/v0/{caminho}?{urllib.parse.urlencode(parametros)}"
    pedido = urllib.request.Request(endereco, headers={
        "Authorization": f"Bearer {token}",      # a chave vai no cabeçalho, nunca no endereço
        "Content-Type": "application/json",
        "User-Agent": "ProbCom/1.0 (painel de acessos)",
    })
    with urllib.request.urlopen(pedido, timeout=30) as resposta:
        return json.loads(resposta.read().decode("utf-8"))


def main():
    codigo, token = ler_env("GOATCOUNTER_CODIGO"), ler_env("GOATCOUNTER_TOKEN")
    if not codigo or not token:
        sys.exit("Faltam GOATCOUNTER_CODIGO e GOATCOUNTER_TOKEN no .env (veja o começo deste arquivo).")
    dias = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    fim = date.today()
    inicio = fim - timedelta(days=dias - 1)
    periodo = {"start": inicio.isoformat(), "end": fim.isoformat()}

    try:
        total = pedir(codigo, token, "stats/total", **periodo)
        paginas = pedir(codigo, token, "stats/hits", limit=20, **periodo)
        origens = pedir(codigo, token, "stats/toprefs", limit=10, **periodo)
        navegadores = pedir(codigo, token, "stats/browsers", limit=6, **periodo)
        sistemas = pedir(codigo, token, "stats/systems", limit=6, **periodo)
        telas = pedir(codigo, token, "stats/sizes", limit=6, **periodo)
    except urllib.error.HTTPError as erro:
        sys.exit(f"O GoatCounter recusou o pedido (erro {erro.code}). Confira o código e a chave no .env.")
    except OSError as erro:
        sys.exit(f"Não consegui falar com o GoatCounter ({erro}).")

    resumo = lambda resposta: [{"nome": s.get("name") or "(desconhecido)", "visitas": s.get("count", 0)}
                               for s in resposta.get("stats", [])]
    dados = {
        "exemplo": False,
        "baixado_em": datetime.now().astimezone().isoformat(timespec="seconds"),
        "inicio": inicio.isoformat(),
        "fim": fim.isoformat(),
        "por_dia": [{"dia": d["day"], "visitas": d.get("daily", 0)} for d in total.get("stats", [])],
        "paginas": [{"pagina": h.get("path"), "titulo": h.get("title") or "", "visitas": h.get("count", 0)}
                    for h in paginas.get("hits", [])],
        "origens": [{"nome": s.get("name") or "(acesso direto)", "visitas": s.get("count", 0)}
                    for s in origens.get("stats", [])],
        "navegadores": resumo(navegadores),
        "sistemas": resumo(sistemas),
        "telas": resumo(telas),
    }
    ARQUIVO_SAIDA.parent.mkdir(parents=True, exist_ok=True)
    ARQUIVO_SAIDA.write_text(json.dumps(dados, ensure_ascii=False, indent=1), encoding="utf-8")
    soma = sum(d["visitas"] for d in dados["por_dia"])
    print(f"{soma} visitas de {inicio:%d/%m} a {fim:%d/%m}. Salvo em {ARQUIVO_SAIDA}.")
    print("Para ver: python scripts/servidor_local.py e abra http://localhost:8000/painel/acessos.html")


if __name__ == "__main__":
    main()
