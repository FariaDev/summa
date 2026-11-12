-- Teste da lógica pura do converter em texto (#159).
-- Roda com qualquer Lua >= 5.3, sem o Xournal++:
--   lua desk/src/xournal-plugins/tests/mesa-converter.test.lua
-- (Assume-se que este arquivo é executado a partir da raiz do repo.)

local raiz = debug.getinfo(1, "S").source:gsub("^@", ""):match("^(.+)/tests/[^/]+$") or "."
-- `raiz` é a pasta `xournal-plugins/` quando rodado por caminho absoluto;
-- senão, usa o caminho relativo a partir da raiz do repo.
local function tenta(caminho)
  local ok = pcall(dofile, caminho)
  if ok then return caminho end
  return nil
end
local dirPlugin = tenta("desk/src/xournal-plugins/MesaPagina/converter.lua")
  and "desk/src/xournal-plugins/MesaPagina"
  or (raiz .. "/MesaPagina")

package.path = dirPlugin .. "/?.lua;" .. package.path
local okModulo, Converter = pcall(require, "converter")

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

local function contaOcorrencias(texto, trecho)
  local n = 0
  local de = 1
  while true do
    local i = texto:find(trecho, de, true)
    if i == nil then return n end
    n = n + 1
    de = i + 1
  end
end

local function comprimento(texto)
  return utf8.len(texto) or #texto
end

-- `f(...)` deve devolver nil + um motivo legível.
local function deveDarNil(nome, f, ...)
  local v, m = f(...)
  igual(v, nil, nome .. ": resultado")
  if type(m) ~= "string" or m == "" then
    falhas = falhas + 1
    print(string.format("FALHOU %s: motivo vazio ou ausente: %s", nome, tostring(m)))
  else
    print(string.format("passou %s: tem motivo", nome))
  end
end

if not okModulo then
  falhas = falhas + 1
  print("FALHOU carregar o módulo converter: " .. tostring(Converter))
else

-- strokesToSvg -----------------------------------------------------------------

local bbox = {x = 100, y = 200, width = 200, height = 100}
local doisTracos = {
  {x = {10, 20.5}, y = {10, 15.5}, width = 2, color = 0xFF0000, tool = "pen"},
  {x = {1, 2}, y = {3, 4}, width = 1.5, color = 0, tool = "brush"},
}
local svg = Converter.strokesToSvg(doisTracos, bbox, 10)
igual(type(svg), "string", "svg é texto")
contem(svg, 'viewBox="90.0 190.0 220.0 120.0"', "viewBox é bbox + pad de cada lado")
contem(svg, '<rect x="90.0" y="190.0" width="220.0" height="120.0" fill="#FFFFFF"/>', "fundo branco cobre o viewBox")
igual(contaOcorrencias(svg, "<path"), 2, "um <path> por traço")
contem(svg, '<path d="M10.0 10.0 L20.5 15.5" fill="none" stroke="#FF0000" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round"/>', "path com M/L, hex e largura")
contem(svg, 'stroke="#000000"', "cor 0 vira #000000")

-- o SVG vai direto para a ponte, que recusa declaração `<?...?>`: o elemento
-- `<svg>` tem de ser o primeiro byte (#159, revisão).
igual(svg:sub(1, 4), "<svg", "svg começa no elemento <svg>")
naoContem(svg, "<?xml", "svg não traz declaração XML")
naoContem(svg, "<?", "nenhuma instrução <?...?> no svg")

-- pad omitido: viewBox é a bbox como está
local svgSemPad = Converter.strokesToSvg(doisTracos, bbox)
contem(svgSemPad, 'viewBox="100.0 200.0 200.0 100.0"', "sem pad, viewBox é a bbox")

-- no máximo 1 casa decimal (arredonda)
local svgCasas = Converter.strokesToSvg({{x = {12.34, 12.36}, y = {1.24, 1.26}, width = 1, color = 0xABCDEF}}, bbox, 0)
contem(svgCasas, "M12.3 1.2 L12.4 1.3", "números com no máximo 1 casa decimal")
contem(svgCasas, 'stroke="#ABCDEF"', "cor em hex de 6 dígitos")

-- -0.04 arredonda para 0.0, não para -0.0
local svgZeroNegativo = Converter.strokesToSvg({{x = {-0.04}, y = {0}, width = 1, color = 0}}, bbox, 0)
contem(svgZeroNegativo, "M0.0 0.0", "-0.04 vira 0.0, não -0.0")
naoContem(svgZeroNegativo, "-0.0", "nenhum -0.0 no svg")

-- traço de um ponto só: M sem L
local svgUmPonto = Converter.strokesToSvg({{x = {5}, y = {5}, width = 1, color = 0}}, bbox, 0)
igual(contaOcorrencias(svgUmPonto, "<path"), 1, "traço de um ponto gera um path")
contem(svgUmPonto, 'd="M5.0 5.0"', "traço de um ponto é só o M (sem L)")
naoContem(svgUmPonto, 'd="M5.0 5.0 L', "sem L após o ponto único")

-- traço sem pontos é ignorado
local svgIgnorado = Converter.strokesToSvg({
  {x = {}, y = {}, width = 1, color = 0},
  {x = {7, 8}, y = {7, 8}, width = 1, color = 0},
}, bbox, 0)
igual(contaOcorrencias(svgIgnorado, "<path"), 1, "traço sem pontos é ignorado")

-- ponto inválido é saltado, sem matar o traço
local svgPontoRuim = Converter.strokesToSvg({{x = {1, "x", 3}, y = {1, 2, 3}, width = 1, color = 0}}, bbox, 0)
contem(svgPontoRuim, 'd="M1.0 1.0 L3.0 3.0"', "ponto com coordenada não numérica é saltado")

-- pressure[] e tool não entram no svg (a tinta é o que interessa)
local svgPressure = Converter.strokesToSvg({{x = {1, 2}, y = {1, 2}, pressure = {0.5, 0.7}, width = 2, color = 0, tool = '"><script>alert(1)</script>'}}, bbox, 0)
igual(contaOcorrencias(svgPressure, "<path"), 1, "pressure não impede o path")
naoContem(svgPressure, "pressure", "pressure não vaza para o svg")
naoContem(svgPressure, "<script>", "tool malicioso não vira texto livre no svg")
naoContem(svgPressure, "alert", "nada do tool entra no svg")

-- cor fora do intervalo é mascarada para 6 dígitos, sem vazar texto
local svgCorGrande = Converter.strokesToSvg({{x = {1}, y = {1}, width = 1, color = 0x1FF0000}}, bbox, 0)
contem(svgCorGrande, 'stroke="#FF0000"', "cor maior que 0xFFFFFF é mascarada")
local svgCorTexto = Converter.strokesToSvg({{x = {1}, y = {1}, width = 1, color = "red"}}, bbox, 0)
contem(svgCorTexto, 'stroke="#000000"', "cor não numérica vira #000000")
naoContem(svgCorTexto, "red", "cor texto não entra no svg")

-- lista vazia/all-empty/inválida: nil + motivo
deveDarNil("lista vazia", Converter.strokesToSvg, {}, bbox, 0)
deveDarNil("só traço sem pontos", Converter.strokesToSvg, {{x = {}, y = {}, width = 1, color = 0}}, bbox, 0)
deveDarNil("traços nil", Converter.strokesToSvg, nil, bbox, 0)
deveDarNil("bbox nil", Converter.strokesToSvg, doisTracos, nil, 0)
deveDarNil("bbox com width zero", Converter.strokesToSvg, doisTracos, {x = 1, y = 2, width = 0, height = 10}, 0)
deveDarNil("pad que esvazia o viewBox", Converter.strokesToSvg, doisTracos, {x = 1, y = 2, width = 10, height = 10}, -100)

-- textBoxFor -------------------------------------------------------------------

local caixa = Converter.textBoxFor("olá", {x = 10, y = 20, width = 5, height = 5}, {name = "Sans", size = 11, color = 0})
igual(caixa.text, "olá", "caixa guarda o texto")
igual(caixa.font.name, "Sans", "caixa guarda o nome da fonte")
igual(caixa.font.size, 11, "caixa guarda o tamanho")
igual(caixa.color, 0, "caixa guarda a cor")
igual(caixa.x, 10, "caixa na x da bbox")
igual(caixa.y, 20, "caixa na y da bbox")

local fontePassada = {name = "DejaVu Sans", size = 14}
local caixa2 = Converter.textBoxFor(" oi ", {x = 0, y = 0}, fontePassada)
igual(caixa2.text, " oi ", "texto com espaços ao redor é preservado")
igual(caixa2.color, 0, "sem color na fonte, cor é preto (0)")
if caixa2.font == fontePassada then
  falhas = falhas + 1
  print("FALHOU fonte da caixa é tabela própria")
else
  print("passou fonte da caixa é tabela própria")
end

local caixaPadrao = Converter.textBoxFor("x", {x = 1, y = 1}, nil)
igual(caixaPadrao.font.name, "Sans", "sem fonte, nome é Sans")
igual(caixaPadrao.font.size, 12, "sem fonte, tamanho é 12")
igual(caixaPadrao.color, 0, "sem fonte, cor é preto")

deveDarNil("texto vazio", Converter.textBoxFor, "", {x = 1, y = 1}, {})
deveDarNil("texto só com espaços", Converter.textBoxFor, "   ", {x = 1, y = 1}, {})
deveDarNil("texto nil", Converter.textBoxFor, nil, {x = 1, y = 1}, {})
deveDarNil("bbox nil", Converter.textBoxFor, "a", nil, {})
deveDarNil("bbox sem y", Converter.textBoxFor, "a", {x = 1}, {})

-- retypeTexts ------------------------------------------------------------------

local textos = {
  {text = "primeiro", font = {name = "Velha", size = 9}, color = 0, x = 1, y = 2},
  {text = "segundo", font = {name = "Velha", size = 9}, color = 255, x = 3, y = 4},
}
local novos = Converter.retypeTexts(textos, {name = "Noto Sans", size = 13})
igual(#novos, 2, "retype mantém a quantidade de textos")
igual(novos[1].text, "primeiro", "retype preserva o texto")
igual(novos[1].x, 1, "retype preserva a x")
igual(novos[1].y, 2, "retype preserva a y")
igual(novos[1].color, 0, "retype preserva a cor 0")
igual(novos[2].color, 255, "retype preserva a cor 255")
igual(novos[1].font.name, "Noto Sans", "retype troca o nome da fonte")
igual(novos[1].font.size, 13, "retype troca o tamanho quando a fonte pede")
if novos[1].font == novos[2].font then
  falhas = falhas + 1
  print("FALHOU cada item tem a própria tabela de fonte")
else
  print("passou cada item tem a própria tabela de fonte")
end

-- só a família muda: o tamanho de cada texto é preservado (#159, revisão)
local comTamanhos = {
  {text = "grande", font = {name = "Velha", size = 24}, color = 0, x = 1, y = 1},
  {text = "pequeno", font = {name = "Velha", size = 9}, color = 0, x = 2, y = 2},
}
local soFamilia = Converter.retypeTexts(comTamanhos, {name = "Noto Sans"})
igual(soFamilia[1].font.name, "Noto Sans", "só família: troca o nome")
igual(soFamilia[1].font.size, 24, "só família: preserva o tamanho 24")
igual(soFamilia[2].font.size, 9, "só família: preserva o tamanho 9")
local tamanhoPedido = Converter.retypeTexts(comTamanhos, {name = "Noto Sans", size = 15})
igual(tamanhoPedido[1].font.size, 15, "tamanho explícito na fonte vale para todos")
igual(tamanhoPedido[2].font.size, 15, "tamanho explícito vale para o segundo também")
local semTamanhoNenhum = Converter.retypeTexts({{text = "a", font = {name = "X"}, color = 0, x = 1, y = 1}}, nil)
igual(semTamanhoNenhum[1].font.size, 12, "sem tamanho no item nem na fonte, usa 12")

local comLixo = {
  {text = "vale", font = {}, color = 0, x = 0, y = 0},
  "lixo",
  {text = "", font = {}, color = 0, x = 0, y = 0},
  {text = 5, font = {}, color = 0, x = 0, y = 0},
  {text = "sem posição", font = {}, color = 0},
}
local filtrados = Converter.retypeTexts(comLixo, nil)
igual(#filtrados, 1, "retype ignora itens sem texto ou sem posição válida")
igual(filtrados[1].text, "vale", "o item válido sobrevive à filtragem")
igual(filtrados[1].font.name, "Sans", "fonte nil no retype vira Sans")
igual(filtrados[1].font.size, 12, "fonte nil no retype vira tamanho 12")

igual(#Converter.retypeTexts({}, nil), 0, "lista vazia recria nada")
deveDarNil("textos nil", Converter.retypeTexts, nil, nil)

-- pickFont ---------------------------------------------------------------------

igual(Converter.pickFont({"Sans", "Noto Sans"}, "Noto Sans"), "Noto Sans", "fonte pedida presente é escolhida")
igual(Converter.pickFont({"Sans", "Noto Sans"}, "Ausente"), "Sans", "fonte ausente cai para Sans")
igual(Converter.pickFont(nil, "Noto Sans"), "Sans", "sem lista cai para Sans")
igual(Converter.pickFont({"Sans"}, nil), "Sans", "pedido nil cai para Sans")
igual(Converter.pickFont({{name = "Sans"}, {name = "Noto Sans"}}, "Noto Sans"), "Noto Sans", "lista de tabelas com name também funciona")
igual(Converter.pickFont({"DejaVu Sans"}, "dejavu sans"), "Sans", "comparação é exata (sem ignorar caixa)")
igual(Converter.pickFont({["Noto Sans"] = true}, "Noto Sans"), "Noto Sans", "mapa de nomes também funciona")

-- números finitos: nan/inf não passam (bbox, pad, coordenada, largura, cor) --

deveDarNil("bbox x nan", Converter.strokesToSvg, doisTracos, {x = 0/0, y = 0, width = 10, height = 10}, 0)
deveDarNil("bbox y inf", Converter.strokesToSvg, doisTracos, {x = 0, y = math.huge, width = 10, height = 10}, 0)
deveDarNil("bbox width inf", Converter.strokesToSvg, doisTracos, {x = 0, y = 0, width = math.huge, height = 10}, 0)
deveDarNil("bbox height -inf", Converter.strokesToSvg, doisTracos, {x = 0, y = 0, width = 10, height = -math.huge}, 0)
deveDarNil("bbox width negativa", Converter.strokesToSvg, doisTracos, {x = 0, y = 0, width = -5, height = 10}, 0)
deveDarNil("pad nan", Converter.strokesToSvg, doisTracos, bbox, 0/0)
deveDarNil("pad inf", Converter.strokesToSvg, doisTracos, bbox, math.huge)
deveDarNil("pad -inf", Converter.strokesToSvg, doisTracos, bbox, -math.huge)

local svgCoordInfinita = Converter.strokesToSvg({{x = {1, math.huge, 3}, y = {1, 2, 3}, width = 1, color = 0}}, bbox, 0)
contem(svgCoordInfinita, 'd="M1.0 1.0 L3.0 3.0"', "coordenada infinita é saltada")
local svgCoordNan = Converter.strokesToSvg({{x = {1, 0/0, 3}, y = {1, 2, 3}, width = 1, color = 0}}, bbox, 0)
contem(svgCoordNan, 'd="M1.0 1.0 L3.0 3.0"', "coordenada nan é saltada")
local svgYInf = Converter.strokesToSvg({{x = {1, 2, 3}, y = {1, -math.huge, 3}, width = 1, color = 0}}, bbox, 0)
contem(svgYInf, 'd="M1.0 1.0 L3.0 3.0"', "y infinito é saltado")

-- x/y com tamanhos distintos: vale o menor
local svgTamanhos = Converter.strokesToSvg({{x = {1, 2, 3}, y = {4, 5}, width = 1, color = 0}}, bbox, 0)
contem(svgTamanhos, 'd="M1.0 4.0 L2.0 5.0"', "x/y com tamanhos distintos usa o menor")
naoContem(svgTamanhos, "3.0", "ponto além do menor tamanho não entra")
local svgTamanhos2 = Converter.strokesToSvg({{x = {1, 2}, y = {4, 5, 6}, width = 1, color = 0}}, bbox, 0)
contem(svgTamanhos2, 'd="M1.0 4.0 L2.0 5.0"', "y mais longo que x usa o menor")

-- item de traço não-tabela é ignorado
local svgItemRuim = Converter.strokesToSvg({"lixo", {x = {7}, y = {7}, width = 1, color = 0}}, bbox, 0)
igual(contaOcorrencias(svgItemRuim, "<path"), 1, "item de traço não-tabela é ignorado")
deveDarNil("só item não-tabela", Converter.strokesToSvg, {"lixo"}, bbox, 0)

-- largura não-finita vira 1
local svgLargInf = Converter.strokesToSvg({{x = {1}, y = {1}, width = math.huge, color = 0}}, bbox, 0)
contem(svgLargInf, 'stroke-width="1.0"', "largura infinita vira 1")
local svgLargNan = Converter.strokesToSvg({{x = {1}, y = {1}, width = 0/0, color = 0}}, bbox, 0)
contem(svgLargNan, 'stroke-width="1.0"', "largura nan vira 1")

-- cor não-inteira/nan/inf vira #000000 sem erro
local okCorFrac, svgCorFrac = pcall(Converter.strokesToSvg, {{x = {1}, y = {1}, width = 1, color = 123.5}}, bbox, 0)
igual(okCorFrac, true, "cor fracionária não lança erro")
if okCorFrac then contem(svgCorFrac, 'stroke="#000000"', "cor fracionária vira #000000") end
local okCorNan, svgCorNan = pcall(Converter.strokesToSvg, {{x = {1}, y = {1}, width = 1, color = 0/0}}, bbox, 0)
igual(okCorNan, true, "cor nan não lança erro")
if okCorNan then contem(svgCorNan, 'stroke="#000000"', "cor nan vira #000000") end
local okCorInf, svgCorInf = pcall(Converter.strokesToSvg, {{x = {1}, y = {1}, width = 1, color = math.huge}}, bbox, 0)
igual(okCorInf, true, "cor inf não lança erro")
if okCorInf then contem(svgCorInf, 'stroke="#000000"', "cor inf vira #000000") end
local okCorMInf, svgCorMInf = pcall(Converter.strokesToSvg, {{x = {1}, y = {1}, width = 1, color = -math.huge}}, bbox, 0)
igual(okCorMInf, true, "cor -inf não lança erro")
if okCorMInf then contem(svgCorMInf, 'stroke="#000000"', "cor -inf vira #000000") end

-- textBoxFor com x/y não-finitos
deveDarNil("caixa x nan", Converter.textBoxFor, "a", {x = 0/0, y = 1}, {})
deveDarNil("caixa y inf", Converter.textBoxFor, "a", {x = 1, y = math.huge}, {})
deveDarNil("caixa x -inf", Converter.textBoxFor, "a", {x = -math.huge, y = 1}, {})

-- font.size não numérica cai para 12
local caixaSizeTexto = Converter.textBoxFor("x", {x = 1, y = 1}, {name = "Sans", size = "big"})
igual(caixaSizeTexto.font.size, 12, "font.size não numérica vira 12")
igual(caixaSizeTexto.font.name, "Sans", "font.size não numérica mantém o nome")
local caixaSizeNan = Converter.textBoxFor("x", {x = 1, y = 1}, {name = "Sans", size = 0/0})
igual(caixaSizeNan.font.size, 12, "font.size nan vira 12")
local caixaSizeInf = Converter.textBoxFor("x", {x = 1, y = 1}, {name = "Sans", size = math.huge})
igual(caixaSizeInf.font.size, 12, "font.size inf vira 12")

-- color precisa ser inteiro de verdade (lua_isinteger no C++)
local caixaCorFloat = Converter.textBoxFor("x", {x = 1, y = 1}, {name = "Sans", size = 12, color = 255.0})
igual(caixaCorFloat.color, 255, "cor float integral vira 255")
igual(math.type(caixaCorFloat.color), "integer", "cor float integral vira inteiro Lua")
local caixaCorFrac = Converter.textBoxFor("x", {x = 1, y = 1}, {name = "Sans", size = 12, color = 255.5})
igual(caixaCorFrac.color, 0, "cor não-integral vira 0")
igual(math.type(caixaCorFrac.color), "integer", "cor não-integral vira inteiro 0")
local caixaCorNan = Converter.textBoxFor("x", {x = 1, y = 1}, {name = "Sans", size = 12, color = 0/0})
igual(caixaCorNan.color, 0, "cor nan vira 0")
local caixaCorInf = Converter.textBoxFor("x", {x = 1, y = 1}, {name = "Sans", size = 12, color = math.huge})
igual(caixaCorInf.color, 0, "cor inf vira 0")

-- retypeTexts ignora texto só com espaços e item não-finito
igual(#Converter.retypeTexts({{text = "   ", color = 0, x = 1, y = 1}}, nil), 0, "retype ignora texto só com espaços")
igual(#Converter.retypeTexts({{text = "\t\n", color = 0, x = 1, y = 1}}, nil), 0, "retype ignora texto só com branco")
igual(#Converter.retypeTexts({{text = "a", color = 0, x = math.huge, y = 1}}, nil), 0, "retype ignora item com x infinita")
igual(#Converter.retypeTexts({{text = "a", color = 0, x = 1, y = 0/0}}, nil), 0, "retype ignora item com y nan")

local retypeCorFloat = Converter.retypeTexts({{text = "a", color = 255.0, x = 1, y = 1}}, nil)
igual(retypeCorFloat[1].color, 255, "retype: cor float integral vira 255")
igual(math.type(retypeCorFloat[1].color), "integer", "retype: cor float integral vira inteiro Lua")
local retypeCorFrac = Converter.retypeTexts({{text = "a", color = 10.5, x = 1, y = 1}}, nil)
igual(retypeCorFrac[1].color, 0, "retype: cor não-integral vira 0")
igual(math.type(retypeCorFrac[1].color), "integer", "retype: cor não-integral vira inteiro 0")

-- pickFont no formato 1.3.8 {families=..., current=...}
igual(Converter.pickFont({families = {"Sans", "Noto Sans"}, current = 2}, "Noto Sans"), "Noto Sans", "1.3.8: encontra nome em families")
igual(Converter.pickFont({families = {"Sans", "Noto Sans"}, current = 1}, "Ausente"), "Sans", "1.3.8: nome ausente cai para Sans")
igual(Converter.pickFont({families = {"Sans"}}, "Sans"), "Sans", "1.3.8: families com um nome funciona")
igual(Converter.pickFont({}, ""), "Sans", "pickFont com lista vazia e pedido vazio cai para Sans")

-- pickTextsTarget ------------------------------------------------------------

igual(Converter.pickTextsTarget({{text = "a"}}), "selection", "com seleção, alvo é a seleção")
igual(Converter.pickTextsTarget({}), "page", "sem seleção, alvo é a página")
igual(Converter.pickTextsTarget(nil), "page", "seleção nil, alvo é a página")

-- fontPages ------------------------------------------------------------------

local seteFamilias = {families = {"Noto Sans", "DejaVu Sans", "Fonte 3", "Fonte 4", "Fonte 5", "Fonte 6", "Fonte 7"}, current = 2}
local paginas = Converter.fontPages(seteFamilias)
igual(#paginas, 3, "Sans + 7 famílias cabem em 3 páginas: 4 na primeira e 3 nas seguintes (#159, rodada 7, achado 4)")
igual(#paginas[1], 4, "primeira página tem 4 famílias (mais o 'Mais…' do chamador)")
igual(#paginas[2], 3, "segunda página tem 3 famílias (com 'Mais…', 'Voltar' e 'Cancelar': no máximo 6 botões)")
igual(paginas[3] and #paginas[3] or 0, 1, "terceira página fica com a família restante")
igual(paginas[1][1].name, "Sans", "Sans é o primeiro da primeira página")
igual(paginas[1][2].name, "Noto Sans", "família segue na ordem")
igual(paginas[2][1].name, "Fonte 4", "segunda página começa no quinto candidato (Fonte 4)")

-- Regra de largura (#159, rodada 7, achado 4): a primeira página leva 4
-- famílias; as seguintes levam 3, porque ganham "Voltar". Com "Mais…" e
-- "Cancelar", nenhuma página passa de 6 botões (666 px medidos na primeira).
local muitasFamilias = {}
for i = 1, 13 do muitasFamilias[i] = "Família " .. i end
local paginasMuitas = Converter.fontPages({families = muitasFamilias})
for p = 1, #paginasMuitas do
  local limite = p == 1 and 4 or 3
  igual(#paginasMuitas[p] <= limite, true, "página " .. p .. " respeita o limite de famílias")
  local botoes = #paginasMuitas[p] + (p < #paginasMuitas and 1 or 0) + (p > 1 and 1 or 0) + 1
  igual(botoes <= 6, true, "página " .. p .. " não passa de 6 botões (" .. botoes .. ")")
end

local semDuplicar = Converter.fontPages({families = {"Sans", "Noto Sans"}, current = 1})
igual(#semDuplicar, 1, "Sans + Noto Sans cabem em uma página")
igual(#semDuplicar[1], 2, "Sans da lista não duplica")
igual(semDuplicar[1][1].name, "Sans", "Sans segue primeiro")
igual(semDuplicar[1][2].name, "Noto Sans", "família após Sans")

local paginasVazias = Converter.fontPages({families = {}, current = nil})
igual(#paginasVazias, 1, "sem famílias, uma página")
igual(#paginasVazias[1], 1, "sem famílias, só Sans")
igual(paginasVazias[1][1].name, "Sans", "sem famílias, Sans")

local paginasNil = Converter.fontPages(nil)
igual(#paginasNil, 1, "fontes nil, uma página")
igual(#paginasNil[1], 1, "fontes nil, só Sans")

-- rótulos curtos: o diálogo de botões do 1.3.8 abria 1602 px numa tela de
-- 1280 com nomes longos (#159, revisão); cada rótulo cabe em 12 caracteres.
local nomeLongo = "Uma Fonte Com Nome Bem Comprido"
local paginasLongas = Converter.fontPages({families = {nomeLongo}})
local rotulo = paginasLongas[1][2].label
igual(comprimento(rotulo) <= 12, true, "rótulo de fonte longa cabe em 12 caracteres")
igual(rotulo:sub(1, 3), "…", "rótulo cortado preserva o fim do nome e marca o corte no começo")
igual(rotulo, "…Comprido", "rótulo cortado começa na última palavra inteira que cabe")
local rotuloCurto = paginasVazias[1][1].label
igual(rotuloCurto, "Sans", "rótulo de nome curto fica inteiro")

-- Lista real da segunda página (#159, rodada 7, achado 3): o corte não pode
-- esconder o sufixo que distingue "DejaVu Sans" de "DejaVu Sans Mono" nem
-- repetir rótulo na lista inteira.
local dejavu = {"DejaVu Sans", "DejaVu Sans Mono", "DejaVu Serif", "DejaVu Math TeX Gyre"}
local paginasDejavu = Converter.fontPages({families = dejavu})
local rotulosVistos = {}
local rotulosPorNome = {}
local totalDejavu = 0
for p = 1, #paginasDejavu do
  for b = 1, #paginasDejavu[p] do
    local rotuloDejavu = paginasDejavu[p][b].label
    totalDejavu = totalDejavu + 1
    rotulosPorNome[paginasDejavu[p][b].name] = rotuloDejavu
    igual(comprimento(rotuloDejavu) <= 12, true, "rótulo DejaVu cabe em 12 caracteres: " .. rotuloDejavu)
    igual(rotulosVistos[rotuloDejavu], nil, "rótulo DejaVu distinto: " .. rotuloDejavu)
    rotulosVistos[rotuloDejavu] = true
  end
end
igual(totalDejavu, 5, "Sans + as 4 famílias DejaVu entram na lista")
igual(rotulosPorNome["DejaVu Sans"], "DejaVu Sans", "nome que cabe fica inteiro")
igual(rotulosPorNome["DejaVu Sans Mono"], "…Sans Mono", "o corte preserva o 'Mono' que distingue a família")
igual(rotulosPorNome["DejaVu Math TeX Gyre"], "…TeX Gyre", "o corte começa na última palavra inteira que cabe")

-- fonte atual marcada no botão (#159, rodada 4, achado 3) ---------------------
local paginasComAtual = Converter.fontPages({families = {"Noto Sans"}}, "Sans")
igual(paginasComAtual[1][1].label, "Sans (atual)", "fonte atual marca o botão de Sans")
igual(paginasComAtual[1][2].label, "Noto Sans", "as outras fontes ficam sem a marca")
local paginasAtualNoMeio = Converter.fontPages({families = {"Noto Sans", "C059"}}, "C059")
igual(paginasAtualNoMeio[1][3].label, "C059 (atual)", "marca a atual fora do primeiro botão")
local paginasSemAtual = Converter.fontPages({families = {"Noto Sans"}})
igual(paginasSemAtual[1][1].label, "Sans", "sem fonte atual, nenhum botão é marcado")

-- Limite de traços por conversão (#159) ---------------------------------------

igual(Converter.MAX_ELEMENTOS, 2000, "o teto de elementos é o MAX_SHAPES do host")
igual(Converter.MAX_BYTES, 300 * 1024, "o teto de bytes é o BODY_CAP do host")
local function svgCom(n)
  local partes = {'<svg viewBox="0 0 10 10"><rect x="0" y="0" width="10" height="10" fill="#FFFFFF"/>'}
  for i = 1, n do partes[#partes + 1] = '<path d="M0 0 L1 1"/>' end
  return table.concat(partes) .. "</svg>"
end
local acima1999, el1999 = Converter.pedidoAcimaDoLimite(svgCom(1999), "{}")
igual(acima1999, false, "1999 traços + fundo = 2000 elementos passam (o host aceita)")
igual(el1999, 2000, "o <rect> de fundo entra na conta, como no host")
local acima2000 = Converter.pedidoAcimaDoLimite(svgCom(2000), "{}")
igual(acima2000, true, "2000 traços + fundo = 2001 elementos: o host recusaria")
igual(Converter.pedidoAcimaDoLimite(svgCom(1), string.rep("x", 300 * 1024)), false, "corpo de 300 KB exatos passa")
igual(Converter.pedidoAcimaDoLimite(svgCom(1), string.rep("x", 300 * 1024 + 1)), true, "corpo acima de 300 KB é recusado")
igual(Converter.pedidoAcimaDoLimite(nil, nil), false, "sem pedido não é pedido grande")

end

if falhas > 0 then
  print(string.format("%d falha(s)", falhas))
  os.exit(1)
end
print("tudo passou")
