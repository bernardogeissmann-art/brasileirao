# estadios.py
# Descobre em que estádio cada jogo do Brasileirão acontece e anota no campo "estadio".
# O football-data.org não informa o estádio, então usamos a API pública da ESPN, que
# informa o estádio de cada partida (inclusive as que ainda vão acontecer).
#
# Este arquivo não é rodado sozinho: o baixar_jogos.py usa a função anotar_estadios() daqui.
# Se a ESPN estiver fora do ar, os jogos ficam sem estádio e o resto continua normalmente.

import json
import time
import urllib.request

CABECALHOS = {"User-Agent": "ProbCom/1.0 (projeto pessoal de estatistica)"}
URL_MES = "https://site.api.espn.com/apis/site/v2/sports/soccer/bra.1/scoreboard?dates={ano}{mes:02d}"

# Nome do time na ESPN -> o nosso identificador (o mesmo do jogos.json).
TIMES_ESPN = {
    "Athletico-PR": "paranaense", "Atlético-MG": "mineiro", "Bahia": "bahia", "Botafogo": "botafogo",
    "Chapecoense": "chapecoense", "Corinthians": "corinthians", "Coritiba": "coritiba", "Cruzeiro": "cruzeiro",
    "Flamengo": "flamengo", "Fluminense": "fluminense", "Grêmio": "gremio", "Internacional": "internacional",
    "Mirassol": "mirassol", "Palmeiras": "palmeiras", "Red Bull Bragantino": "bragantino", "Remo": "clube-do-remo",
    "Santos": "santos", "São Paulo": "sao-paulo", "Vasco da Gama": "vasco-da-gama", "Vitória": "vitoria",
}

# A ESPN escreve alguns nomes em inglês ou sem acento. Aqui ficam os nomes como queremos
# mostrar: "nome oficial (nome popular)". Um estádio novo que não estiver aqui aparece
# do jeito que a ESPN escreve (e o script avisa, para acrescentarmos à lista).
NOMES_ESTADIOS = {
    "Arena da Baixada": "Estádio Joaquim Américo Guimarães (Arena da Baixada)",
    "Arena MRV": "Arena MRV",
    "Arena Fonte Nova": "Arena Fonte Nova",
    "Joao Havelange Stadium": "Estádio Nilton Santos (Engenhão)",
    "Arena BRB Mané Garrincha": "Estádio Mané Garrincha",
    "Arena Condá": "Arena Condá",
    "Neo Química Arena": "Neo Química Arena (Itaquerão)",
    "Estádio Vila Belmiro (Urbano Caldeira)": "Estádio Urbano Caldeira (Vila Belmiro)",
    "Couto Pereira": "Estádio Couto Pereira",
    "Estadio Mineirão": "Estádio Governador Magalhães Pinto (Mineirão)",
    "Estadio do Maracana": "Estádio Jornalista Mário Filho (Maracanã)",
    "Arena do Grêmio": "Arena do Grêmio",
    "Estadio Beira-Rio": "Estádio José Pinheiro Borda (Beira-Rio)",
    "Estadio Municipal José Maria de Campos Maia": "Estádio José Maria de Campos Maia (Maião)",
    # O estádio do Palmeiras mudou de nome (direitos de nome); a ESPN ainda usa o antigo.
    "Allianz Parque": "Nubank Parque",
    "Nubank Parque": "Nubank Parque",
    "Arena Barueri": "Arena Barueri",
    "Estádio Municipal Cicero de Souza Marques": "Estádio Cícero de Souza Marques",
    "Mangueirão": "Estádio Jornalista Edgar Proença (Mangueirão)",
    "Estadio Evandro Almeida (Baenao)": "Estádio Evandro Almeida (Baenão)",
    "Estádio Cícero Pompeu de Toledo": "Estádio Cícero Pompeu de Toledo (Morumbi)",
    "Estádio do Canindé": "Estádio do Canindé",
    "Estádio Brinco de Ouro da Princesa": "Estádio Brinco de Ouro da Princesa",
    "Estádio São Januário": "Estádio São Januário",
    "Estadio Manoel Barradas": "Estádio Manoel Barradas (Barradão)",
}


def baixar_mes(ano, mes):
    pedido = urllib.request.Request(URL_MES.format(ano=ano, mes=mes), headers=CABECALHOS)
    with urllib.request.urlopen(pedido, timeout=30) as resposta:
        return json.load(resposta).get("events", [])


def estadios_da_espn(ano):
    """Devolve { (mandante, visitante): nome do estádio } para a temporada inteira.
    Num campeonato de turno e returno, cada mandante x visitante acontece uma vez só,
    então esse par basta para achar o jogo."""
    estadios = {}
    desconhecidos = set()
    for mes in range(1, 13):
        for evento in baixar_mes(ano, mes):
            competicao = evento["competitions"][0]
            lados = {c["homeAway"]: c["team"]["displayName"] for c in competicao["competitors"]}
            mandante = TIMES_ESPN.get(lados.get("home"))
            visitante = TIMES_ESPN.get(lados.get("away"))
            nome_espn = (competicao.get("venue") or {}).get("fullName")
            if not (mandante and visitante and nome_espn):
                continue
            if nome_espn not in NOMES_ESTADIOS:
                desconhecidos.add(nome_espn)
            estadios[(mandante, visitante)] = NOMES_ESTADIOS.get(nome_espn, nome_espn)
        time.sleep(0.5)   # uma pausa entre os pedidos, para não sobrecarregar o site
    return estadios, desconhecidos


def anotar_estadios(dados):
    """Coloca o campo "estadio" em cada jogo. Devolve a lista de avisos (vazia se tudo certo).
    Também anota em cada time o nome dele na ESPN ("nome_espn"): é por esse nome que a página
    principal acha o placar ao vivo de cada jogo, lendo a ESPN direto no navegador."""
    for nome_espn, id_time in TIMES_ESPN.items():
        if id_time in dados["times"]:
            dados["times"][id_time]["nome_espn"] = nome_espn
    try:
        estadios, desconhecidos = estadios_da_espn(dados["temporada"])
    except OSError as erro:
        for jogo in dados["jogos"]:
            jogo["estadio"] = None
        return [f"não consegui consultar a ESPN ({erro}); os jogos ficaram sem estádio"]

    avisos = [f"estádio sem nome em português na lista: '{nome}'" for nome in sorted(desconhecidos)]
    sem_estadio = 0
    for jogo in dados["jogos"]:
        jogo["estadio"] = estadios.get((jogo["mandante"], jogo["visitante"]))
        if jogo["estadio"] is None:
            sem_estadio += 1
    if sem_estadio:
        avisos.append(f"{sem_estadio} jogos ficaram sem estádio")
    return avisos
