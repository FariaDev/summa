-- Teste da ponte do converter em texto (#159): parser JSON mínimo, pedido e
-- resposta da Mesa, `curl`, runtime e mensagens de motivo. Sem o Xournal++:
--   lua desk/src/xournal-plugins/tests/mesa-ponte.test.lua
-- (Assume-se que este arquivo é executado a partir da raiz do repo.)

local raiz = debug.getinfo(1, "S").source:gsub("^@", ""):match("^(.+)/tests/[^/]+$") or "."
-- `raiz` é a pasta `xournal-plugins/` quando rodado por caminho absoluto;
-- senão, usa o caminho relativo a partir da raiz do repo.
local function tenta(caminho)
  local ok = pcall(dofile, caminho)
  if ok then return caminho end
  return nil
end
local dirPlugin = tenta("desk/src/xournal-plugins/MesaPagina/ponte.lua")
  and "desk/src/xournal-plugins/MesaPagina"
  or (raiz .. "/MesaPagina")

package.path = dirPlugin .. "/?.lua;" .. package.path
local okModulo, Ponte = pcall(require, "ponte")

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
  print("FALHOU carregar o módulo ponte: " .. tostring(Ponte))
else

-- conversaoDisponivel ---------------------------------------------------------

igual(Ponte.conversaoDisponivel("/"), true, "separador / (Linux/macOS): conversão disponível")
igual(Ponte.conversaoDisponivel("\\"), false, "separador \\ (Windows): conversão indisponível")
igual(Ponte.conversaoDisponivel(nil), true, "separador ausente não bloqueia a conversão")

-- parseBridgeFile --------------------------------------------------------------

local ponte = Ponte.parseBridgeFile('{"port": 54321, "token": "aBcD_1234-eFgH5678"}')
igual(ponte.port, 54321, "ponte lê a porta")
igual(ponte.token, "aBcD_1234-eFgH5678", "ponte lê o token")

local ponteMin = Ponte.parseBridgeFile('{"port":1,"token":"abcdefghijklmnop"}')
igual(ponteMin.port, 1, "porta 1 é válida")
local ponteMax = Ponte.parseBridgeFile('{"port":65535,"token":"' .. string.rep("a", 128) .. '"}')
igual(ponteMax.port, 65535, "porta 65535 é válida")
igual(#ponteMax.token, 128, "token de 128 caracteres é válido")

deveDarNil("porta 0", Ponte.parseBridgeFile, '{"port":0,"token":"abcdefghijklmnop"}')
deveDarNil("porta 65536", Ponte.parseBridgeFile, '{"port":65536,"token":"abcdefghijklmnop"}')
deveDarNil("porta fracionária", Ponte.parseBridgeFile, '{"port":8080.5,"token":"abcdefghijklmnop"}')
deveDarNil("porta texto", Ponte.parseBridgeFile, '{"port":"8080","token":"abcdefghijklmnop"}')
deveDarNil("sem porta", Ponte.parseBridgeFile, '{"token":"abcdefghijklmnop"}')
deveDarNil("sem token", Ponte.parseBridgeFile, '{"port":8080}')
deveDarNil("porta null", Ponte.parseBridgeFile, '{"port":null,"token":"abcdefghijklmnop"}')

-- token: 16-128 de [A-Za-z0-9_-]
deveDarNil("token curto", Ponte.parseBridgeFile, '{"port":8080,"token":"abc"}')
deveDarNil("token de 15 caracteres", Ponte.parseBridgeFile, '{"port":8080,"token":"' .. string.rep("a", 15) .. '"}')
deveDarNil("token de 129 caracteres", Ponte.parseBridgeFile, '{"port":8080,"token":"' .. string.rep("a", 129) .. '"}')
for _, ruim in ipairs({"+", "=", " ", "/"}) do
  deveDarNil("token com caractere " .. ruim, Ponte.parseBridgeFile, '{"port":8080,"token":"abcdefghijklmno' .. ruim .. '"}')
end
deveDarNil("token malicioso não executa nem passa", Ponte.parseBridgeFile, [[ {"port":8080,"token":"x"); os.execute('rm -rf /')--"} ]])

-- JSON malformado
for _, ruim in ipairs({"{", "{port: 1}", '{"port":8080,', '{"port":8080} x', '{"port":{"a":1},"token":"abcdefghijklmnop"}', '{"port":8080,"port":8081,"token":"abcdefghijklmnop"}', '{"port":08,"token":"abcdefghijklmnop"}'}) do
  deveDarNil("JSON inválido: " .. ruim, Ponte.parseBridgeFile, ruim)
end
deveDarNil("ponte nil", Ponte.parseBridgeFile, nil)
deveDarNil("ponte número", Ponte.parseBridgeFile, 123)

-- escape \u no token (A = \u0041) e content extra
local ponteEscape = Ponte.parseBridgeFile('{"port":8080,"token":"' .. string.rep("A", 15) .. '\\u0041"}')
igual(ponteEscape.token, string.rep("A", 16), "escape \\u no token vira A")
local ponteExtra = Ponte.parseBridgeFile('{"port":8080,"token":"abcdefghijklmnop","extra":1,"outro":"x"}')
igual(ponteExtra.port, 8080, "chave extra não quebra a ponte")

-- conteúdo gigante: recusado sem varrer tudo em vão
deveDarNil("conteúdo gigante", Ponte.parseBridgeFile, string.rep(" ", 1000001))

-- parseResponse ----------------------------------------------------------------

local resposta = Ponte.parseResponse('{"text":"olá mundo"}')
igual(resposta.text, "olá mundo", "resposta lê o text")
local respostaUnicode = Ponte.parseResponse('{"text":"\\u00e9"}')
igual(respostaUnicode.text, "é", "escape \\u00e9 vira é")
local respostaEmoji = Ponte.parseResponse('{"text":"\\ud83d\\ude00"}')
igual(respostaEmoji.text, "\240\159\152\128", "par surrogate vira UTF-8 de 4 bytes")
local respostaEscape = Ponte.parseResponse('{"text":"a\\"b\\nc"}')
igual(respostaEscape.text, "a\"b\nc", "escapes de aspas e quebra funcionam")
local respostaQuota = Ponte.parseResponse('{"reason":"quota"}')
igual(respostaQuota.reason, "quota", "resposta lê o reason")
igual(respostaQuota.text, nil, "reason não traz text")
local respostaVazia = Ponte.parseResponse('{"text":""}')
igual(respostaVazia.text, "", "text vazio volta como vazio (quem decide é o caller)")
local respostaExtra = Ponte.parseResponse('{"text":"a","extra":true}')
igual(respostaExtra.text, "a", "chave extra não quebra a resposta")

deveDarNil("text e reason juntos", Ponte.parseResponse, '{"text":"a","reason":"quota"}')
deveDarNil("sem text nem reason", Ponte.parseResponse, '{"foo":1}')
deveDarNil("text não é texto", Ponte.parseResponse, '{"text":5}')
deveDarNil("reason não é texto", Ponte.parseResponse, '{"reason":5}')
deveDarNil("resposta inválida", Ponte.parseResponse, 'não é json')
deveDarNil("resposta vazia", Ponte.parseResponse, '')
deveDarNil("resposta nil", Ponte.parseResponse, nil)

-- port precisa ser inteiro de verdade; bordas de JSON
local ponteFloatInteira = Ponte.parseBridgeFile('{"port":8080.0,"token":"abcdefghijklmnop"}')
igual(ponteFloatInteira.port, 8080, "porta float integral 8080.0 vira 8080")
igual(math.type(ponteFloatInteira.port), "integer", "porta float integral vira inteiro Lua")
deveDarNil("porta booleana", Ponte.parseBridgeFile, '{"port":true,"token":"abcdefghijklmnop"}')
deveDarNil("porta false", Ponte.parseBridgeFile, '{"port":false,"token":"abcdefghijklmnop"}')
deveDarNil("vírgula final no JSON da ponte", Ponte.parseBridgeFile, '{"port":8080,"token":"abcdefghijklmnop",}')
deveDarNil("truex na ponte", Ponte.parseBridgeFile, '{"port":truex,"token":"abcdefghijklmnop"}')
deveDarNil("truex no text", Ponte.parseResponse, '{"text":truex}')
deveDarNil("vírgula final na resposta", Ponte.parseResponse, '{"text":"a",}')

-- motivo não interpola a chave
local _, motivoRepetida = Ponte.parseBridgeFile('{"segredo1234567890abcd":1,"segredo1234567890abcd":2,"port":8080,"token":"abcdefghijklmnop"}')
igual(motivoRepetida ~= nil, true, "chave repetida dá motivo")
if type(motivoRepetida) == "string" then naoContem(motivoRepetida, "segredo1234567890abcd", "motivo de chave repetida não tem a chave") end
local _, motivoSemPonto = Ponte.parseBridgeFile('{"segredo1234567890abcd" 1,"port":8080,"token":"abcdefghijklmnop"}')
igual(motivoSemPonto ~= nil, true, "sem : dá motivo")
if type(motivoSemPonto) == "string" then naoContem(motivoSemPonto, "segredo1234567890abcd", "motivo sem : não tem a chave") end

-- buildBridgeRequest ---------------------------------------------------------

igual(Ponte.buildBridgeRequest('<svg/>'), '{"svg":"<svg/>"}', "pedido da ponte é {svg}")
igual(Ponte.buildBridgeRequest('a"b\\c\nd'), '{"svg":"a\\"b\\\\c\\nd"}', "pedido escapa aspas, barra e quebra")
igual(Ponte.buildBridgeRequest("é"), '{"svg":"é"}', "UTF-8 passa cru no pedido")
igual(Ponte.buildBridgeRequest(string.char(1)), '{"svg":"\\u0001"}', "controle vira \\u00XX no pedido")
deveDarNil("pedido nil", Ponte.buildBridgeRequest, nil)
deveDarNil("pedido número", Ponte.buildBridgeRequest, 5)

-- buildCurlCommand -----------------------------------------------------------

local comando = Ponte.buildCurlCommand(54321, "/tmp/cabecalho", "/tmp/corpo")
contem(comando, "--noproxy '*'", "curl da ponte ignora proxy do ambiente e do ~/.curlrc (auditoria F1)")
igual(type(comando), "string", "comando curl é texto")
contem(comando, "curl", "comando começa com curl")
contem(comando, "--max-time 20", "comando tem teto de 20 s")
contem(comando, "POST", "comando é POST")
contem(comando, "'http://127.0.0.1:54321/converter'", "comando aponta para 127.0.0.1:/converter")
contem(comando, "@'/tmp/cabecalho'", "token vai por arquivo de header (-H @)")
contem(comando, "@'/tmp/corpo'", "SVG vai por arquivo (--data-binary @)")
contem(comando, "%{http_code}", "comando pede o código HTTP no fim")
naoContem(comando, "x-mesa-token", "token nunca aparece na linha de comando")
naoContem(comando, "token", "nem a palavra token aparece na linha de comando")

local comandoEspaco = Ponte.buildCurlCommand(8080, "/tmp/tem espaço", "/tmp/corpo")
contem(comandoEspaco, "@'/tmp/tem espaço'", "caminho com espaço é citado")

deveDarNil("porta 0 no curl", Ponte.buildCurlCommand, 0, "/tmp/a", "/tmp/b")
deveDarNil("porta 65536 no curl", Ponte.buildCurlCommand, 65536, "/tmp/a", "/tmp/b")
deveDarNil("porta texto no curl", Ponte.buildCurlCommand, "8080", "/tmp/a", "/tmp/b")
deveDarNil("porta nil no curl", Ponte.buildCurlCommand, nil, "/tmp/a", "/tmp/b")
deveDarNil("header vazio no curl", Ponte.buildCurlCommand, 8080, "", "/tmp/b")
deveDarNil("corpo vazio no curl", Ponte.buildCurlCommand, 8080, "/tmp/a", "")
deveDarNil("header nil no curl", Ponte.buildCurlCommand, 8080, nil, "/tmp/b")
deveDarNil("caminho com aspa no curl", Ponte.buildCurlCommand, 8080, "/tmp/a'b", "/tmp/b")
deveDarNil("caminho com quebra no curl", Ponte.buildCurlCommand, 8080, "/tmp/a\nb", "/tmp/b")
deveDarNil("caminho com retorno no curl", Ponte.buildCurlCommand, 8080, "/tmp/a", "/tmp/b\rc")

-- parseCurlOutput ------------------------------------------------------------

local corpoCurl, codigoCurl = Ponte.parseCurlOutput('{"text":"oi"}\n200')
igual(corpoCurl, '{"text":"oi"}', "saída curl separa o corpo")
igual(codigoCurl, 200, "saída curl separa o código")

local corpoVazio, codigoZero = Ponte.parseCurlOutput('\n000')
igual(corpoVazio, "", "código 000 tem corpo vazio")
igual(codigoZero, 0, "código 000 vira número 0")

local corpoQuebra, codigoQuebrado = Ponte.parseCurlOutput('{\n  "text": "oi"\n}\n403')
igual(codigoQuebrado, 403, "código é o da última linha")
contem(corpoQuebra, '"text": "oi"', "corpo com quebra interna sobrevive")

deveDarNil("saída vazia no curl", Ponte.parseCurlOutput, "")
deveDarNil("saída nil no curl", Ponte.parseCurlOutput, nil)
deveDarNil("saída sem código no curl", Ponte.parseCurlOutput, '{"text":"oi"}')
deveDarNil("saída com código curto no curl", Ponte.parseCurlOutput, '{"text":"oi"}\n20')
deveDarNil("saída com código texto no curl", Ponte.parseCurlOutput, '{"text":"oi"}\nOK')

-- parseRuntimeFile -----------------------------------------------------------

local runtime = Ponte.parseRuntimeFile('{"runtime":"/aluno/mesa/.runtime"}')
igual(runtime.runtime, "/aluno/mesa/.runtime", "runtime lê o caminho")
local runtimeExtra = Ponte.parseRuntimeFile('{"runtime":"/x","outro":1}')
igual(runtimeExtra.runtime, "/x", "runtime aceita chave extra")
deveDarNil("runtime vazio", Ponte.parseRuntimeFile, '{"runtime":""}')
deveDarNil("runtime ausente", Ponte.parseRuntimeFile, '{"outro":1}')
deveDarNil("runtime número", Ponte.parseRuntimeFile, '{"runtime":5}')
deveDarNil("runtime inválido", Ponte.parseRuntimeFile, '{"runtime":')
deveDarNil("runtime nil", Ponte.parseRuntimeFile, nil)

-- reasonMessage --------------------------------------------------------------

igual(Ponte.reasonMessage("disabled"), "Ligue “Buscar também na escrita à mão” em Cadernos, na Mesa, para converter.", "disabled pede ligar a leitura no lugar certo com aspas curvas (#159, achado 7)")
naoContem(Ponte.reasonMessage("disabled"), "'", "disabled não usa aspas retas")
igual(Ponte.reasonMessage("quota"), "Sem cota no modelo atual. Escolha outro modelo com visão na Mesa ou tente mais tarde.", "quota fala da cota e da saída sem repetir \"modelo com visão\"")
local _, repeticoesQuota = Ponte.reasonMessage("quota"):gsub("modelo com visão", "")
igual(repeticoesQuota, 1, "quota cita \"modelo com visão\" uma vez só (#159, achado 5 da rodada 5)")
igual(Ponte.reasonMessage("no-model"), "Nenhum modelo com visão disponível. Configure um na Mesa.", "no-model fala do modelo")
local _, repeticoesNoModel = Ponte.reasonMessage("no-model"):gsub("modelo com visão", "")
igual(repeticoesNoModel, 1, "no-model cita \"modelo com visão\" uma vez só (#159, rodada 7, achado 5)")
igual(Ponte.reasonMessage("no-vision"), "O modelo atual não lê imagens. Escolha um modelo com visão na Mesa.", "no-vision fala da visão")
igual(Ponte.reasonMessage("free"), "O modelo gratuito não lê tinta. Escolha um modelo com visão na Mesa.", "free fala do modelo gratuito")
igual(Ponte.reasonMessage("busy"), "A Mesa ainda está terminando a conversão anterior. Aguarde e tente de novo.", "busy fala de espera")
naoContem(Ponte.reasonMessage("quota"), "modelo de visão", "quota usa o vocabulário da Mesa (modelo com visão)")
naoContem(Ponte.reasonMessage("no-model"), "modelo de visão", "no-model usa o vocabulário da Mesa (modelo com visão)")
naoContem(Ponte.reasonMessage("disabled"), "ponte", "disabled sem jargão de ponte")
igual(Ponte.reasonMessage("timeout"), "A conversão demorou demais. Tente de novo. Se o trecho for grande, selecione menos tinta.", "timeout fala da demora e do trecho grande")
igual(Ponte.reasonMessage("too-large"), "O trecho selecionado é grande demais. Selecione um trecho menor.", "too-large fala do tamanho")
igual(Ponte.reasonMessage("bad-request"), "A Mesa recusou o trecho (formato inválido). Selecione de novo.", "bad-request fala do formato")
igual(Ponte.reasonMessage("forbidden"), "A Mesa recusou a chamada. Reabra a Mesa e tente de novo.", "forbidden pede reabrir")
igual(Ponte.reasonMessage("motivodesconhecido"), "Não deu para converter a tinta. Tente de novo.", "motivo desconhecido cai no genérico")
igual(Ponte.reasonMessage(nil), "Não deu para converter a tinta. Tente de novo.", "motivo nil cai no genérico")
igual(Ponte.reasonMessage(""), "Não deu para converter a tinta. Tente de novo.", "motivo vazio cai no genérico")

end

if falhas > 0 then
  print(string.format("%d falha(s)", falhas))
  os.exit(1)
end
print("tudo passou")
