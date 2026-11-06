# gerar_teste_escudos.py
# Cria a página site/teste_escudos.html, que mostra o escudo e o nome de cada time,
# para conferir visualmente se cada escudo caiu no time certo.
#
# Como rodar (depois do baixar_jogos.py):
#     python scripts/gerar_teste_escudos.py
# Depois, dê dois cliques no arquivo site/teste_escudos.html para abrir no navegador.

import html               # protege textos que vão dentro do HTML
import json               # lê o jogos.json
import sys                # encerra o programa com mensagem de erro
from datetime import datetime
from pathlib import Path

PASTA_PROJETO = Path(__file__).resolve().parent.parent
ARQUIVO_JOGOS = PASTA_PROJETO / "data" / "serie-a" / "jogos.json"
ARQUIVO_PAGINA = PASTA_PROJETO / "site" / "teste_escudos.html"

# Modelo da página. As três aspas permitem escrever um texto de várias linhas.
# Os trechos entre {chaves}, como {cartoes}, são trocados depois pelo conteúdo de verdade.
# Por isso as chaves do CSS aparecem dobradas ({{ e }}): assim o Python sabe que
# são chaves de verdade, e não lugares para preencher.
MODELO_PAGINA = """<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Prob.com - teste dos escudos</title>
<style>
  body {{ font-family: system-ui, sans-serif; margin: 2rem; background: #f6f7f9; color: #1d2330; }}
  h1 {{ margin: 0 0 .25rem; font-size: 1.5rem; }}
  .info {{ margin: 0 0 1.5rem; color: #5b6475; }}
  .grade {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 1rem; }}
  .cartao {{ margin: 0; padding: 1rem; background: #fff; border: 1px solid #dde1e8;
             border-radius: 10px; text-align: center; }}
  .cartao img {{ width: 96px; height: 96px; object-fit: contain; }}
  .sem-escudo {{ width: 96px; height: 96px; margin: 0 auto; display: flex; align-items: center;
                 justify-content: center; border: 2px dashed #c0392b; border-radius: 50%;
                 color: #c0392b; font-size: .8rem; }}
  figcaption {{ margin-top: .5rem; font-weight: 600; }}
  code {{ display: block; margin-top: .2rem; font-weight: 400; font-size: .8rem; color: #5b6475; }}
</style>
</head>
<body>
<h1>Teste dos escudos</h1>
<p class="info">{resumo} &middot; gerado em {gerado_em}</p>
<div class="grade">
{cartoes}
</div>
</body>
</html>
"""


def carregar_times():
    """Lê o jogos.json e devolve só a parte dos times."""
    if not ARQUIVO_JOGOS.exists():
        sys.exit("Erro: data/serie-a/jogos.json não existe. Rode antes: python scripts/baixar_jogos.py")
    dados = json.loads(ARQUIVO_JOGOS.read_text(encoding="utf-8"))
    return dados["times"]


def montar_cartao(id_time, time):
    """Monta o pedaço de HTML de um time: escudo + nome + identificador."""
    # html.escape troca caracteres especiais (como < e &) por versões seguras,
    # para um nome estranho nunca "quebrar" a página.
    nome = html.escape(time["nome"])
    escudo = time.get("escudo")

    # Só mostra a imagem se o jogos.json aponta para um escudo e o arquivo existe mesmo.
    if escudo and (PASTA_PROJETO / escudo).exists():
        # A página fica em site/, então "../" sobe uma pasta para chegar em assets/.
        imagem = f'<img src="../{html.escape(escudo)}" alt="{nome}">'
    else:
        imagem = '<div class="sem-escudo">sem escudo</div>'

    # O identificador aparece embaixo do nome para conferir que bate com o nome do arquivo.
    return (f'  <figure class="cartao">{imagem}'
            f'<figcaption>{nome}<code>{html.escape(id_time)}</code></figcaption></figure>')


def main():
    times = carregar_times()                                                # 1) dados
    cartoes = [montar_cartao(id_time, time) for id_time, time in times.items()]  # 2) lógica
    com_escudo = sum(1 for time in times.values()
                     if time.get("escudo") and (PASTA_PROJETO / time["escudo"]).exists())

    # .format() preenche os {lugares} do modelo. "\n".join junta os cartões, um por linha.
    pagina = MODELO_PAGINA.format(                                          # 3) visual
        resumo=f"{com_escudo} de {len(times)} escudos encontrados",
        gerado_em=datetime.now().strftime("%d/%m/%Y %H:%M"),
        cartoes="\n".join(cartoes),
    )
    ARQUIVO_PAGINA.write_text(pagina, encoding="utf-8")
    print(f"Página criada: {ARQUIVO_PAGINA}")
    print(f"{com_escudo} de {len(times)} times com escudo.")


if __name__ == "__main__":
    main()
