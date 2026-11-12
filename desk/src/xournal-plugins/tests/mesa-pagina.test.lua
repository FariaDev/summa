-- Teste da lógica pura do plugin MesaPagina (#133).
-- Roda com qualquer Lua >= 5.3, sem o Xournal++:
--   lua desk/src/xournal-plugins/tests/mesa-pagina.test.lua
-- (Assume-se que este arquivo é executado a partir da raiz do repo.)

local raiz = debug.getinfo(1, "S").source:gsub("^@", ""):match("^(.+)/tests/[^/]+$") or "."
-- `raiz` é a pasta `xournal-plugins/` quando rodado por caminho absoluto;
-- senão, usa o caminho relativo a partir da raiz do repo.
local function tenta(caminho)
  local ok = pcall(dofile, caminho)
  if ok then return caminho end
  return nil
end
local dirPlugin = tenta("desk/src/xournal-plugins/MesaPagina/tamanho.lua")
  and "desk/src/xournal-plugins/MesaPagina"
  or (raiz .. "/MesaPagina")

package.path = dirPlugin .. "/?.lua;" .. package.path
local Tamanho = require("tamanho")

local falhas = 0
local function igual(got, esperado, nome)
  if got ~= esperado then
    falhas = falhas + 1
    print(string.format("FALHOU %s: recebeu %s, esperava %s", nome, tostring(got), tostring(esperado)))
  else
    print(string.format("passou %s = %s", nome, tostring(got)))
  end
end

local function proximo(got, esperado, nome)
  if math.abs(got - esperado) > 1e-9 then
    falhas = falhas + 1
    print(string.format("FALHOU %s: recebeu %s, esperava %s", nome, tostring(got), tostring(esperado)))
  else
    print(string.format("passou %s = %s", nome, tostring(got)))
  end
end

-- 1 cm = 72/2.54 pt; o passo é 2 cm.
proximo(Tamanho.CM_EM_PT, 72 / 2.54, "um centímetro em pontos")
igual(Tamanho.PASSO_CM, 2, "passo em centímetros")

local passoPt = 2 * (72 / 2.54)
local w, h

w, h = Tamanho.novaDimensao(595.275591, 841.889764, "direita")
proximo(w, 595.275591 + passoPt, "direita: largura cresce")
proximo(h, 841.889764, "direita: altura fica")

w, h = Tamanho.novaDimensao(595.275591, 841.889764, "abaixo")
proximo(w, 595.275591, "abaixo: largura fica")
proximo(h, 841.889764 + passoPt, "abaixo: altura cresce")

-- Direção desconhecida é erro, com o valor recebido na mensagem.
local ok, erro = pcall(Tamanho.novaDimensao, 100, 100, "cima")
igual(ok, false, "direção desconhecida dá erro")
local textoErro = tostring(erro)
if textoErro:find("cima", 1, true) == nil then
  falhas = falhas + 1
  print("FALHOU erro cita o valor recebido: " .. textoErro)
else
  print("passou erro cita o valor recebido")
end

-- Tamanho inválido dá erro.
igual(pcall(Tamanho.novaDimensao, 0, 100, "direita"), false, "largura zero dá erro")
igual(pcall(Tamanho.novaDimensao, 100, -5, "abaixo"), false, "altura negativa dá erro")

if falhas > 0 then
  print(string.format("%d falha(s)", falhas))
  os.exit(1)
end
print("tudo passou")
