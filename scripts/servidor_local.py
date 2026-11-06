# servidor_local.py
# Liga um "servidor" no seu computador para você ver o site em http://localhost:8000.
# Faz o mesmo que "python -m http.server", com uma diferença importante: avisa o navegador
# para sempre conferir se o arquivo mudou antes de usar a cópia guardada (o "cache").
# Sem esse aviso, o navegador às vezes continua mostrando uma versão antiga do CSS ou do
# JavaScript, e parece que a correção não funcionou.
#
# Como rodar (na pasta do projeto):
#     python scripts/servidor_local.py
# Para desligar: Ctrl+C no terminal.

import http.server
import os
from functools import partial
from pathlib import Path

# Porta 8000, a não ser que alguém peça outra (a variável PORT, usada quando a 8000 está ocupada).
PORTA = int(os.environ.get("PORT", 8000))
PASTA_PROJETO = Path(__file__).resolve().parent.parent


class SemCacheVelho(http.server.SimpleHTTPRequestHandler):
    """Igual ao servidor padrão do Python, mas manda "Cache-Control: no-cache" em toda resposta.
    "no-cache" quer dizer: pode guardar a cópia, mas pergunte ao servidor se ela ainda vale
    antes de usar. Se o arquivo não mudou, o servidor responde só "não mudou" (rápido)."""

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


if __name__ == "__main__":
    atendente = partial(SemCacheVelho, directory=str(PASTA_PROJETO))
    with http.server.ThreadingHTTPServer(("127.0.0.1", PORTA), atendente) as servidor:
        print(f"Site no ar em http://localhost:{PORTA}  (para desligar: Ctrl+C)")
        servidor.serve_forever()
