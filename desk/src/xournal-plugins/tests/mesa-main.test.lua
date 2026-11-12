-- Teste da cola do plugin MesaPagina (#159) sem o Xournal++: um `app` falso
-- registra as chamadas e o teste confere a ordem (insere antes de apagar),
-- o refresh da página, os diálogos por callback, a limpeza dos temporários e
-- a recusa no Windows.
--   lua desk/src/xournal-plugins/tests/mesa-main.test.lua
-- (Assume-se que este arquivo é executado a partir da raiz do repo.)

local raiz = debug.getinfo(1, "S").source:gsub("^@", ""):match("^(.+)/tests/[^/]+$") or "."
local function tenta(caminho)
  local ok = pcall(dofile, caminho)
  if ok then return caminho end
  return nil
end
local dirPlugin = tenta("desk/src/xournal-plugins/MesaPagina/main.lua")
  and "desk/src/xournal-plugins/MesaPagina"
  or (raiz .. "/MesaPagina")

package.path = dirPlugin .. "/?.lua;" .. package.path

local falhas = 0
local function igual(got, esperado, nome)
  if got ~= esperado then
    falhas = falhas + 1
    print(string.format("FALHOU %s: recebeu %s, esperava %s", nome, tostring(got), tostring(esperado)))
  else
    print(string.format("passou %s = %s", nome, tostring(got)))
  end
end

local function contem(texto, trecho, nome)
  if type(texto) ~= "string" or texto:find(trecho, 1, true) == nil then
    falhas = falhas + 1
    print(string.format("FALHOU %s: não achou %q em %s", nome, trecho, tostring(texto):sub(1, 200)))
  else
    print(string.format("passou %s", nome))
  end
end

local function naoContem(texto, trecho, nome)
  if type(texto) ~= "string" or texto:find(trecho, 1, true) ~= nil then
    falhas = falhas + 1
    print(string.format("FALHOU %s: achou %q onde não devia", nome, trecho))
  else
    print(string.format("passou %s", nome))
  end
end

local function comprimento(texto)
  return utf8.len(texto) or #texto
end

local chamadas, dialogos, respostas, estado, tmpnames
local todosTmpnames = {}
local reais = {
  tmpname = os.tmpname,
  getenv = os.getenv,
  execute = os.execute,
  popen = io.popen,
  open = io.open,
  remove = os.remove,
}

local function reset()
  chamadas, dialogos, respostas, tmpnames = {}, {}, {}, {}
  estado = {
    tracos = {{x = {10, 30, 50}, y = {10, 30, 10}, width = 2, color = 0}},
    bbox = {x = 10, y = 10, width = 40, height = 20},
    textosSelecao = {},
    textosCamada = {},
    fontes = {families = {}, current = nil},
    falhaAdd = false,
    falharOpen = nil,
    popenSaida = '{"text":"teste"}\n200',
    runtime = nil,
    camadaAtual = 1,
  }
end
reset()

local function registra(nome, ...)
  chamadas[#chamadas + 1] = {nome = nome, args = table.pack(...)}
end

local function indice(nome, desde)
  for i = desde or 1, #chamadas do
    if chamadas[i].nome == nome then return i end
  end
  return nil
end

local function indiceAcao(acao)
  for i = 1, #chamadas do
    local chamada = chamadas[i]
    if chamada.nome == "activateAction" and chamada.args[1] == acao then return i end
  end
  return nil
end

local function existe(caminho)
  local f = reais.open(caminho, "r")
  if f then f:close() return true end
  return false
end

app = {
  getStrokes = function(tipo) registra("getStrokes", tipo) return estado.tracos end,
  getToolInfo = function(tipo)
    if tipo == "selection" then return {boundingBox = estado.bbox} end
    if tipo == "text" then return {font = {name = "Sans", size = 12}} end
    return {}
  end,
  getFont = function() return {name = "Sans", size = 12} end,
  getFonts = function() return estado.fontes end,
  getDocumentStructure = function()
    return {currentPage = 1, pages = {{currentLayer = estado.camadaAtual, pageWidth = 595.275591, pageHeight = 841.889764, layers = {{}, {}, {}}}}}
  end,
  getTexts = function(tipo)
    if tipo == "selection" then return estado.textosSelecao end
    if tipo == "layer" then return estado.textosCamada[estado.camadaAtual] or {} end
    return {}
  end,
  setCurrentLayer = function(camada) estado.camadaAtual = camada end,
  addTexts = function(opcoes)
    registra("addTexts", opcoes)
    if estado.falhaAdd then error("addTexts falhou de propósito") end
    local refs = {}
    for i = 1, #opcoes.texts do refs[i] = "novo-" .. i end
    return refs
  end,
  clearSelection = function() registra("clearSelection") end,
  addToSelection = function(refs) registra("addToSelection", refs) end,
  activateAction = function(acao) registra("activateAction", acao) end,
  refreshPage = function() registra("refreshPage") end,
  setPageSize = function(largura, altura) registra("setPageSize", largura, altura) end,
  scrollToPos = function(x, y, relativo) registra("scrollToPos", x, y, relativo) end,
  setCurrentLayerName = function(nome) registra("setCurrentLayerName", nome) end,
  registerUi = function(opcoes) registra("registerUi", opcoes) end,
  openDialog = function(mensagem, opcoes, cb, erro)
    dialogos[#dialogos + 1] = {mensagem = mensagem, opcoes = opcoes, cb = cb, erro = erro}
    local resposta = table.remove(respostas, 1)
    if resposta ~= nil and type(cb) == "string" and cb ~= "" and type(_G[cb]) == "function" then
      _G[cb](resposta)
    end
  end,
  msgbox = function() error("app.msgbox não pode ser chamado (deprecado na 1.3.8)") end,
}

os.tmpname = function()
  local nome = reais.tmpname()
  tmpnames[#tmpnames + 1] = nome
  todosTmpnames[#todosTmpnames + 1] = nome
  return nome
end
os.getenv = function(chave)
  if chave == "LEARNING_DESK_RUNTIME" then return estado.runtime end
  return reais.getenv(chave)
end
os.execute = function(comando)
  registra("os.execute", comando)
  return 0
end
io.popen = function(comando)
  registra("io.popen", comando)
  if estado.popenSaida == nil then return nil end
  local saida = estado.popenSaida
  return {read = function() return saida end, close = function() return true end}
end
io.open = function(caminho, modo)
  if estado.falharOpen == "header" and caminho == tmpnames[1] then return nil end
  if estado.falharOpen == "body" and caminho == tmpnames[2] then return nil end
  return reais.open(caminho, modo)
end

-- A pasta do runtime falso: `mesa-runtime.json` do repo vem vazio, então o
-- plugin cai no LEARNING_DESK_RUNTIME (o nosso `os.getenv` aponta para cá).
local dirRuntime = os.tmpname() .. ".d"
reais.execute("mkdir -p '" .. dirRuntime .. "'")
local arquivoPonte = reais.open(dirRuntime .. "/ink-convert-bridge.json", "w")
arquivoPonte:write('{"port":45678,"token":"abcdefghijklmnop1234"}')
arquivoPonte:close()

local okMain, erroMain = pcall(dofile, dirPlugin .. "/main.lua")
if not okMain then
  falhas = falhas + 1
  print("FALHOU carregar o main.lua: " .. tostring(erroMain))
else

-- Menu: o rótulo diz que a conversão age na seleção (#159, achado 15) ----------

reset()
local okInitUi = pcall(initUi)
igual(okInitUi, true, "menu: initUi registra os itens")
local menus = {}
for i = 1, #chamadas do
  if chamadas[i].nome == "registerUi" then menus[#menus + 1] = chamadas[i].args[1].menu end
end
local achouMenu = false
local achouDireita = false
local achouAbaixo = false
for _, menu in ipairs(menus) do
  if menu == "Converter a seleção em texto…" then achouMenu = true end
  if menu == "Página atual +2 cm à direita" then achouDireita = true end
  if menu == "Página atual +2 cm abaixo" then achouAbaixo = true end
end
igual(achouMenu, true, "menu: Converter diz que age na seleção e leva reticências")
igual(achouDireita, true, "menu: item da direita diz que age na página atual")
igual(achouAbaixo, true, "menu: item de baixo diz que age na página atual")

-- Windows ---------------------------------------------------------------------

local configReal = package.config
package.config = "\\\n;\n?\n!\n-\n"
reset()
respostas = {}
local okWindows = pcall(converter_tinta)
igual(okWindows, true, "Windows: converter_tinta não explode")
igual(#dialogos, 1, "Windows: mostra um aviso e sai")
if #dialogos == 1 then
  igual(dialogos[1].mensagem, "A conversão ainda não funciona no Windows; por enquanto, use a Mesa no Linux ou no macOS.", "Windows: mensagem diz a saída")
  igual(dialogos[1].erro, false, "Windows: diálogo sem o título de erro do Xournal++")
end
igual(indice("io.popen") ~= nil, false, "Windows: não chama curl")
igual(indice("os.execute") ~= nil, false, "Windows: não chama chmod")
package.config = configReal

-- Sem seleção: validação com diálogo neutro (#159, achado 16) ------------------

reset()
estado.tracos = {}
local okSemSelecao = pcall(converter_tinta)
igual(okSemSelecao, true, "sem seleção: converter_tinta não explode")
igual(#dialogos, 1, "sem seleção: um só diálogo")
if #dialogos == 1 then
  igual(dialogos[1].mensagem, "Selecione um trecho de tinta para converter em texto.", "sem seleção: mensagem clara")
  igual(dialogos[1].erro, false, "sem seleção: diálogo sem o título de erro do Xournal++")
end

-- Ponte conferida antes do aviso de congelamento (#159, achados 3 e 4) ---------

reset()
estado.runtime = nil
local okSemPonte = pcall(converter_tinta)
igual(okSemPonte, true, "sem ponte: converter_tinta não explode")
igual(#dialogos, 1, "sem ponte: um só diálogo, sem a confirmação")
if #dialogos == 1 then
  igual(dialogos[1].cb, "", "sem ponte: não abre o aviso de congelamento")
  igual(dialogos[1].erro, false, "sem ponte: diálogo sem o título de erro do Xournal++")
  igual(dialogos[1].mensagem, 'A conversão precisa da Mesa aberta e da opção “Buscar também na escrita à mão” ligada em Cadernos. Abra a Mesa, ligue a leitura da tinta e tente de novo.', "sem ponte: texto exato com a opção ligada (#159, achado 3 da rodada 5)")
  contem(dialogos[1].mensagem, "Abra a Mesa", "sem ponte: diz para abrir a Mesa")
  contem(dialogos[1].mensagem, "Buscar também na escrita à mão", "sem ponte: nomeia o interruptor da Mesa")
  contem(dialogos[1].mensagem, "“Buscar também na escrita à mão”", "sem ponte: cita o interruptor com aspas curvas (#159, achado 7)")
  naoContem(dialogos[1].mensagem, '"', "sem ponte: sem aspas retas na mensagem")
  contem(dialogos[1].mensagem, "Cadernos", "sem ponte: diz onde fica o interruptor")
  naoContem(dialogos[1].mensagem, "ponte de conversão", "sem ponte: sem jargão de ponte")
end

-- Aumentar página: a vista acompanha o espaço novo (#159, achado 12) -----------

reset()
local okDireita = pcall(pagina_para_direita)
igual(okDireita, true, "direita: roda até o fim")
local iTamanhoDir = indice("setPageSize")
local iScrollDir = indice("scrollToPos")
igual(iTamanhoDir ~= nil, true, "direita: muda o tamanho da página")
igual(iScrollDir ~= nil, true, "direita: rola a vista para o espaço novo")
if iTamanhoDir and iScrollDir then
  igual(iScrollDir > iTamanhoDir, true, "direita: rola depois de aumentar")
end
if iScrollDir then
  local passoPt = 2 * (72 / 2.54)
  local x, y = chamadas[iScrollDir].args[1], chamadas[iScrollDir].args[2]
  igual(math.abs(x - passoPt) < 1e-9, true, "direita: rola o passo de 2 cm para a direita")
  igual(y, 0, "direita: não rola na vertical")
end

reset()
local okAbaixo = pcall(pagina_para_baixo)
igual(okAbaixo, true, "abaixo: roda até o fim")
local iScrollAbaixo = indice("scrollToPos")
if iScrollAbaixo then
  local passoPt = 2 * (72 / 2.54)
  local x, y = chamadas[iScrollAbaixo].args[1], chamadas[iScrollAbaixo].args[2]
  igual(x, 0, "abaixo: não rola na horizontal")
  igual(math.abs(y - passoPt) < 1e-9, true, "abaixo: rola o passo de 2 cm para baixo")
else
  igual(false, true, "abaixo: rola a vista para o espaço novo")
end

-- Conversão: aviso por openDialog, refresh e camada nova ----------------------

local function preparaConversao()
  reset()
  estado.runtime = dirRuntime
  respostas = {1}
end

preparaConversao()
local okConv = pcall(converter_tinta)
igual(okConv, true, "conversão: roda até o fim")
igual(#dialogos >= 1, true, "conversão: avisa antes de ler a tinta")
if #dialogos >= 1 then
  local aviso = dialogos[1]
  contem(aviso.mensagem, "vai parar de responder por até 20 segundos", "conversão: o aviso diz que a janela para de responder (#159, achado 2)")
  contem(aviso.mensagem, "não feche a janela", "conversão: o aviso pede para não fechar a janela")
  naoContem(aviso.mensagem, "pode congelar", "conversão: não ameniza o congelamento")
  contem(aviso.mensagem, "“Texto convertido”", "conversão: cita a camada com aspas curvas (#159, achado 7)")
  naoContem(aviso.mensagem, '"', "conversão: sem aspas retas no aviso")
  contem(aviso.mensagem, "camada nova", "conversão: o aviso diz que o texto entra numa camada nova")
  contem(aviso.mensagem, "tinta original fica", "conversão: o aviso diz que a tinta original fica")
  igual(aviso.cb, "converter_confirmado", "conversão: o aviso usa openDialog com callback")
  igual(aviso.opcoes[1], "Continuar", "conversão: primeiro botão é Continuar")
  igual(aviso.opcoes[2], "Cancelar", "conversão: segundo botão é Cancelar")
  igual(aviso.erro, false, "conversão: o aviso não usa o título de erro do Xournal++")
end
local iPopen = indice("io.popen")
igual(iPopen ~= nil, true, "conversão: chama a ponte pelo curl")
if iPopen then contem(chamadas[iPopen].args[1], "curl", "conversão: usa curl no Linux/macOS") end
local iCamada = indiceAcao("layer-new-above-current")
local iNome = indice("setCurrentLayerName")
local iAdd = indice("addTexts")
local iRefresh = indice("refreshPage")
igual(iCamada ~= nil, true, "conversão: cria camada nova acima")
igual(iNome ~= nil, true, "conversão: nomeia a camada")
igual(iAdd ~= nil, true, "conversão: insere o texto")
if iAdd then
  local caixa = chamadas[iAdd].args[1].texts[1]
  igual(caixa.text, "teste", "conversão: texto vem da ponte")
  igual(caixa.font.size, 12, "conversão: segue a fonte da ferramenta")
end
if iAdd and iRefresh then
  igual(iRefresh > iAdd, true, "conversão: refreshPage depois de addTexts")
else
  igual(iRefresh ~= nil, true, "conversão: chama refreshPage depois de addTexts")
end
if iCamada and iAdd then igual(iCamada < iAdd, true, "conversão: camada criada antes do texto") end
if iNome and iAdd then igual(iNome < iAdd, true, "conversão: camada nomeada antes do texto") end
for _, nome in ipairs(tmpnames) do
  igual(existe(nome), false, "conversão: temporário apagado (" .. nome:match("[^/]+$") .. ")")
end

-- Fonte: inserir antes de apagar e preservar tamanho -------------------------

local function preparaFonte()
  reset()
  estado.textosSelecao = {{text = "a", font = {name = "Velha", size = 24}, color = 0, x = 1, y = 2, ref = "ref-a"}}
  estado.fontes = {families = {"Noto Sans", "DejaVu Sans", "Fonte 3", "Fonte 4", "Fonte 5", "Fonte 6", "Fonte 7"}, current = 2}
  respostas = {5, 1}
end

preparaFonte()
local okFonte = pcall(trocar_fonte_textos)
igual(okFonte, true, "fonte: roda até o fim")
igual(#dialogos >= 1, true, "fonte: abre o diálogo")
if #dialogos >= 1 then
  local primeira = dialogos[1]
  igual(#primeira.opcoes, 6, "fonte: primeira página tem 4 fontes + Mais… + Cancelar")
  igual(primeira.opcoes[5], "Mais…", "fonte: quinto botão é Mais…")
  igual(primeira.opcoes[6], "Cancelar", "fonte: Cancelar fecha a primeira página")
  for i = 1, 4 do
    igual(comprimento(primeira.opcoes[i]) <= 12, true, "fonte: rótulo " .. i .. " é curto")
  end
  igual(primeira.erro, false, "fonte: diálogo sem o título de erro do Xournal++")
  contem(primeira.mensagem, "1 texto selecionado", "fonte: diz que age na seleção")
  contem(primeira.mensagem, "Fonte atual: Velha", "fonte: fonte atual é a dos textos alvo")
  naoContem(primeira.mensagem, "DejaVu Sans", "fonte: não usa a fonte da ferramenta")
  contem(primeira.mensagem, "Lista de fontes: página 1 de 3", "fonte: diz a página da lista de fontes (#159, achado 3)")
  naoContem(primeira.mensagem, "Fontes: página", "fonte: não confunde a lista com a página do caderno")
end
igual(#dialogos >= 2, true, "fonte: Mais… mostra a próxima página")
if #dialogos >= 2 then
  local segunda = dialogos[2]
  igual(#segunda.opcoes, 6, "fonte: segunda página tem 3 fontes + Mais… + Voltar + Cancelar")
  igual(segunda.opcoes[5], "Voltar", "fonte: segunda página tem Voltar")
  igual(segunda.opcoes[6], "Cancelar", "fonte: segunda página termina em Cancelar")
  contem(segunda.mensagem, "Lista de fontes: página 2 de 3", "fonte: diz a página da lista na segunda página")
end
local iAddFonte = indice("addTexts")
local iSelecao = indice("addToSelection")
local iDelete = indiceAcao("delete")
igual(iAddFonte ~= nil, true, "fonte: insere os textos novos")
igual(iDelete ~= nil, true, "fonte: apaga os antigos depois")
if iAddFonte and iDelete then igual(iAddFonte < iDelete, true, "fonte: insere antes de apagar") end
if iAddFonte and iSelecao then igual(iAddFonte < iSelecao, true, "fonte: seleciona os antigos depois de inserir") end
if iAddFonte then
  local novo = chamadas[iAddFonte].args[1].texts[1]
  igual(novo.font.name, "Fonte 4", "fonte: usa a fonte escolhida na segunda página")
  igual(novo.font.size, 24, "fonte: preserva o tamanho 24 do texto")
end
local iRefreshFonte = indice("refreshPage")
if iAddFonte and iRefreshFonte then
  igual(iRefreshFonte > iAddFonte, true, "fonte: refreshPage depois de addTexts")
else
  igual(iRefreshFonte ~= nil, true, "fonte: chama refreshPage")
end
local sucessoFonte = dialogos[3]
igual(sucessoFonte and sucessoFonte.mensagem, "Fonte trocada para Fonte 4 em 1 texto. Desfazer (Ctrl+Z ou ⌘Z).", "fonte: nomeia a fonte escolhida e o desfazer dos dois sistemas (#159, achados 4 e 6)")
igual(sucessoFonte and sucessoFonte.erro, false, "fonte: o aviso de sucesso é neutro")

-- Sucesso com dois textos nomeia a fonte escolhida (#159, achado 4) ----------

preparaFonte()
estado.textosSelecao = {
  {text = "a", font = {name = "Velha", size = 24}, color = 0, x = 1, y = 2, ref = "ref-a"},
  {text = "b", font = {name = "Velha", size = 24}, color = 0, x = 1, y = 2, ref = "ref-b"},
}
respostas = {1}
local okNomeFonte = pcall(trocar_fonte_textos)
igual(okNomeFonte, true, "sucesso com dois textos: roda até o fim")
local sucessoDois = dialogos[#dialogos]
igual(sucessoDois and sucessoDois.mensagem, "Fonte trocada para Sans em 2 textos. Desfazer (Ctrl+Z ou ⌘Z).", "sucesso: nomeia a fonte e conta os dois textos")

-- Fontes mistas: lista as fontes dos textos alvo (#159, achado 4) -------------

reset()
estado.textosSelecao = {
  {text = "a", font = {name = "Sans", size = 24}, color = 0, x = 1, y = 2, ref = "ref-a"},
  {text = "b", font = {name = "Sans", size = 24}, color = 0, x = 1, y = 2, ref = "ref-b"},
  {text = "c", font = {name = "C059", size = 24}, color = 0, x = 1, y = 2, ref = "ref-c"},
}
estado.fontes = {families = {"Noto Sans"}, current = 1}
respostas = {}
local okMistas = pcall(trocar_fonte_textos)
igual(okMistas, true, "fontes mistas: roda até o fim")
if #dialogos >= 1 then
  contem(dialogos[1].mensagem, "Fontes atuais: Sans, C059.", "fontes mistas: lista as fontes sem repetir")
  naoContem(dialogos[1].mensagem, "Fonte atual:", "fontes mistas: não usa o singular")
end

reset()
estado.textosSelecao = {
  {text = "a", font = {name = "Sans", size = 24}, color = 0, x = 1, y = 2, ref = "ref-a"},
  {text = "b", font = {name = "C059", size = 24}, color = 0, x = 1, y = 2, ref = "ref-b"},
  {text = "c", font = {name = "Cantarell", size = 24}, color = 0, x = 1, y = 2, ref = "ref-c"},
  {text = "d", font = {name = "D050000L", size = 24}, color = 0, x = 1, y = 2, ref = "ref-d"},
}
estado.fontes = {families = {"Noto Sans"}, current = 1}
respostas = {}
local okMuitas = pcall(trocar_fonte_textos)
igual(okMuitas, true, "quatro fontes: roda até o fim")
if #dialogos >= 1 then
  contem(dialogos[1].mensagem, "Fontes atuais: Sans, C059, Cantarell e mais 1.", "quatro fontes: mostra até 3 nomes e conta o resto")
end

-- Voltar: a segunda página volta sem fechar e reabrir o diálogo (#159, achado 9)
preparaFonte()
respostas = {5, 5, 1}
local okVoltar = pcall(trocar_fonte_textos)
igual(okVoltar, true, "voltar: roda até o fim")
igual(#dialogos, 4, "voltar: primeira página, segunda, volta e sucesso")
if #dialogos >= 3 then
  local voltou = dialogos[3]
  contem(voltou.mensagem, "Lista de fontes: página 1 de 3", "voltar: a mensagem diz que voltou para a página 1")
  igual(voltou.opcoes[5], "Mais…", "voltar: a página 1 volta com Mais…")
  igual(voltou.opcoes[6], "Cancelar", "voltar: a página 1 termina em Cancelar")
end

-- addTexts falhando: nada é apagado e o aluno vê a mensagem ------------------

preparaFonte()
estado.falhaAdd = true
respostas = {1}
local okFalha = pcall(trocar_fonte_textos)
igual(okFalha, true, "fonte com addTexts falhando: o plugin trata o erro")
igual(indiceAcao("delete"), nil, "fonte com addTexts falhando: não apaga os antigos")
local ultimoDialogo = dialogos[#dialogos]
contem(ultimoDialogo and ultimoDialogo.mensagem or "", "Não consegui criar os textos", "fonte com addTexts falhando: avisa o aluno")
igual(ultimoDialogo and ultimoDialogo.erro, false, "fonte com addTexts falhando: diálogo sem o título de erro do Xournal++")

-- Página inteira sem seleção: preserva o tamanho e volta para a camada ------

reset()
estado.textosCamada = {{}, {{text = "pagina", font = {name = "Velha", size = 20}, color = 0, x = 5, y = 6, ref = "ref-p"}}, {}}
estado.fontes = {families = {"Noto Sans"}, current = 1}
respostas = {1}
local okPagina = pcall(trocar_fonte_textos)
igual(okPagina, true, "página: roda até o fim")
if #dialogos >= 1 then
  contem(dialogos[1].mensagem, "Todos os textos da página", "página: diz que age na página inteira")
  igual(dialogos[1].mensagem, "Todos os textos da página (1 texto). Fonte atual: Velha. Escolha a nova fonte:", "página: conta um texto no singular (#159, rodada 4, achado 2)")
  contem(dialogos[1].mensagem, "Fonte atual: Velha", "página: fonte atual vem do texto alvo")
end
local iAddPagina = indice("addTexts")
igual(iAddPagina ~= nil, true, "página: recria o texto da camada")
if iAddPagina then
  igual(chamadas[iAddPagina].args[1].texts[1].font.size, 20, "página: preserva o tamanho 20")
end
igual(estado.camadaAtual, 1, "página: volta para a camada original")

-- Página inteira conta os textos no alvo (#159, rodada 4, achado 2) ----------

reset()
estado.textosCamada = {{}, {{text = "a", font = {name = "Velha", size = 20}, color = 0, x = 1, y = 2, ref = "ref-a"},
                            {text = "b", font = {name = "Velha", size = 20}, color = 0, x = 3, y = 4, ref = "ref-b"}}, {}}
estado.fontes = {families = {"Noto Sans"}, current = 1}
respostas = {}
local okContagem = pcall(trocar_fonte_textos)
igual(okContagem, true, "página com dois textos: roda até o fim")
if #dialogos >= 1 then
  igual(dialogos[1].mensagem, "Todos os textos da página (2 textos). Fonte atual: Velha. Escolha a nova fonte:", "página: conta os dois textos no plural")
end

-- Fonte atual não recria os textos (#159, rodada 4, achado 3) -----------------

reset()
estado.textosSelecao = {{text = "a", font = {name = "Sans", size = 24}, color = 0, x = 1, y = 2, ref = "ref-a"}}
estado.fontes = {families = {"Noto Sans"}, current = 1}
respostas = {1}
local okFonteAtual = pcall(trocar_fonte_textos)
igual(okFonteAtual, true, "fonte atual: roda até o fim")
igual(dialogos[1].opcoes[1], "Sans (atual)", "fonte atual: o botão diz que a fonte já está aplicada")
igual(indice("addTexts"), nil, "fonte atual: escolher a fonte atual não recria os textos")
igual(indiceAcao("delete"), nil, "fonte atual: escolher a fonte atual não apaga os textos")
local avisoFonteAtual = dialogos[#dialogos]
igual(avisoFonteAtual and avisoFonteAtual.mensagem, "Os textos já estão em Sans.", "fonte atual: avisa que os textos já estão em Sans")
igual(avisoFonteAtual and avisoFonteAtual.erro, false, "fonte atual: aviso sem o título de erro do Xournal++")

reset()
estado.textosSelecao = {{text = "a", font = {name = "C059", size = 24}, color = 0, x = 1, y = 2, ref = "ref-a"}}
estado.fontes = {families = {"Noto Sans", "C059"}, current = 1}
respostas = {3}
local okFonteAtualMeio = pcall(trocar_fonte_textos)
igual(okFonteAtualMeio, true, "fonte atual fora do primeiro botão: roda até o fim")
igual(dialogos[1].opcoes[3], "C059 (atual)", "fonte atual: marca a fonte mesmo fora do primeiro botão")
igual(indice("addTexts"), nil, "fonte atual fora do primeiro botão: não recria os textos")
local avisoC059 = dialogos[#dialogos]
igual(avisoC059 and avisoC059.mensagem, "Os textos já estão em C059.", "fonte atual: o aviso nomeia a fonte atual")

reset()
estado.textosSelecao = {
  {text = "a", font = {name = "Sans", size = 24}, color = 0, x = 1, y = 2, ref = "ref-a"},
  {text = "b", font = {name = "C059", size = 24}, color = 0, x = 1, y = 2, ref = "ref-b"},
}
estado.fontes = {families = {"Noto Sans"}, current = 1}
respostas = {1}
local okMistasHoje = pcall(trocar_fonte_textos)
igual(okMistasHoje, true, "fontes mistas: roda até o fim")
igual(dialogos[1].opcoes[1], "Sans", "fontes mistas: nenhum botão ganha a marca de atual")
igual(indice("addTexts") ~= nil, true, "fontes mistas: escolher Sans recria os textos como hoje")

-- Sem textos: validação com diálogo neutro (#159, achado 16) ------------------

reset()
respostas = {}
local okSemTexto = pcall(trocar_fonte_textos)
igual(okSemTexto, true, "sem texto: roda até o fim")
igual(#dialogos, 1, "sem texto: avisa uma vez")
if #dialogos == 1 then
  igual(dialogos[1].mensagem, "Não há textos para trocar a fonte. Selecione textos ou abra uma página com textos.", "sem texto: mensagem clara")
  igual(dialogos[1].erro, false, "sem texto: diálogo sem o título de erro do Xournal++")
end

-- Erro de ambiente na conversão: diálogo neutro (#159, achado 16) -------------

preparaConversao()
estado.popenSaida = "\n000"
local okConexao = pcall(converter_tinta)
igual(okConexao, true, "erro de conexão: converter_tinta não explode")
local ultimoConexao = dialogos[#dialogos]
igual(ultimoConexao and ultimoConexao.mensagem, "Não deu para falar com a Mesa. Se ela estiver fechada, abra-a; se já estiver aberta, reabra-a e tente de novo.", "erro de conexão: separa conexão de timeout e cobre a Mesa já aberta")
naoContem(ultimoConexao and ultimoConexao.mensagem or "", "demorou demais", "erro de conexão: não mistura com a mensagem de timeout")
igual(ultimoConexao and ultimoConexao.erro, false, "erro de conexão: diálogo sem o título de erro do Xournal++")

-- Resposta inválida: erro impessoal e específico (#159, achado 4) ------------

preparaConversao()
estado.popenSaida = '{}\n200'
local okInvalida = pcall(converter_tinta)
igual(okInvalida, true, "resposta inválida: converter_tinta não explode")
local ultimoInvalida = dialogos[#dialogos]
igual(ultimoInvalida and ultimoInvalida.mensagem, "A resposta da Mesa veio em um formato inesperado. Tente de novo.", "resposta inválida: texto impessoal e específico (#159, achado 4 da rodada 5)")
igual(ultimoInvalida and ultimoInvalida.erro, false, "resposta inválida: diálogo sem o título de erro do Xournal++")

-- Resposta vazia: diz o próximo passo (#159, rodada 7, achado 6) --------------

preparaConversao()
estado.popenSaida = '{"text":""}\n200'
local okVazia = pcall(converter_tinta)
igual(okVazia, true, "resposta vazia: converter_tinta não explode")
local ultimoVazia = dialogos[#dialogos]
igual(ultimoVazia and ultimoVazia.mensagem, "A Mesa não leu nenhum texto da tinta. Tente de novo com uma seleção mais nítida.", "resposta vazia: texto exato com o próximo passo (#159, rodada 7, achado 6)")
igual(ultimoVazia and ultimoVazia.erro, false, "resposta vazia: diálogo sem o título de erro do Xournal++")

-- Temporários: io.open do header/corpo falhando não deixa lixo ---------------

preparaConversao()
estado.falharOpen = "header"
local okHeader = pcall(converter_tinta)
igual(okHeader, true, "header sem io.open: trata o erro")
igual(#tmpnames, 1, "header sem io.open: só um temporário foi pedido")
for _, nome in ipairs(tmpnames) do
  igual(existe(nome), false, "header sem io.open: temporário apagado")
end
igual(indice("io.popen") ~= nil, false, "header sem io.open: não chama a ponte")
local ultimoHeader = dialogos[#dialogos]
contem(ultimoHeader and ultimoHeader.mensagem or "", "Não consegui preparar a conversão", "header sem io.open: avisa o aluno")
igual(ultimoHeader and ultimoHeader.erro, false, "header sem io.open: diálogo sem o título de erro do Xournal++")

preparaConversao()
estado.falharOpen = "body"
local okCorpo = pcall(converter_tinta)
igual(okCorpo, true, "corpo sem io.open: trata o erro")
igual(#tmpnames, 2, "corpo sem io.open: dois temporários foram pedidos")
for _, nome in ipairs(tmpnames) do
  igual(existe(nome), false, "corpo sem io.open: temporário apagado")
end
igual(indice("io.popen") ~= nil, false, "corpo sem io.open: não chama a ponte")
local ultimoCorpo = dialogos[#dialogos]
igual(ultimoCorpo and ultimoCorpo.erro, false, "corpo sem io.open: diálogo sem o título de erro do Xournal++")

-- Comando impossível: diálogo neutro com o motivo (#159, achado 6) ------------

local PonteModulo = require("ponte")
local buildCurlOriginal = PonteModulo.buildCurlCommand
preparaConversao()
PonteModulo.buildCurlCommand = function() return nil, "porta de teste" end
local okComando = pcall(converter_tinta)
PonteModulo.buildCurlCommand = buildCurlOriginal
igual(okComando, true, "comando impossível: trata o erro")
igual(indice("io.popen") ~= nil, false, "comando impossível: não chama curl")
local ultimoComando = dialogos[#dialogos]
contem(ultimoComando and ultimoComando.mensagem or "", "Não consegui preparar a conversão (porta de teste).", "comando impossível: a mensagem diz o motivo")
igual(ultimoComando and ultimoComando.erro, false, "comando impossível: diálogo sem o título de erro do Xournal++")

-- Seleção grande: recusa antes do aviso de congelamento (#159) ----------------

reset()
estado.runtime = dirRuntime
estado.tracos = {}
for i = 1, 2001 do estado.tracos[i] = {x = {0, 1}, y = {0, 1}, width = 1, color = 0} end
respostas = {}
local okGrande = pcall(converter_tinta)
igual(okGrande, true, "seleção grande: converter_tinta não explode")
igual(#dialogos, 1, "seleção grande: um só diálogo, sem a confirmação")
if #dialogos == 1 then
  igual(dialogos[1].mensagem, "Seleção grande demais para converter de uma vez. Selecione um trecho menor.", "seleção grande: mensagem exata")
  igual(comprimento(dialogos[1].mensagem) <= 80, true, "seleção grande: mensagem cabe em 80 caracteres")
  igual(dialogos[1].cb, "", "seleção grande: não abre o aviso de congelamento")
  igual(dialogos[1].erro, false, "seleção grande: diálogo sem o título de erro do Xournal++")
end
igual(indice("io.popen") ~= nil, false, "seleção grande: não chama a ponte")
igual(indice("os.execute") ~= nil, false, "seleção grande: não cria temporário")

reset()
estado.runtime = dirRuntime
estado.tracos = {}
for i = 1, 1999 do estado.tracos[i] = {x = {0, 1}, y = {0, 1}, width = 1, color = 0} end
respostas = {}
local okLimite = pcall(converter_tinta)
igual(okLimite, true, "1999 traços: converter_tinta não explode")
igual(#dialogos, 1, "1999 traços: segue para o aviso de congelamento")
if #dialogos == 1 then
  contem(dialogos[1].mensagem, "vai parar de responder", "1999 traços: mostra o aviso de congelamento")
  igual(dialogos[1].cb, "converter_confirmado", "1999 traços: espera a confirmação")
end

end

for _, nome in ipairs(todosTmpnames) do
  pcall(reais.remove, nome)
end
reais.execute("rm -rf '" .. dirRuntime .. "'")

if falhas > 0 then
  print(string.format("%d falha(s)", falhas))
  os.exit(1)
end
print("tudo passou")
