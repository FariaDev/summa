-- MesaPagina (#133): cresce a página atual em 2 cm à direita ou abaixo.
-- Sem auto-crescimento: a API Lua do 1.3.8 não tem hook de traço, então o
-- crescimento é manual, um item de menu/atalho de cada vez (ver README.md).
-- O .xopp salvo continua abrindo no Xournal++ oficial: é só tamanho de página.
-- Com fundo de PDF, o PDF fica ancorado no canto de cima à esquerda
-- (desenho no origem da página) e o espaço ganho fica à direita/abaixo.
--
-- Converter tinta em texto e trocar fonte dos textos (#159): chamada
-- síncrona à ponte da Mesa (`io.popen` com `curl`, teto de 20 s) — congela o
-- Xournal++ durante a leitura, por isso um aviso antes. No Windows a
-- conversão ainda não funciona (`io.popen` passa pelo `cmd.exe` e não aceita
-- aspas simples nem `chmod`): o plugin avisa e sai. A tinta original é
-- mantida: o texto entra numa camada nova acima ("Texto convertido") para o
-- aluno comparar e apagar o que quiser. A pasta do runtime da Mesa vem do
-- `mesa-runtime.json` gravado na instalação (nunca caminho fixo); sem ele,
-- vale o `LEARNING_DESK_RUNTIME` do ambiente (dev/testes). Não chamar a API
-- do app no `initUi`: derruba o Xournal++ (SIGSEGV) — só registrar menus.

local Tamanho = require("tamanho")
local Converter = require("converter")
local Ponte = require("ponte")

local function crescer(direcao)
  local doc = app.getDocumentStructure()
  local pagina = doc.pages[doc.currentPage]
  local novaLargura, novaAltura = Tamanho.novaDimensao(pagina.pageWidth, pagina.pageHeight, direcao)
  app.setPageSize(novaLargura, novaAltura)
  -- A vista acompanha o espaço ganho (#159, capturas 14–16): sem isto, o
  -- espaço novo fica fora da área visível e a página parece não ter crescido.
  local passo = Tamanho.PASSO_CM * Tamanho.CM_EM_PT
  if direcao == "direita" then
    app.scrollToPos(passo, 0)
  else
    app.scrollToPos(0, passo)
  end
end

function pagina_para_direita()
  crescer("direita")
end

function pagina_para_baixo()
  crescer("abaixo")
end

-- Une pasta e nome de arquivo com a separação do sistema (a pasta do runtime
-- pode vir com barra no fim).
local function junta(pasta, nome)
  if pasta:sub(-1) == "/" or pasta:sub(-1) == "\\" then return pasta .. nome end
  return pasta .. "/" .. nome
end

local function leArquivo(caminho)
  local f = io.open(caminho, "r")
  if not f then return nil end
  local conteudo = f:read("*a")
  f:close()
  return conteudo
end

-- A pasta onde o plugin mora: a fonte do `initUi`/`main.lua` é a pasta dele.
local function diretorioPlugin()
  local fonte = debug.getinfo(1, "S").source:gsub("^@", "")
  local pasta = fonte:match("^(.*[/\\])")
  return pasta or ""
end

-- Pasta do runtime da Mesa: o `mesa-runtime.json` da instalação vale; sem
-- ele, o `LEARNING_DESK_RUNTIME` do ambiente (dev/testes). Sem nenhum dos
-- dois: nil (ponte ausente).
local function pastaRuntimeDaMesa()
  local conteudo = leArquivo(junta(diretorioPlugin(), "mesa-runtime.json"))
  if conteudo then
    local runtime = Ponte.parseRuntimeFile(conteudo)
    if runtime then return runtime.runtime end
  end
  local env = os.getenv("LEARNING_DESK_RUNTIME")
  if type(env) == "string" and env ~= "" then return env end
  return nil
end

-- Nome e tamanho da ferramenta de texto (o texto convertido segue a fonte
-- que o aluno já usa); sem ela, os padrões da Mesa (Sans/12, preto).
local function fonteDaFerramenta()
  local nome = nil
  local tamanho = nil
  local okFonte, fonte = pcall(app.getFont)
  if okFonte and type(fonte) == "table" then
    nome, tamanho = fonte.name, fonte.size
  end
  local okInfo, info = pcall(app.getToolInfo, "text")
  if okInfo and type(info) == "table" then
    if type(info.font) == "table" then
      nome = nome or info.font.name
      tamanho = tamanho or info.font.size
    end
  end
  return {name = nome, size = tamanho}
end

-- Pendência do aviso de conversão: quem confirma volta aqui (o
-- `app.openDialog` é assíncrono por callback, sem retorno).
local pendenciaConversao = nil

-- Sem a ponte não há conversão: a causa é a Mesa fechada ou a leitura da
-- tinta desligada; o texto diz as duas e onde ligar, com os nomes da Mesa
-- (#159, achados 3 e 4). A ponte é conferida antes do aviso de congelamento.
local MENSAGEM_SEM_PONTE = 'A conversão precisa da Mesa aberta e da opção “Buscar também na escrita à mão” ligada em Cadernos. Abra a Mesa, ligue a leitura da tinta e tente de novo.'

local function lePonte()
  local pasta = pastaRuntimeDaMesa()
  local conteudo = pasta and leArquivo(junta(pasta, "ink-convert-bridge.json")) or nil
  return conteudo and Ponte.parseBridgeFile(conteudo) or nil
end

-- Resto do "Converter em texto" depois do "Continuar": manda o SVG pela ponte
-- já conferida e insere o texto na camada nova. Os temporários são apagados em
-- todo caminho de erro (#159, revisão).
local function executaConversao(svg, bbox, ponte)
  if not ponte then
    app.openDialog(MENSAGEM_SEM_PONTE, {"OK"}, "", false)
    return
  end
  -- O token mora em arquivo de header 0600 (nunca na linha de comando, que
  -- aparece no `ps`); o SVG, em arquivo temporário. Os dois são apagados
  -- sempre, sucesso ou falha.
  local arquivoHeader = os.tmpname()
  local fh = io.open(arquivoHeader, "w")
  if not fh then
    os.remove(arquivoHeader)
    app.openDialog("Não consegui preparar a conversão.", {"OK"}, "", false)
    return
  end
  fh:write("x-mesa-token: " .. ponte.token .. "\n")
  fh:close()
  os.execute("chmod 0600 '" .. arquivoHeader:gsub("'", "'\\''") .. "'")
  local arquivoCorpo = os.tmpname()
  local fb = io.open(arquivoCorpo, "w")
  if not fb then
    os.remove(arquivoHeader)
    os.remove(arquivoCorpo)
    app.openDialog("Não consegui preparar a conversão.", {"OK"}, "", false)
    return
  end
  fb:write(Ponte.buildBridgeRequest(svg))
  fb:close()
  local comando, motivo = Ponte.buildCurlCommand(ponte.port, arquivoHeader, arquivoCorpo)
  if not comando then
    os.remove(arquivoHeader)
    os.remove(arquivoCorpo)
    app.openDialog("Não consegui preparar a conversão (" .. tostring(motivo) .. ").", {"OK"}, "", false)
    return
  end
  local saida = nil
  local okPopen, cano = pcall(io.popen, comando)
  if okPopen and cano then
    saida = cano:read("*a")
    cano:close()
  end
  os.remove(arquivoHeader)
  os.remove(arquivoCorpo)
  local resposta_corpo, codigo = Ponte.parseCurlOutput(saida)
  if not resposta_corpo or codigo == 0 then
    app.openDialog("Não deu para falar com a Mesa. Se ela estiver fechada, abra-a; se já estiver aberta, reabra-a e tente de novo.", {"OK"}, "", false)
    return
  end
  local resposta = Ponte.parseResponse(resposta_corpo)
  if not resposta then
    app.openDialog("A resposta da Mesa veio em um formato inesperado. Tente de novo.", {"OK"}, "", false)
    return
  end
  if resposta.reason then
    app.openDialog(Ponte.reasonMessage(resposta.reason), {"OK"}, "", false)
    return
  end
  local caixa = Converter.textBoxFor(resposta.text, bbox, fonteDaFerramenta())
  if not caixa then
    app.openDialog("A Mesa não leu nenhum texto da tinta. Tente de novo com uma seleção mais nítida.", {"OK"}, "", false)
    return
  end
  -- A tinta fica: o texto entra numa camada nova acima para comparar e
  -- apagar o que quiser (Ctrl+Z desfaz). O refresh mostra o texto sem
  -- precisar de zoom (#159, revisão).
  app.activateAction("layer-new-above-current")
  app.setCurrentLayerName("Texto convertido")
  app.addTexts({texts = {caixa}, allowUndoRedoAction = "grouped"})
  app.refreshPage()
end

-- "Converter em texto" (#159): no Windows a conversão ainda não funciona;
-- no resto, lê a seleção, pede confirmação e continua em
-- `converter_confirmado`. A chamada síncrona congela o Xournal++ até 20 s;
-- por isso o aviso antes.
function converter_tinta()
  if not Ponte.conversaoDisponivel(package.config:sub(1, 1)) then
    app.openDialog("A conversão ainda não funciona no Windows; por enquanto, use a Mesa no Linux ou no macOS.", {"OK"}, "", false)
    return
  end
  local tracos = nil
  local okTracos, tracosOuErro = pcall(app.getStrokes, "selection")
  if okTracos then tracos = tracosOuErro end
  if type(tracos) ~= "table" or #tracos == 0 then
    app.openDialog("Selecione um trecho de tinta para converter em texto.", {"OK"}, "", false)
    return
  end
  local bbox = nil
  local okInfo, info = pcall(app.getToolInfo, "selection")
  if okInfo and type(info) == "table" and type(info.boundingBox) == "table" then
    bbox = info.boundingBox
  end
  local svg = bbox and Converter.strokesToSvg(tracos, bbox, 10) or nil
  if type(svg) ~= "string" then
    app.openDialog("Nenhum traço desenhável na seleção. Selecione a tinta a converter.", {"OK"}, "", false)
    return
  end
  -- Recusa o pedido acima dos tetos da ponte antes do aviso de congelamento
  -- (#159): o host recusaria o SVG só depois de o Xournal++ parar.
  if Converter.pedidoAcimaDoLimite(svg, Ponte.buildBridgeRequest(svg)) then
    app.openDialog("Seleção grande demais para converter de uma vez. Selecione um trecho menor.", {"OK"}, "", false)
    return
  end
  local ponte = lePonte()
  if not ponte then
    app.openDialog(MENSAGEM_SEM_PONTE, {"OK"}, "", false)
    return
  end
  pendenciaConversao = {svg = svg, bbox = bbox, ponte = ponte}
  app.openDialog("A Mesa vai ler a tinta agora. O Xournal++ vai parar de responder por até 20 segundos; não feche a janela. O texto entra numa camada nova (“Texto convertido”); a tinta original fica. Continuar?", {"Continuar", "Cancelar"}, "converter_confirmado", false)
end

function converter_confirmado(indice)
  local pend = pendenciaConversao
  pendenciaConversao = nil
  if not pend or indice ~= 1 then return end
  executaConversao(pend.svg, pend.bbox, pend.ponte)
end

local function camadaAtual()
  local doc = app.getDocumentStructure()
  if type(doc) == "table" and type(doc.pages) == "table" and type(doc.currentPage) == "number" then
    local pagina = doc.pages[doc.currentPage]
    if type(pagina) == "table" and type(pagina.currentLayer) == "number" then
      return pagina.currentLayer
    end
  end
  return 1
end

-- Textos da página inteira, agrupados por camada (o `getTexts("layer")` só
-- lê a camada corrente; cada camada guarda seus próprios textos).
local function gruposDaPagina()
  local grupos = {}
  local original = camadaAtual()
  local doc = app.getDocumentStructure()
  if type(doc) ~= "table" or type(doc.pages) ~= "table" then return grupos, original end
  local pagina = doc.pages[doc.currentPage]
  if type(pagina) ~= "table" or type(pagina.layers) ~= "table" then return grupos, original end
  for i = 1, #pagina.layers do
    app.setCurrentLayer(i, false)
    local textos = app.getTexts("layer")
    if type(textos) == "table" and #textos > 0 then
      grupos[#grupos + 1] = {layer = i, texts = textos}
    end
  end
  app.setCurrentLayer(original, false)
  return grupos, original
end

-- Pendência do diálogo de fonte: quem escolhe volta aqui (o `app.openDialog`
-- é assíncrono por callback, sem retorno).
local pendenciaFonte = nil

-- As fontes dos textos alvo, sem repetir, na ordem em que aparecem — não a da
-- ferramenta de texto (#159, achados 4 e 6). Sem fonte legível, a mensagem
-- omite a linha em vez de mentir.
local function fontesDosTextos(grupos)
  local vistas, fontes = {}, {}
  for i = 1, #grupos do
    local textos = grupos[i].texts
    for j = 1, #textos do
      local fonte = type(textos[j]) == "table" and textos[j].font or nil
      local nome = type(fonte) == "table" and fonte.name or nil
      if type(nome) == "string" and nome ~= "" and not vistas[nome] then
        vistas[nome] = true
        fontes[#fontes + 1] = nome
      end
    end
  end
  return fontes
end

-- Linha da fonte atual: singular com uma fonte; plural com até 3 nomes e
-- "e mais N" quando houver mais (#159, achado 4).
local function linhaFonteAtual(fontes)
  if #fontes == 0 then return nil end
  if #fontes == 1 then return "Fonte atual: " .. fontes[1] .. "." end
  local nomes = {}
  for i = 1, math.min(3, #fontes) do nomes[i] = fontes[i] end
  local lista = table.concat(nomes, ", ")
  if #fontes > 3 then lista = lista .. " e mais " .. (#fontes - 3) end
  return "Fontes atuais: " .. lista .. "."
end

-- Total de textos alvo, somando as camadas (o alvo de página conta quantos
-- textos serão trocados; #159, rodada 4, achado 2).
local function contaTextos(grupos)
  local total = 0
  for i = 1, #grupos do total = total + #grupos[i].texts end
  return total
end

-- Mensagem do diálogo de fonte: alvo (seleção ou página inteira), fonte atual
-- dos textos alvo e a posição na lista de fontes quando há mais de uma página
-- (#159, achados 3, 4, 5, 6 e 9).
local function mensagemFonte(pend)
  local partes = {}
  if pend.alvo == "selection" then
    local n = pend.quantidade
    partes[#partes + 1] = string.format("%d %s selecionado%s.", n, n == 1 and "texto" or "textos", n == 1 and "" or "s")
  else
    local n = pend.quantidade
    partes[#partes + 1] = string.format("Todos os textos da página (%d %s).", n, n == 1 and "texto" or "textos")
  end
  local linhaFonte = pend.fontesAtuais and linhaFonteAtual(pend.fontesAtuais) or nil
  if linhaFonte then partes[#partes + 1] = linhaFonte end
  if #pend.paginas > 1 then
    partes[#partes + 1] = string.format("Lista de fontes: página %d de %d.", pend.pagina, #pend.paginas)
  end
  partes[#partes + 1] = "Escolha a nova fonte:"
  return table.concat(partes, " ")
end

-- Cada grupo insere os textos novos e só então apaga os antigos, na mesma
-- camada, tudo agrupado por camada (a 1.3.8 não apaga elemento por
-- referência nem muda a fonte de um texto existente: apagar+recriar é o
-- contorno medido no protótipo). Se `addTexts` falhar, nada é apagado e o
-- aluno vê a mensagem (#159, revisão). Devolve quantos textos foram
-- recriados, ou nil quando falhou.
local function aplicaFonte(grupos, original, fonte)
  local total = 0
  for i = 1, #grupos do
    local grupo = grupos[i]
    app.setCurrentLayer(grupo.layer, false)
    local novos = Converter.retypeTexts(grupo.texts, fonte)
    if novos and #novos > 0 then
      local ok, _ = pcall(app.addTexts, {texts = novos, allowUndoRedoAction = "grouped"})
      if not ok then
        app.setCurrentLayer(original, false)
        app.openDialog("Não consegui criar os textos com a fonte nova. Os textos antigos ficaram como estavam.", {"OK"}, "", false)
        return nil
      end
      total = total + #novos
      app.refreshPage()
      local refs = {}
      for j = 1, #grupo.texts do
        local item = grupo.texts[j]
        local ref = type(item) == "table" and item.ref or nil
        if ref then refs[#refs + 1] = ref end
      end
      if #refs > 0 then
        app.clearSelection()
        app.addToSelection(refs)
        app.activateAction("delete")
      end
      app.refreshPage()
    end
  end
  app.setCurrentLayer(original, false)
  return total
end

-- Mostra uma página de fontes: até 4 famílias na primeira página e 3 nas
-- seguintes (que ganham "Voltar"), + "Mais…" (quando há mais) + "Cancelar".
-- São no máximo 6 botões, para o diálogo caber em 800 px (#159, rodada 7,
-- achados 3 e 4).
local function mostraPaginaFonte(pend)
  local pagina = pend.paginas[pend.pagina]
  local opcoes = {}
  for i = 1, #pagina do opcoes[i] = pagina[i].label end
  pend.botoes = {}
  if pend.pagina < #pend.paginas then
    opcoes[#opcoes + 1] = "Mais…"
    pend.botoes.mais = #opcoes
  end
  if pend.pagina > 1 then
    opcoes[#opcoes + 1] = "Voltar"
    pend.botoes.voltar = #opcoes
  end
  opcoes[#opcoes + 1] = "Cancelar"
  app.openDialog(mensagemFonte(pend), opcoes, "fonte_escolhida", false)
end

-- "Trocar fonte dos textos…" (#159): recusa a fonte do diálogo de botões
-- (a 1.3.8 não tem seletor de lista) e recria os textos da seleção (ou da
-- página, sem seleção) com a família nova, preservando o tamanho de cada um.
function trocar_fonte_textos()
  local selecao = {}
  local okSel, textosSel = pcall(app.getTexts, "selection")
  if okSel and type(textosSel) == "table" then selecao = textosSel end
  local alvo = Converter.pickTextsTarget(selecao)
  local grupos = nil
  local original = camadaAtual()
  if alvo == "selection" then
    grupos = {{layer = original, texts = selecao}}
  else
    grupos, original = gruposDaPagina()
    if #grupos == 0 then
      app.openDialog("Não há textos para trocar a fonte. Selecione textos ou abra uma página com textos.", {"OK"}, "", false)
      return
    end
  end
  local fontes = nil
  local okFontes, fontesOuErro = pcall(app.getFonts)
  if okFontes and type(fontesOuErro) == "table" then fontes = fontesOuErro end
  local fontesAtuais = fontesDosTextos(grupos)
  -- Só há "a fonte atual" quando os alvos compartilham uma; com fontes mistas
  -- o diálogo segue como hoje (#159, rodada 4, achado 3).
  local fonteAtual = #fontesAtuais == 1 and fontesAtuais[1] or nil
  pendenciaFonte = {
    grupos = grupos,
    original = original,
    fontes = fontes,
    paginas = Converter.fontPages(fontes, fonteAtual),
    pagina = 1,
    alvo = alvo,
    quantidade = contaTextos(grupos),
    fontesAtuais = fontesAtuais,
    fonteAtual = fonteAtual,
  }
  mostraPaginaFonte(pendenciaFonte)
end

function fonte_escolhida(indice)
  local pend = pendenciaFonte
  if not pend or type(indice) ~= "number" then return end
  local pagina = pend.paginas[pend.pagina]
  local escolha = pagina[indice]
  if escolha then
    pendenciaFonte = nil
    -- Escolher a fonte que os textos já usam não recria nada; o aviso diz por
    -- quê, neutro (#159, rodada 4, achado 3).
    if pend.fonteAtual and escolha.name == pend.fonteAtual then
      app.openDialog(string.format("Os textos já estão em %s.", escolha.name), {"OK"}, "", false)
      return
    end
    local trocados = aplicaFonte(pend.grupos, pend.original, {name = escolha.name})
    if trocados then
      local substantivo = trocados == 1 and "texto" or "textos"
      -- A 1.3.8 não expõe o SO ao Lua (`package.config` só separa Windows de
      -- Unix) e o plugin roda em Linux e macOS: o aviso mostra os dois
      -- atalhos em vez de apontar a tecla errada (#159, achado 6).
      app.openDialog(string.format("Fonte trocada para %s em %d %s. Desfazer (Ctrl+Z ou ⌘Z).", escolha.name, trocados, substantivo), {"OK"}, "", false)
    end
    return
  end
  if pend.botoes and indice == pend.botoes.mais then
    pend.pagina = pend.pagina + 1
    mostraPaginaFonte(pend)
    return
  end
  if pend.botoes and indice == pend.botoes.voltar then
    pend.pagina = pend.pagina - 1
    mostraPaginaFonte(pend)
    return
  end
  pendenciaFonte = nil
end

function initUi()
  app.registerUi({["menu"] = "Página atual +2 cm à direita", ["callback"] = "pagina_para_direita",
                   ["accelerator"] = "<Control><Alt>r"})
  app.registerUi({["menu"] = "Página atual +2 cm abaixo", ["callback"] = "pagina_para_baixo",
                   ["accelerator"] = "<Control><Alt>b"})
  app.registerUi({["menu"] = "Converter a seleção em texto…", ["callback"] = "converter_tinta",
                   ["accelerator"] = "<Control><Shift>k"})
  app.registerUi({["menu"] = "Trocar fonte dos textos…", ["callback"] = "trocar_fonte_textos",
                   ["accelerator"] = "<Control><Shift>j"})
end
