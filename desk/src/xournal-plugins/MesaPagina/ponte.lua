-- MesaPagina: a ponte com a Mesa do converter em texto (#159).
-- Parser JSON mínimo, montagem do pedido `curl`, leitura das respostas,
-- runtime da Mesa e mensagens de motivo — sem chamar a API do Xournal++
-- (sem `app`), para poder ser testado fora dele (ver ../tests/mesa-ponte.test.lua).

local Ponte = {}

-- Parser JSON mínimo (#159): objeto plano com valores texto, número, true,
-- false ou null. Sem `load`: nunca executa o conteúdo (veneno de JSON não
-- vira código). Erros saem por error(detalhe, 0) e viram nil + motivo.

--- Codifica um codepoint em UTF-8 (byte por byte, sem a biblioteca utf8).
local function codificaUtf8(cp)
  if cp < 0x80 then
    return string.char(cp)
  end
  if cp < 0x800 then
    return string.char(0xC0 + math.floor(cp / 0x40), 0x80 + (cp % 0x40))
  end
  if cp < 0x10000 then
    return string.char(0xE0 + math.floor(cp / 0x1000), 0x80 + (math.floor(cp / 0x40) % 0x40), 0x80 + (cp % 0x40))
  end
  return string.char(0xF0 + math.floor(cp / 0x40000), 0x80 + (math.floor(cp / 0x1000) % 0x40), 0x80 + (math.floor(cp / 0x40) % 0x40), 0x80 + (cp % 0x40))
end

--- Avança sobre espaço em branco de JSON (só ' ', TAB, LF, CR).
local function pulaEspaco(p)
  while p.pos <= p.len do
    local c = p.s:sub(p.pos, p.pos)
    if c ~= " " and c ~= "\t" and c ~= "\n" and c ~= "\r" then return end
    p.pos = p.pos + 1
  end
end

--- Consome exatamente 4 dígitos hexadecimais (de um \uXXXX) ou erro.
local function leHex4(p)
  local v = 0
  for _ = 1, 4 do
    local d = tonumber(p.s:sub(p.pos, p.pos), 16)
    if d == nil then
      error("escape \\u inválido (esperado 4 dígitos hexadecimais)", 0)
    end
    v = v * 16 + d
    p.pos = p.pos + 1
  end
  return v
end

--- Lê a string JSON que começa na aspa atual (com escapes; sem controles
--- crus) e devolve o texto decodificado.
local function leTexto(p)
  p.pos = p.pos + 1
  local saida = {}
  while true do
    if p.pos > p.len then
      error("string não terminada (esperado \" e o fim do texto)", 0)
    end
    local c = p.s:sub(p.pos, p.pos)
    if c == '"' then
      p.pos = p.pos + 1
      return table.concat(saida)
    end
    if p.s:byte(p.pos) < 0x20 then
      error("caractere de controle sem escape na string (esperado texto sem controles)", 0)
    end
    if c ~= "\\" then
      saida[#saida + 1] = c
      p.pos = p.pos + 1
    else
      p.pos = p.pos + 1
      if p.pos > p.len then error("escape no fim da string", 0) end
      local e = p.s:sub(p.pos, p.pos)
      if e == "u" then
        p.pos = p.pos + 1
        local cp = leHex4(p)
        if cp >= 0xD800 and cp <= 0xDBFF then
          -- Alto surrogate: só vale com \uDC00..\uDFFF logo após; senão vira
          -- U+FFFD (como o encoding/json do Go) em vez de quebrar tudo.
          local combinado = false
          if p.s:sub(p.pos, p.pos + 1) == "\\u" then
            local baixo = tonumber(p.s:sub(p.pos + 2, p.pos + 5), 16)
            if baixo ~= nil and baixo >= 0xDC00 and baixo <= 0xDFFF then
              p.pos = p.pos + 6
              cp = 0x10000 + (cp - 0xD800) * 0x400 + (baixo - 0xDC00)
              combinado = true
            end
          end
          if not combinado then cp = 0xFFFD end
        elseif cp >= 0xDC00 and cp <= 0xDFFF then
          cp = 0xFFFD
        end
        saida[#saida + 1] = codificaUtf8(cp)
      else
        p.pos = p.pos + 1
        local simples = {['"'] = '"', ["\\"] = "\\", ["/"] = "/", b = "\b", f = "\f", n = "\n", r = "\r", t = "\t"}
        local rep = simples[e]
        if rep == nil then
          error("escape \\" .. e .. " inválido (esperado n, t, b, f, r, \", \\, /, u)", 0)
        end
        saida[#saida + 1] = rep
      end
    end
  end
end

--- Lê o número JSON atual (gramática estrita: sem + nem zeros à esquerda).
local function leNumero(p)
  local inicio = p.pos
  local c = p.s:sub(p.pos, p.pos)
  if c == "-" then p.pos = p.pos + 1 end
  c = p.s:sub(p.pos, p.pos)
  if c == "0" then
    p.pos = p.pos + 1
  elseif c:match("[1-9]") then
    while p.pos <= p.len and p.s:sub(p.pos, p.pos):match("%d") do p.pos = p.pos + 1 end
  else
    error("número inválido (esperado dígito)", 0)
  end
  if p.s:sub(p.pos, p.pos) == "." then
    p.pos = p.pos + 1
    if not p.s:sub(p.pos, p.pos):match("%d") then
      error("número inválido (esperado dígito após o ponto)", 0)
    end
    while p.pos <= p.len and p.s:sub(p.pos, p.pos):match("%d") do p.pos = p.pos + 1 end
  end
  c = p.s:sub(p.pos, p.pos)
  if c == "e" or c == "E" then
    p.pos = p.pos + 1
    c = p.s:sub(p.pos, p.pos)
    if c == "+" or c == "-" then p.pos = p.pos + 1 end
    if not p.s:sub(p.pos, p.pos):match("%d") then
      error("número inválido (esperado dígito no expoente)", 0)
    end
    while p.pos <= p.len and p.s:sub(p.pos, p.pos):match("%d") do p.pos = p.pos + 1 end
  end
  local n = tonumber(p.s:sub(inicio, p.pos - 1))
  if n == nil then error("número inválido", 0) end
  return n
end

--- Lê um valor escalar (texto, número, true, false, null). Aninhado não.
local function leValor(p)
  local c = p.s:sub(p.pos, p.pos)
  if c == '"' then return leTexto(p) end
  if c == "{" or c == "[" then
    error("valor aninhado não suportado (esperado texto ou número)", 0)
  end
  if c == "-" or c:match("%d") then return leNumero(p) end
  if p.s:sub(p.pos, p.pos + 3) == "true" then p.pos = p.pos + 4 return true end
  if p.s:sub(p.pos, p.pos + 4) == "false" then p.pos = p.pos + 5 return false end
  if p.s:sub(p.pos, p.pos + 3) == "null" then p.pos = p.pos + 4 return nil end
  error("valor inesperado (esperado texto, número, true, false ou null)", 0)
end

--- Lê o objeto plano que começa no "{" atual (chave repetida é erro).
local function leObjeto(p)
  p.pos = p.pos + 1
  local objeto, vistas = {}, {}
  pulaEspaco(p)
  if p.s:sub(p.pos, p.pos) == "}" then
    p.pos = p.pos + 1
    return objeto
  end
  while true do
    pulaEspaco(p)
    if p.s:sub(p.pos, p.pos) ~= '"' then
      error("chave de texto esperada (esperado \"alguma chave\")", 0)
    end
    local chave = leTexto(p)
    if vistas[chave] then
      error("chave repetida", 0)
    end
    vistas[chave] = true
    pulaEspaco(p)
    if p.s:sub(p.pos, p.pos) ~= ":" then
      error("esperado \":\" depois da chave", 0)
    end
    p.pos = p.pos + 1
    pulaEspaco(p)
    local valor = leValor(p)
    if valor ~= nil then objeto[chave] = valor end
    pulaEspaco(p)
    local sep = p.s:sub(p.pos, p.pos)
    if sep == "," then
      p.pos = p.pos + 1
    elseif sep == "}" then
      p.pos = p.pos + 1
      return objeto
    else
      error("esperado \",\" ou \"}\" (fim do objeto)", 0)
    end
  end
end

--- Analisa o texto como objeto JSON plano; devolve (tabela, nil) ou
--- (nil, detalhe). O detalhe nunca carrega o conteúdo (segredo não entra
--- em mensagem de erro).
-- Exemplo: analisaObjetoPlano('{"port":8080}') -> {port = 8080}
local function analisaObjetoPlano(conteudo)
  local function corre()
    if type(conteudo) ~= "string" then
      error("conteúdo deve ser texto (esperado texto JSON)", 0)
    end
    if #conteudo > 1000000 then
      error("conteúdo grande demais (esperado até 1 milhão de caracteres)", 0)
    end
    local p = {s = conteudo, pos = 1, len = #conteudo}
    pulaEspaco(p)
    if p.s:sub(p.pos, p.pos) ~= "{" then
      error("objeto esperado (esperado \"{\" no início)", 0)
    end
    local objeto = leObjeto(p)
    pulaEspaco(p)
    if p.pos <= p.len then
      error("lixo após o objeto (esperado fim do texto)", 0)
    end
    return objeto
  end
  local ok, resultado = pcall(corre)
  if ok then return resultado end
  return nil, tostring(resultado)
end

--- Descreve o valor recebido em mensagens de erro (texto sai como "texto com
--- N caracteres": segredo nunca é despejado).
local function descreveValor(valor)
  if type(valor) == "number" then return string.format("%g", valor) end
  if type(valor) == "string" then return "texto com " .. #valor .. " caracteres" end
  if valor == nil then return "ausente" end
  return type(valor)
end

--- Lê o arquivo da ponte (`{"port":N,"token":"..."}`): porta inteira entre
--- 1 e 65535 e token de 16 a 128 caracteres [A-Za-z0-9_-]. Fora disso (ou
--- JSON inválido): nil + motivo, sem despejar o token no motivo.
-- Exemplo: parseBridgeFile('{"port":8080,"token":"abcdefghijklmnop"}')
function Ponte.parseBridgeFile(conteudo)
  local objeto, detalhe = analisaObjetoPlano(conteudo)
  if objeto == nil then
    return nil, "parseBridgeFile: JSON inválido (" .. detalhe .. ")"
  end
  local porta = objeto.port
  local portaInteira = nil
  if type(porta) == "number" then portaInteira = math.tointeger(porta) end
  if portaInteira == nil or portaInteira < 1 or portaInteira > 65535 then
    return nil, "parseBridgeFile: porta deve ser inteiro entre 1 e 65535 (recebido: " .. descreveValor(porta) .. ")"
  end
  local token = objeto.token
  if type(token) ~= "string" or #token < 16 or #token > 128 or not token:match("^[A-Za-z0-9_%-]+$") then
    return nil, "parseBridgeFile: token deve ter 16 a 128 caracteres [A-Za-z0-9_-] (recebido: " .. descreveValor(token) .. ")"
  end
  return {port = portaInteira, token = token}
end

--- Lê a resposta da ponte (`{"text":"..."}` ou `{"reason":"quota"|...}`):
--- {text=...} ou {reason=...}; as duas juntas, nenhuma, fora do tipo ou
--- JSON inválido: nil + motivo.
-- Exemplo: parseResponse('{"text":"olá"}') -> {text = "olá"}
function Ponte.parseResponse(corpo)
  local objeto, detalhe = analisaObjetoPlano(corpo)
  if objeto == nil then
    return nil, "parseResponse: JSON inválido (" .. detalhe .. ")"
  end
  local texto, motivo = objeto.text, objeto.reason
  if texto ~= nil and motivo ~= nil then
    return nil, "parseResponse: resposta traz 'text' e 'reason' (esperado só um)"
  end
  if texto ~= nil then
    if type(texto) ~= "string" then
      return nil, "parseResponse: 'text' deve ser texto (recebido: " .. descreveValor(texto) .. ")"
    end
    return {text = texto}
  end
  if motivo ~= nil then
    if type(motivo) ~= "string" then
      return nil, "parseResponse: 'reason' deve ser texto (recebido: " .. descreveValor(motivo) .. ")"
    end
    return {reason = motivo}
  end
  return nil, "parseResponse: resposta sem 'text' nem 'reason'"
end

--- Escapa um texto para dentro de uma string JSON (aspas, barra, controles;
--- UTF-8 passa cru). Usado para montar o `{"svg": "..."}` do pedido à ponte.
local function escapaJsonTexto(s)
  local partes = {}
  for i = 1, #s do
    local b = s:byte(i)
    local c = s:sub(i, i)
    if c == '"' then
      partes[#partes + 1] = '\\"'
    elseif c == "\\" then
      partes[#partes + 1] = "\\\\"
    elseif c == "\n" then
      partes[#partes + 1] = "\\n"
    elseif c == "\r" then
      partes[#partes + 1] = "\\r"
    elseif c == "\t" then
      partes[#partes + 1] = "\\t"
    elseif b == 8 then
      partes[#partes + 1] = "\\b"
    elseif b == 12 then
      partes[#partes + 1] = "\\f"
    elseif b < 0x20 then
      partes[#partes + 1] = string.format("\\u%04x", b)
    else
      partes[#partes + 1] = c
    end
  end
  return table.concat(partes)
end

--- Monta o corpo JSON do pedido à ponte (`{"svg":"..."}`), escapando o SVG.
--- SVG não-texto: nil + motivo.
-- Exemplo: buildBridgeRequest('<svg/>') -> '{"svg":"<svg/>"}'
function Ponte.buildBridgeRequest(svg)
  if type(svg) ~= "string" then
    return nil, "buildBridgeRequest: svg deve ser texto (esperado SVG como texto)"
  end
  return '{"svg":"' .. escapaJsonTexto(svg) .. '"}'
end

--- Monta o comando `curl` síncrono para a ponte (#159): o token vai em
--- arquivo de header (nunca na linha de comando, que aparece no `ps`) e o
--- SVG em arquivo temporário (`--data-binary @`). Teto de 20 s
--- (`--max-time 20`) porque a chamada congela o Xournal++. Porta fora do
--- intervalo ou caminho com aspa/quebra: nil + motivo.
-- Exemplo: buildCurlCommand(8080, "/tmp/cab", "/tmp/cor")
function Ponte.buildCurlCommand(porta, arquivoHeader, arquivoCorpo)
  local portaInteira = nil
  if type(porta) == "number" then portaInteira = math.tointeger(porta) end
  if portaInteira == nil or portaInteira < 1 or portaInteira > 65535 then
    return nil, "buildCurlCommand: porta deve ser inteiro entre 1 e 65535 (recebido: " .. descreveValor(porta) .. ")"
  end
  local function caminhoOk(caminho)
    return type(caminho) == "string" and caminho ~= ""
      and not caminho:find("'", 1, true) and not caminho:find("\n", 1, true) and not caminho:find("\r", 1, true)
  end
  if not caminhoOk(arquivoHeader) then
    return nil, "buildCurlCommand: arquivoHeader deve ser texto sem aspa nem quebra (esperado caminho de arquivo temporário)"
  end
  if not caminhoOk(arquivoCorpo) then
    return nil, "buildCurlCommand: arquivoCorpo deve ser texto sem aspa nem quebra (esperado caminho de arquivo temporário)"
  end
  -- `--noproxy '*'`: loopback não é isento de proxy no curl; sem isto o token e
  -- a tinta iam ao http_proxy/~/.curlrc do ambiente (auditoria #159, F1).
  return "curl --silent --show-error --max-time 20 --noproxy '*' --request POST"
    .. " --header @'" .. arquivoHeader .. "'"
    .. " --header 'Content-Type: application/json'"
    .. " --data-binary @'" .. arquivoCorpo .. "'"
    .. " 'http://127.0.0.1:" .. portaInteira .. "/converter'"
    .. " --write-out '\\n%{http_code}'"
end

--- Separa a saída do `curl` pedido por `buildCurlCommand` no corpo JSON e no
--- código HTTP final (`--write-out '\n%{http_code}'`): código 0 = sem
--- conexão (Mesa fechada ou teto estourado). Sem código de 3 dígitos no fim:
--- nil + motivo.
-- Exemplo: parseCurlOutput('{"text":"oi"}\n200') -> '{"text":"oi"}', 200
function Ponte.parseCurlOutput(saida)
  if type(saida) ~= "string" or saida == "" then
    return nil, "parseCurlOutput: saída vazia (esperado corpo + código HTTP de 3 dígitos)"
  end
  local corpo = saida:match("^(.*)\n%d%d%d$")
  local digitos = saida:match("\n(%d%d%d)$")
  if corpo == nil or digitos == nil then
    return nil, "parseCurlOutput: sem código HTTP de 3 dígitos no fim (esperado corpo + quebra + código)"
  end
  return corpo, tonumber(digitos)
end

--- Lê o arquivo que a instalação da Mesa grava na pasta do plugin
--- (`mesa-runtime.json`, `{"runtime":"<pasta do runtime>"}`): runtime texto
--- não vazio. Fora disso (ou JSON inválido): nil + motivo, sem o caminho no
--- motivo (mensagem de erro sem caminho pessoal).
-- Exemplo: parseRuntimeFile('{"runtime":"/x/.runtime"}') -> {runtime = "/x/.runtime"}
function Ponte.parseRuntimeFile(conteudo)
  local objeto, detalhe = analisaObjetoPlano(conteudo)
  if objeto == nil then
    return nil, "parseRuntimeFile: JSON inválido (" .. detalhe .. ")"
  end
  if type(objeto.runtime) ~= "string" or objeto.runtime == "" then
    return nil, "parseRuntimeFile: runtime deve ser texto com o caminho da pasta do runtime (recebido: " .. descreveValor(objeto.runtime) .. ")"
  end
  return {runtime = objeto.runtime}
end

--- A conversão depende de `curl` com aspas simples e `chmod`, que não valem
--- no `io.popen` do Windows (passa pelo `cmd.exe`): lá o plugin avisa e sai
--- (#159, revisão). O separador vem de `package.config:sub(1, 1)`.
-- Exemplo: conversaoDisponivel("/") -> true; conversaoDisponivel("\\") -> false
function Ponte.conversaoDisponivel(separador)
  return separador ~= "\\"
end

--- Mensagem clara em pt-BR para cada `{reason}` da ponte (#159), pronta para
--- o `app.openDialog`. Diz onde ligar a leitura e usa o vocabulário da Mesa
--- ("modelo com visão"); motivo desconhecido, nil ou vazio cai no genérico.
-- Exemplo: reasonMessage("disabled") -> "Ligue “Buscar também na escrita à mão” em Cadernos, na Mesa, para converter."
function Ponte.reasonMessage(motivo)
  local mensagens = {
    disabled = "Ligue “Buscar também na escrita à mão” em Cadernos, na Mesa, para converter.",
    quota = "Sem cota no modelo atual. Escolha outro modelo com visão na Mesa ou tente mais tarde.",
    ["no-model"] = "Nenhum modelo com visão disponível. Configure um na Mesa.",
    ["no-vision"] = "O modelo atual não lê imagens. Escolha um modelo com visão na Mesa.",
    free = "O modelo gratuito não lê tinta. Escolha um modelo com visão na Mesa.",
    busy = "A Mesa ainda está terminando a conversão anterior. Aguarde e tente de novo.",
    timeout = "A conversão demorou demais. Tente de novo. Se o trecho for grande, selecione menos tinta.",
    ["too-large"] = "O trecho selecionado é grande demais. Selecione um trecho menor.",
    ["bad-request"] = "A Mesa recusou o trecho (formato inválido). Selecione de novo.",
    forbidden = "A Mesa recusou a chamada. Reabra a Mesa e tente de novo.",
  }
  if type(motivo) == "string" and mensagens[motivo] then
    return mensagens[motivo]
  end
  return "Não deu para converter a tinta. Tente de novo."
end

return Ponte
