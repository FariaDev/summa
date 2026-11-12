-- MesaPagina: lógica pura do crescimento da página (#133).
-- Este módulo não chama a API do Xournal++: só calcula o tamanho novo,
-- para poder ser testado fora do Xournal++ (ver ../tests/).

local Tamanho = {}

-- Pontos por centímetro: 1 pt = 1/72 de polegada e 1 pol = 2.54 cm.
Tamanho.CM_EM_PT = 72 / 2.54
-- Passo de crescimento de cada atalho, em centímetros.
Tamanho.PASSO_CM = 2

--- Calcula o tamanho novo da página após crescer PASSO_CM num sentido.
-- direcao: "direita" (a largura cresce) ou "abaixo" (a altura cresce).
-- Retorna (novaLargura, novaAltura), em pontos.
-- Exemplo: Tamanho.novaDimensao(595.275591, 841.889764, "direita")
--   → (595.275591 + 2 * (72 / 2.54), 841.889764)
function Tamanho.novaDimensao(largura, altura, direcao)
  if type(largura) ~= "number" or largura <= 0 then
    error(string.format("novaDimensao: largura deve ser número > 0 em pontos, recebeu %s", tostring(largura)))
  end
  if type(altura) ~= "number" or altura <= 0 then
    error(string.format("novaDimensao: altura deve ser número > 0 em pontos, recebeu %s", tostring(altura)))
  end
  if direcao == "direita" then
    return largura + Tamanho.PASSO_CM * Tamanho.CM_EM_PT, altura
  end
  if direcao == "abaixo" then
    return largura, altura + Tamanho.PASSO_CM * Tamanho.CM_EM_PT
  end
  error(string.format('novaDimensao: direção deve ser "direita" ou "abaixo", recebeu %s', tostring(direcao)))
end

return Tamanho
