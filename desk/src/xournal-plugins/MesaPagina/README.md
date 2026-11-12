# MesaPagina (Xournal++ 1.3.8)

Plugin Lua com quatro itens:

- **Página atual +2 cm à direita / abaixo** (issue #133): aumenta a página atual,
  sem auto-crescimento — a API Lua do 1.3.8 não tem hook de traço, então o
  crescimento é manual, um atalho de cada vez.
- **Converter a seleção em texto…** (issue #159): lê a tinta da seleção e converte em
  caixa de texto pela ponte da Mesa (chamada síncrona, até 20 s, com aviso
  antes). Seleção que passa dos tetos da ponte (2000 elementos no SVG,
  contando o fundo, ou 300 KB no pedido) é recusada antes do aviso. A tinta original fica; o texto entra numa camada nova
  acima ("Texto convertido") para comparar e apagar o que quiser. No Windows a
  conversão ainda não funciona (o `io.popen` passa pelo `cmd.exe` e não
  aceita aspas simples nem `chmod`): o plugin avisa e sai.
- **Trocar fonte dos textos…** (issue #159): recria os textos da seleção (ou
  da página, sem seleção) com a família escolhida no diálogo de botões do
  1.3.8 (sem seletor de lista; 4 famílias na primeira página e 3 nas seguintes, com "Mais…" e
  "Cancelar"), preservando o tamanho de cada texto. Cada grupo insere os
  novos e só então apaga os antigos na mesma camada: se a inserção falhar,
  nada é apagado.

O `.xopp` salvo continua abrindo no Xournal++ oficial: muda só o tamanho da
página, e a Mesa não precisa mudar nada.

## Atalhos

| Ação | Atalho |
|---|---|
| Página atual +2 cm à direita | `Ctrl+Alt+R` |
| Página atual +2 cm abaixo | `Ctrl+Alt+B` |
| Converter a seleção em texto… | `Ctrl+Shift+K` |
| Trocar fonte dos textos… | `Ctrl+Shift+J` |

Os atalhos foram escolhidos por não colidirem com nenhum atalho padrão do
Xournal++ 1.3.8 (`ui/mainmenubar.xml` + `ActionProperties.h`: quase todo
Ctrl+letra é ocupado — os livres seriam `b/j/k/u` sem Ctrl+Alt, sem
mnemônica em português nem inglês — e `B` dá "baixo"). Ctrl+Alt+D seria o
"direita" em português, mas no Xfce o Ctrl+Alt+D é "mostrar a área de
trabalho" do gerenciador de janelas e a janela do Xournal++ nem recebe a
tecla; Ctrl+Alt+seta também não serve pelo mesmo motivo (troca de área de
trabalho no Xfce e de Spaces no macOS). Por isso `R` ("right") no lugar de
`D`. Se o seu ambiente ligar Ctrl+Alt+R/B a outra coisa, os dois itens
seguem no menu do plugin.

## Página com fundo de PDF

O PDF fica ancorado no canto de cima à esquerda da página (é desenhado na
origem da página, no tamanho do próprio PDF), então o espaço ganho fica à
**direita** (no item "à direita") ou **abaixo** (no item "abaixo"), nunca
cortando o fundo.

## Instalação manual

Copie a pasta `MesaPagina/` para a pasta de plugins da configuração do
Xournal++ e ative no Gerenciador de plugins (menu Plugins; exige reiniciar o
Xournal++):

- Linux/macOS: `$XDG_CONFIG_HOME/xournalpp/plugins/MesaPagina/` quando o
  `XDG_CONFIG_HOME` for absoluto; sem ele, `~/.config/xournalpp/plugins/MesaPagina/`
- Windows: `%LOCALAPPDATA%\xournalpp\plugins\MesaPagina/`
  (ou seja, `C:\Users\<você>\AppData\Local\xournalpp\plugins\MesaPagina\`)

## Instalação pela Mesa

A Mesa instala o plugin por pedido explícito, sem copiar à mão: no painel de
Componentes (Sobre → "O que a Mesa usa"), a linha do Xournal++ mostra o estado
("não instalado" / "instalado" / "instalado, versão diferente" / "modificado")
e o botão **"Instalar plugin da página"**, que copia `main.lua`, `tamanho.lua`,
`converter.lua`, `ponte.lua`, `plugin.ini` (com `enabled=true` na cópia, para já vir ligado),
`mesa-runtime.json` (pasta do runtime da Mesa, gravada na instalação — sem ela
o converter pede "Abra a Mesa") e `README.md`
para `<pasta de plugins>/MesaPagina/`. Se já houver uma pasta `MesaPagina` de
outro autor, a Mesa recusa sem tocar nela. Feito isso, é preciso **reiniciar o
Xournal++** para o plugin carregar.

A instalação grava `.mesa-instalado.json` na pasta, com a versão e o sha256 de
cada arquivo. Na reinstalação, a pasta só é "nossa" se esse manifesto existir,
os hashes dos arquivos **listados** nele conferirem e não houver arquivo extra
(arquivo fora do manifesto vira **"modificado"**, e a Mesa recusa): assim uma
versão futura com um arquivo a mais continua reconhecendo a instalação antiga.
Pasta sem manifesto é alheia — até quando o `plugin.ini` é igual ao da Mesa,
porque essa fatia nunca foi publicada. A escrita é atômica: tudo é montado em
`<config>/xournalpp/.mesa-instalacao/` (irmã de `<plugins>`, que o Xournal++
não varre) e entra por `rename`; se falhar no meio, a pasta antiga segue de pé.

## Testes

A lógica pura (tamanho da página, SVG, troca de fonte e a ponte JSON/`curl`)
não chama a API do Xournal++; os testes vivem em `../tests/` e rodam com
qualquer Lua ≥ 5.3:

```sh
lua desk/src/xournal-plugins/tests/mesa-pagina.test.lua
lua desk/src/xournal-plugins/tests/mesa-converter.test.lua
lua desk/src/xournal-plugins/tests/mesa-ponte.test.lua
lua desk/src/xournal-plugins/tests/mesa-main.test.lua
```

O `npm test` da Mesa roda esses arquivos por `tests/xournal-lua.test.mjs`
(pulando com motivo quando não há Lua) e confere que o SVG do `converter.lua`
passa no `checkInkSvg` da ponte.

## Arquivos

- `plugin.ini` — descrição, versão e arquivo principal (no estilo dos
  plugins oficiais do Xournal++).
- `main.lua` — os itens de menu/atalho; lê o tamanho da página atual
  com `app.getDocumentStructure()` e aplica com `app.setPageSize()`;
  converte pela ponte (`io.popen` + `curl`, com o token em arquivo de header
  0600) e recria os textos com a fonte nova.
- `tamanho.lua` — a conta pura do crescimento (2 cm em pontos: `1 cm = 72/2.54 pt`).
- `converter.lua` — a lógica pura do converter (#159), sem chamar a API:
  monta o SVG da seleção, a caixa de texto e a troca de fonte (testado fora
  do Xournal++; ver `../tests/`).
- `ponte.lua` — o papo com a Mesa: parser JSON mínimo, pedido ao `curl`,
  respostas, runtime gravado e mensagens de motivo em pt-BR.
- `mesa-runtime.json` — no repo vem `{"runtime":""}` (sem caminho fixo); a
  Mesa grava a pasta do runtime na instalação para o plugin achar
  `ink-convert-bridge.json`.
