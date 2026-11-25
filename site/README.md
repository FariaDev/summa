# Site da Summa

Página estática em PT (raiz) e EN (`en/`), publicada no GitHub Pages pelo
workflow `.github/workflows/site.yml` a cada Release e a cada mudança em `site/`
na `main`. Endereço: https://fariadev.github.io/summa/

## Montar e testar

```sh
node site/build.mjs --offline        # sem rede; downloads vão à página de Releases
node site/build.mjs                  # com as Releases da API (GITHUB_TOKEN opcional)
node --test site/test/*.test.mjs     # build, downloads e calculadora
node site/test/demo-ui.mjs           # demo no Chromium, PT e EN (Playwright do desk/)
```

Para olhar no navegador, sirva `site/dist` (módulos ES não carregam de `file://`),
por exemplo `npx serve site/dist`.

## Onde mexer

- Textos da página: `src/strings/pt.json` e `en.json` (mesmas chaves; chave que falta quebra o build).
- Textos e roteiro da demo: `src/assets/js/content-pt.js` e `content-en.js`.
- Estrutura: `src/page.html`. Estilo: `src/assets/style.css`, com os tokens do `desk/style.css`.
- Downloads: `lib/downloads.mjs` procura `Summa-X.Y.Z.dmg`, `Summa-Setup-X.Y.Z.exe` e
  `Summa-X.Y.Z-x86_64.AppImage` na Release mais nova que tiver cada um
  (nomes do `docs/agents/release.md`). Sem nenhum, o botão leva à página de Releases.
- Conectar (`connect.*` nos strings) repete o login do app: `releaseNotes.login.*` e
  `opencodeProviders.*` em `desk/src/locales/`. Mudou o fluxo lá, mude aqui.
- Celular e tablet não recebem instalador: `src/assets/js/os.js` dá `mobile` e
  `handoff.js` troca os botões de baixar por "Mandar para o computador".
- O protótipo que deu origem fica em `docs/design/site/r4.html` (histórico).
