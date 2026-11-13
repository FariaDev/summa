# Cadernos: o que saiu para o Xournal++

Quatro partes deixaram a Summa para um Xournal++ modificado. O código está
preservado na tag `cadernos-antes-do-xournal` (commit `5a98aa2c`). Continua na
Summa a ferramenta `ler_caderno` do tutor e o Caderno de revisão.

| Parte | O que fazia | Arquivos | Testes |
|---|---|---|---|
| Biblioteca de cadernos | Listava os `.xopp` de cada matéria, abria no Xournal++ e mostrava o formato da página | `desk/notebooks-host.cjs`, `desk/notebook-page-format.cjs`, `desk/src/notebooks.mjs`, `desk/src/notebooks-format.mjs`, `desk/src/notebooks-desk.mjs`, `desk/src/notebooks-boot.mjs` | `notebooks-open`, `notebooks-ui`, `notebooks-boot`, `notebooks-list`, `notebooks-list-format`, `notebooks-view`, `notebooks-containment`, `notebook-page-format` |
| Busca nos cadernos | Buscava no texto digitado e no LaTeX das páginas, sem modelo e sem rede | `desk/notebooks-search-host.cjs` | `notebooks-search`, `notebooks-search-ui`, `notebooks-search-rodada4-ui` |
| Índice/modelo de escrita à mão | Lia a tinta por opt-in com modelo de visão, em segundo plano, e alimentava a busca | `desk/notebook-ink-watch.cjs`, `desk/notebook-ink-index.cjs`, `desk/notebook-ink-model.cjs`, `desk/notebook-ink-wiring.cjs`, `desk/src/agents/notebook-ink-bridge.cjs`, `desk/src/notebooks-ink-panel.mjs` | `notebook-ink-*`, `notebooks-ink-ui`; fakes `fake-ink*` |
| Plugin Lua MesaPagina e conversão de tinta | Instalava o plugin e servia a ponte local de conversão em texto | `desk/xournal-plugin-host.cjs`, `desk/ink-convert-host.cjs`, `desk/ink-convert-svg.cjs`, `desk/ink-bridge-lifecycle.cjs`, `desk/src/xournal-plugins/` | `xournal-plugin`, `xournal-plugin-ui`, `ink-convert-host`, `ink-convert-ui`, `ink-quit-bridge`, `xournal-lua`, `notebooks-plugin-estados-ui`, `notebooks-plugin-ui`, `ipc-sender`; fake `fake-failing-fs.mjs`, fixture `mesa-pagina-ink.svg` |

As capturas `tests/capture-ciclo2-cadernos*.mjs` e
`tests/capture-ciclo2-xournal*.mjs` também saíram.

## Recuperar

Ver um arquivo como era:

```sh
git show cadernos-antes-do-xournal:desk/src/notebooks.mjs
```

Trazer um arquivo ou pasta de volta:

```sh
git checkout cadernos-antes-do-xournal -- desk/src/notebooks.mjs
git checkout cadernos-antes-do-xournal -- desk/src/xournal-plugins
```

O código recuperado depende dos canais IPC, chaves de catálogo e leis Bend
removidos no mesmo commit; confira o diff do commit que tirou os cadernos da
Summa antes de religar qualquer parte.

## Resultado da #134

Nenhum modelo local lê bem escrita à mão hoje:

- Pix2Text MFR-1.5 INT8 (32 MB): 3–5 acertos exatos em 100 equações do
  MathWriting;
- modelo treinado no MathWriting: 3/4, mas 371 MB e sem licença;
- modelo de visão grátis do Zen: 4/38, 44 s por equação;
- sem rede neural, só símbolo isolado.
