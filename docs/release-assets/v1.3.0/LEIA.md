# Assets da 1.3.0

Banner e capturas do README da release ponte (#21). Os dois READMEs apontam
para estes nomes; o banner entra no commit, as capturas do app são tiradas no
Mac do autor pelo script e entram no commit seguinte.

## Banner (commitado)

| Arquivo | Origem |
|---|---|
| `banner-readme-claro.png` / `banner-readme-escuro.png` | cópia das PNGs aprovadas `docs/design/marca/png/readme-claro.png` e `readme-escuro.png` (prancheta D: marca + lema + app) |
| `banner-readme-en-claro.png` / `banner-readme-en-escuro.png` | rasterizadas de `docs/design/marca/divulgacao.html?board=D-claro` / `D-escuro`, trocando o lema pela frase aprovada em inglês do mesmo HTML |

As quatro têm 2560×1280 (1280×640 em 2×). Para refazer:

```sh
cd desk
node_modules/.bin/electron ../docs/release-assets/v1.3.0/src/render-banner.cjs
```

No Linux sem tela, rode sob `xvfb-run -a -s "-screen 0 1920x1200x24"`.

## Capturas do app (não versionadas nesta branch)

O README aponta para estes nomes, que o `src/shoot-app.mjs` grava nesta pasta:

| Arquivo | Tela |
|---|---|
| `app-claro-pt.png` | janela principal, tema claro, interface em português |
| `app-escuro-pt.png` | janela principal, tema escuro, interface em português (acento violeta) |
| `app-claro-en.png` | janela principal, tema claro, interface em inglês |
| `app-escuro-en.png` | janela principal, tema escuro, interface em inglês (acento violeta) |

O script usa o harness dos testes de janela (`desk/tests/helpers.mjs`), o
`fake-opencode.mjs` e um runtime temporário. Os PDFs da captura são inventados
por `src/exercise-pdf.mjs` (uma lista de derivadas e um formulário), sem
nenhum material de curso. A janela é 1440×900 e o PNG sai na escala da tela
(1440×900 em 1×, 2880×1800 em 2×).

No Mac do autor, a partir da raiz do repositório, com `desk/node_modules`
instalado (`cd desk && npm ci`):

```sh
node docs/release-assets/v1.3.0/src/shoot-app.mjs
```

O padrão grava nesta pasta. Para uma prova fora do repositório:

```sh
node docs/release-assets/v1.3.0/src/shoot-app.mjs --out /caminho/fora/do/repo
```

`SUMMA_SHOTS_DIR` faz o mesmo que `--out`. O script não exige `DISPLAY`; no
Linux ele precisa de um X (por exemplo, `xvfb-run -a -s "-screen 0 1920x1200x24"`).

Depois de gerar as quatro capturas, confira que são do app atual e commite os
PNGs nesta pasta. A tela pequena do Debian não serve para a captura final: a
janela pedida é maior que ela, e o próprio app reaplica o tamanho de abertura.
