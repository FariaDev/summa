-- MesaPagina: lógica pura do converter em texto (#159).
-- Monta o SVG da tinta da seleção, a caixa de texto convertida e a troca de
-- fonte do caderno — sem chamar a API do Xournal++ (sem `app`, `io` nem `os`),
-- para poder ser testado fora do Xournal++ (ver ../tests/). O papo com a Mesa
-- (JSON, `curl`, runtime e motivos) mora em `ponte.lua`.

local Converter = {}

-- Tetos da ponte (#159), os MESMOS de `desk/ink-convert-svg.cjs`:
-- `MAX_SHAPES` (2000 elementos no SVG, contando o <rect> de fundo) e
-- `BODY_CAP` (300 KB no corpo JSON do pedido). Conferir aqui recusa a seleção
-- grande antes do aviso de congelamento do Xournal++, em vez de depois.
Converter.MAX_ELEMENTOS = 2000
Converter.MAX_BYTES = 300 * 1024

--- Diz se o pedido à ponte passa de um dos tetos do host (#159).
-- `svg` é o de `strokesToSvg`; `corpo` é o de `Ponte.buildBridgeRequest`.
-- Devolve `acima` e o número de elementos do SVG.
-- Exemplo: pedidoAcimaDoLimite('<svg><rect x="0"/><path d="M0 0"/></svg>', '{}') -> false, 2
function Converter.pedidoAcimaDoLimite(svg, corpo)
  if type(svg) ~= "string" or type(corpo) ~= "string" then return false, 0 end
  local _, paths = svg:gsub("<path ", "")
  local _, rects = svg:gsub("<rect ", "")
  local elementos = paths + rects
  return elementos > Converter.MAX_ELEMENTOS or #corpo > Converter.MAX_BYTES, elementos
end

--- Devolve o número limpo, ou nil quando não é número finito.
local function numero(valor)
  if type(valor) == "number" and valor == valor and valor ~= math.huge and valor ~= -math.huge then return valor end
  return nil
end

--- Número com no máximo 1 casa decimal (-0.0 vira 0.0).
-- Exemplo: fmt1(12.34) -> "12.3"
local function fmt1(valor)
  local s = string.format("%.1f", valor)
  if s == "-0.0" then s = "0.0" end
  return s
end

--- Cor inteira 0xRRGGBB em hex de 6 dígitos (fora do intervalo é mascarada;
--- 0 vira #000000; não-inteira/nan/inf vira #000000 sem erro).
-- Exemplo: hex6(0xFF0000) -> "#FF0000"
local function hex6(cor)
  if type(cor) ~= "number" then return "#000000" end
  local i = math.tointeger(cor)
  if i == nil then return "#000000" end
  local c = i % 0x1000000
  return string.format("#%02X%02X%02X",
    math.floor(c / 0x10000) % 0x100,
    math.floor(c / 0x100) % 0x100,
    c % 0x100)
end

--- Cor inteira para `addTexts` (o C++ exige `lua_isinteger`): float integral
--- vira inteiro; o resto vira 0.
local function corInteira(valor)
  if type(valor) ~= "number" then return 0 end
  return math.tointeger(valor) or 0
end

--- Nome e tamanho da fonte com os padrões da Mesa ("Sans", 12).
local function fonteBase(fonte)
  if type(fonte) ~= "table" then fonte = {} end
  local nome = fonte.name
  if type(nome) ~= "string" or nome == "" then nome = "Sans" end
  local tamanho = numero(fonte.size)
  if tamanho == nil or tamanho <= 0 then tamanho = 12 end
  return nome, tamanho
end

-- <path> de um traço (`getStrokes`): pontos com coordenada inválida são
-- saltados; sem pontos válidos não há path. `pressure` e `tool` são
-- ignorados (a tinta é o que interessa no SVG).
local function textoPath(traco)
  local xs, ys = traco.x, traco.y
  if type(xs) ~= "table" or type(ys) ~= "table" then return nil end
  local partes = {}
  local primeiro = true
  for i = 1, math.min(#xs, #ys) do
    local x, y = numero(xs[i]), numero(ys[i])
    if x ~= nil and y ~= nil then
      partes[#partes + 1] = string.format("%s%s %s", primeiro and "M" or "L", fmt1(x), fmt1(y))
      primeiro = false
    end
  end
  if primeiro then return nil end
  local largura = numero(traco.width)
  if largura == nil or largura <= 0 then largura = 1 end
  local cor = traco.color
  if type(cor) ~= "number" then cor = 0 end
  return string.format('<path d="%s" fill="none" stroke="%s" stroke-width="%s" stroke-linecap="round" stroke-linejoin="round"/>',
    table.concat(partes, " "), hex6(cor), fmt1(largura))
end

--- Monta o SVG da tinta de uma seleção (#159): fundo branco, viewBox = bbox
--- + pad de cada lado, um <path> por traço (M/L, pontas arredondadas).
--- Nada vindo dos dados entra como texto livre no SVG (só números e hex).
--- Sem declaração `<?xml ...?>`: a ponte recusa `<?` e o elemento `<svg>` é
--- o primeiro byte (#159, revisão). Lista vazia ou sem traço desenhável:
--- nil + motivo.
-- Exemplo: strokesToSvg({{x={0,10},y={0,0},width=2,color=0}}, {x=0,y=0,width=10,height=10}, 0)
function Converter.strokesToSvg(tracos, bbox, pad)
  if type(tracos) ~= "table" then
    return nil, "strokesToSvg: traços deve ser lista (esperado tabela)"
  end
  if #tracos == 0 then
    return nil, "strokesToSvg: sem traços (lista vazia)"
  end
  if type(bbox) ~= "table" then
    return nil, "strokesToSvg: boundingBox deve ser tabela {x,y,width,height}"
  end
  local bx, by = numero(bbox.x), numero(bbox.y)
  local bw, bh = numero(bbox.width), numero(bbox.height)
  if bx == nil or by == nil or bw == nil or bh == nil or bw <= 0 or bh <= 0 then
    return nil, "strokesToSvg: boundingBox x/y/width/height devem ser números (width/height > 0)"
  end
  local p = tonumber(pad) or 0
  if p ~= p or p == math.huge or p == -math.huge then
    return nil, "strokesToSvg: pad deve ser número finito"
  end
  local vx, vy = bx - p, by - p
  local vw, vh = bw + 2 * p, bh + 2 * p
  if vw <= 0 or vh <= 0 then
    return nil, "strokesToSvg: viewBox resultante vazio (bbox + pad)"
  end
  local paths = {}
  for i = 1, #tracos do
    local traco = tracos[i]
    if type(traco) == "table" then
      local path = textoPath(traco)
      if path then paths[#paths + 1] = path end
    end
  end
  if #paths == 0 then
    return nil, "strokesToSvg: nenhum traço com pontos para desenhar"
  end
  return string.format('<svg xmlns="http://www.w3.org/2000/svg" viewBox="%s %s %s %s">', fmt1(vx), fmt1(vy), fmt1(vw), fmt1(vh))
    .. string.format('<rect x="%s" y="%s" width="%s" height="%s" fill="#FFFFFF"/>', fmt1(vx), fmt1(vy), fmt1(vw), fmt1(vh))
    .. table.concat(paths)
    .. '</svg>'
end

--- Tabela pronta para `app.addTexts` na posição da bbox: fonte com os
--- padrões quando não vem (Sans/12, cor preta), texto preservado. Texto
--- vazio ou só espaços: nil + motivo.
-- Exemplo: textBoxFor("oi", {x=10,y=20}, {name="Sans", size=11})
function Converter.textBoxFor(texto, bbox, fonte)
  if type(texto) ~= "string" or texto:match("^%s*$") then
    return nil, "textBoxFor: texto vazio (esperado texto não vazio)"
  end
  if type(bbox) ~= "table" then
    return nil, "textBoxFor: boundingBox deve ser tabela com x e y de número"
  end
  local x, y = numero(bbox.x), numero(bbox.y)
  if x == nil or y == nil then
    return nil, "textBoxFor: boundingBox x e y devem ser números"
  end
  local nome, tamanho = fonteBase(fonte)
  local cor = corInteira(type(fonte) == "table" and fonte.color or nil)
  return {text = texto, font = {name = nome, size = tamanho}, color = cor, x = x, y = y}
end

--- Lista para recriar os textos (`getTexts`) com a fonte nova, preservando
--- texto, cor e posição (a API 1.3 não muda fonte de texto existente: apaga
--- e recria). Item sem texto ou sem posição válida é ignorado; cada item
--- ganha a própria tabela de fonte. Quando a fonte pedida não traz tamanho
--- (só a família muda), o tamanho de cada texto é preservado; sem tamanho
--- nenhum, vale 12. Não tabela: nil + motivo.
-- Exemplo: retypeTexts({{text="a", color=0, x=1, y=2}}, {name="Sans", size=12})
function Converter.retypeTexts(textos, fonte)
  if type(textos) ~= "table" then
    return nil, "retypeTexts: textos deve ser lista de caixas (esperado tabela)"
  end
  local nome, padrao = fonteBase(fonte)
  local tamanhoPedido = nil
  if type(fonte) == "table" then
    local tamanho = numero(fonte.size)
    if tamanho ~= nil and tamanho > 0 then tamanhoPedido = tamanho end
  end
  local novos = {}
  for i = 1, #textos do
    local item = textos[i]
    if type(item) == "table" and type(item.text) == "string" and not item.text:match("^%s*$") then
      local x, y = numero(item.x), numero(item.y)
      if x ~= nil and y ~= nil then
        local tamanho = tamanhoPedido
        if tamanho == nil then
          local doItem = type(item.font) == "table" and numero(item.font.size) or nil
          if doItem ~= nil and doItem > 0 then tamanho = doItem else tamanho = padrao end
        end
        local cor = corInteira(item.color)
        novos[#novos + 1] = {text = item.text, font = {name = nome, size = tamanho}, color = cor, x = x, y = y}
      end
    end
  end
  return novos
end

--- Escolhe a fonte pedida quando ela está entre as disponíveis; senão "Sans".
--- Aceita lista de nomes, lista de tabelas com `name`, mapa nome -> verdade e
--- o formato da 1.3.8 de `app.getFonts()`: {families = {nomes...},
--- current = <índice>} (só `families` interessa; `current` é ignorado).
--- Comparação exata.
-- Exemplo: pickFont({"Sans", "Noto Sans"}, "Noto Sans") -> "Noto Sans"
function Converter.pickFont(disponiveis, pedida)
  if type(disponiveis) == "table" and type(pedida) == "string" then
    local lista = disponiveis
    if type(disponiveis.families) == "table" then lista = disponiveis.families end
    for i = 1, #lista do
      local entrada = lista[i]
      if entrada == pedida then
        return pedida
      end
      if type(entrada) == "table" and entrada.name == pedida then
        return pedida
      end
    end
    if disponiveis[pedida] then
      return pedida
    end
  end
  return "Sans"
end

--- Escolhe o alvo da troca de fonte (#159): com seleção não vazia vale a
--- seleção; senão, a página inteira (todas as camadas).
-- Exemplo: pickTextsTarget({{text = "a"}}) -> "selection"
function Converter.pickTextsTarget(selecao)
  if type(selecao) == "table" and #selecao > 0 then
    return "selection"
  end
  return "page"
end

--- Cada palavra inteira do nome, sem os espaços repetidos.
local function palavrasDoNome(nome)
  local palavras = {}
  for palavra in nome:gmatch("%S+") do palavras[#palavras + 1] = palavra end
  return palavras
end

--- Maior sufixo do nome formado por palavras inteiras que cabe em `espaco`
--- bytes; nil quando nem a última palavra cabe.
local function sufixoPorPalavras(nome, espaco)
  local palavras = palavrasDoNome(nome)
  local sufixo = nil
  for i = #palavras, 1, -1 do
    local tentativa = sufixo and (palavras[i] .. " " .. sufixo) or palavras[i]
    if #tentativa > espaco then break end
    sufixo = tentativa
  end
  return sufixo
end

--- Primeiro byte de um caractere UTF-8 a partir de `inicio` (não corta
--- caractere multibyte no meio).
local function inicioDoCaractere(nome, inicio)
  local i = inicio
  while i <= #nome do
    local b = nome:byte(i)
    if b == nil or b < 0x80 or b > 0xBF then break end
    i = i + 1
  end
  return i
end

--- Últimos `espaco` bytes do nome, ajustados para o começo de um caractere.
local function caudaBytes(nome, espaco)
  return nome:sub(inicioDoCaractere(nome, #nome - espaco + 1))
end

--- Primeiros `espaco` bytes do nome, ajustados para o fim de um caractere.
local function cabecaBytes(nome, espaco)
  local corte = espaco
  while corte > 0 do
    local b = nome:byte(corte + 1)
    if b == nil or b < 0x80 or b > 0xBF then break end
    corte = corte - 1
  end
  return nome:sub(1, corte)
end

--- Rótulo de um nome que não cabe: preserva o fim, que é o que distingue
--- famílias de mesmo começo ("DejaVu Sans" e "DejaVu Sans Mono" viram
--- "DejaVu Sans" e "…Sans Mono"). Prefere começar numa palavra inteira.
local function rotuloPeloFim(nome, limite)
  if #nome <= limite then return nome end
  local espaco = limite - 1
  local sufixo = sufixoPorPalavras(nome, espaco) or caudaBytes(nome, espaco)
  if sufixo == "" then return "…" end
  return "…" .. sufixo
end

--- Reserva de emergência do desempate: corta o fim, não o começo.
local function rotuloPeloComeco(nome, limite)
  if #nome <= limite then return nome end
  return cabecaBytes(nome, limite - 1) .. "…"
end

--- Rótulos de até `limite` caracteres, únicos na lista inteira (#159, rodada
--- 7, achados 3 e 4): nome inteiro quando cabe, senão o fim do nome; um
--- rótulo já usado tenta o começo e, em último caso, um número, para dois
--- botões nunca ficarem iguais.
local function rotulosDistintos(nomes, limite)
  local rotulos, usados = {}, {}
  for i = 1, #nomes do
    local rotulo = rotuloPeloFim(nomes[i], limite)
    if usados[rotulo] then
      local alternativa = rotuloPeloComeco(nomes[i], limite)
      if not usados[alternativa] then rotulo = alternativa end
    end
    local numero = 2
    while usados[rotulo] do
      local marca = " (" .. numero .. ")"
      rotulo = cabecaBytes(rotulo, limite - #marca) .. marca
      numero = numero + 1
    end
    usados[rotulo] = true
    rotulos[i] = rotulo
  end
  return rotulos
end

--- Páginas de fontes para o diálogo de botões do 1.3.8 (`app.openDialog`,
--- sem seletor de lista): "Sans" primeiro, depois as famílias de
--- `app.getFonts()`. A primeira página leva até 4 famílias; as seguintes
--- levam até 3, porque ganham "Voltar" (#159, rodada 7, achado 4): com 4
--- famílias + "Mais…" + "Voltar" + "Cancelar" o diálogo media 903 px, acima
--- dos 800 px da janela; com 3, ele fica nos mesmos 6 botões da primeira
--- página (666 px medidos). O chamador põe "Mais…" (quando há página
--- seguinte), "Voltar" (quando já avançou) e "Cancelar". Sem famílias ou sem
--- tabela: só "Sans". Sem amostra da fonte no rótulo (#159, achado 10): o
--- `openDialog` usa a fonte da interface em todos os botões, então uma
--- amostra não mostraria a família; o aluno vê o efeito ao aplicar. A fonte
--- `atual` (quando os alvos têm uma só) ganha " (atual)" no rótulo, para
--- escolhê-la não parecer uma troca (#159, rodada 4, achado 3).
-- Exemplo: fontPages({families = {"Noto Sans"}}, "Sans") -> {{{name="Sans", label="Sans (atual)"}, {name="Noto Sans", label="Noto Sans"}}}
function Converter.fontPages(fontes, atual)
  local lista = nil
  if type(fontes) == "table" then
    if type(fontes.families) == "table" then lista = fontes.families else lista = fontes end
  end
  local nomes = {"Sans"}
  if lista then
    for i = 1, #lista do
      local nome = lista[i]
      if type(nome) == "string" and nome ~= "" and nome ~= "Sans" then
        nomes[#nomes + 1] = nome
      end
    end
  end
  local rotulos = rotulosDistintos(nomes, 12)
  local paginas = {}
  local i = 1
  local tamanho = 4
  while i <= #nomes do
    local pagina = {}
    for _ = 1, tamanho do
      if i > #nomes then break end
      local nome = nomes[i]
      local rotulo = rotulos[i]
      if type(atual) == "string" and atual ~= "" and nome == atual then
        rotulo = rotulo .. " (atual)"
      end
      pagina[#pagina + 1] = {name = nome, label = rotulo}
      i = i + 1
    end
    paginas[#paginas + 1] = pagina
    tamanho = 3
  end
  return paginas
end

return Converter
