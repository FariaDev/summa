# #108: testes de janela no Windows

Ensaio de 2026-11-04 (run `41832721206`, runner `windows-latest`, código da
1.0.2): a Mesa atualiza e abre, mas `npm run ui` fechou com **15 ok, 81 com
falha, 0 pulados**. O log do job está no passo "Testes de janela"; este
documento separa o que era formato de fake do que pode ser defeito da Mesa e
propõe o job de CI.

## 1. Inventário dos motores falsos

`rg -n "LEARNING_DESK_[A-Z_]+" desk/tests` é a lista viva. O que importa para
o Windows:

| Fake | Variável | Testes | Como o app executa | Precisa de lançador? |
|---|---|---|---|---|
| `tests/fake-opencode.mjs` | `LEARNING_DESK_OPENCODE` | quase toda a suíte de janela (`helpers.mjs` é o padrão; `opencode-*`, `free-models`, `legacy-session`, `send-offline`, `tutor-states`, `stream-motion`, `i18n-en-leaks`, `pi-opcional`, `sidechat-ipc`, `pi-prompt-capture`, `study-ipc`, `performance-smoke`, `perf-probe`, `hunt-qol`, `menu-conferir`, `capture-auditoria` etc.) | `startOpenCodeServer` e `readOpenCodeVersionSync` usam `spawnPlan` (`desk/src/agents/opencode-process.cjs:350`, `opencode-version.cjs:55`): `.cmd`/`.bat` vão por `cmd.exe /d /s /c` (`desk/src/win-cmd-spawn.cjs`). | Sim. `.mjs` direto dá `spawn EFTYPE`; `.cmd` funciona sem mudar o app. |
| Wrappers `.mjs` gerados no runtime (`engine-gate.mjs`, `opencode-gate.mjs`, `opencode-gate.mjs` do stream) | `LEARNING_DESK_OPENCODE` | `send-offline-ui`, `tutor-states-ui`, `stream-motion-ui`, `i18n-en-leaks-ui`, `capture-auditoria-ui` | igual ao anterior (o wrapper só reenvia ao `fake-opencode.mjs`) | Sim; o wrapper também é `.mjs`. |
| `tests/fake-pi.mjs` | `LEARNING_DESK_PI` | só `sidechat-claude-ipc-smoke` (trap que delega a ele) | **Nenhum consumidor no app**: o motor Pi saiu (#50/#57). O `LEARNING_DESK_PI` não é lido fora dos testes; não há `spawn` do fake. | Não. É resíduo de contrato do teste, não origem de EFTYPE. |
| `tests/fake-opencode-install.cjs` | `LEARNING_DESK_OPENCODE_INSTALL_FIXTURE` | `opencode-install-ui`, `release-notes-ui` | `require()` em `opencode-install-host.cjs` (módulo, sem processo) | Não. |
| `tests/fake-secret-cipher.cjs` | `LEARNING_DESK_SECRET_CIPHER` | `free-models-ui`, `opencode-free-limit-ui` | `require()` no `main.cjs` (módulo) | Não. |
| `tests/fake-login-shell.mjs` | `LEARNING_DESK_OPENCODE_SHELL` | `opencode-install-ui` (cenário "bun") | `spawnSync(shell, ['-ilc', …])` em `opencode-shell.cjs`; `findOpenCodeInLoginShell` devolve `''` de propósito em `win32`. | Não é lançador de motor; o cenário é POSIX e foi pulado no Windows. |
| Guarda e traps do Claude (`.sh`) | `LEARNING_DESK_CLAUDE` | `tutor-header`, `switch-engine`, `pi-opcional`, `sidechat-claude`, e o runner `test:claude-ui` | `execFile(binário, ['--version'|'auth','status','--json'])` em `claude-environment.cjs` (sem `spawnPlan`). Com `LEARNING_DESK_CLAUDE_SDK_FACTORY` a detecção é pulada; os testes de detecção real (`claude-version-range-ui`) são POSIX/shell. | Fora do escopo do EFTYPE desta issue; converter os traps e o corredor do Claude fica para outra rodada. |
| `tests/fake-tool-binaries.mjs` | `LEARNING_DESK_TOOL_FAKE_BIN` | `tool-updates-ui` | `runTool` usa `shell: needsShell(file)`; o helper de teste `writeFakeExecutable` já cria `.cjs` + `.cmd` no Windows. | Já resolvido. |

O `testEnv` também monta um Claude de guarda em `~/.local/bin/claude` (script
POSIX). Ele existe só para a detecção achar um arquivo e recusar a versão
0.0.0; com o SDK sintético a detecção nem roda. Não é um motor executado.

## 2. O conserto do `spawn EFTYPE`

O `.cmd` funciona porque o caminho do OpenCode no app passa por
`spawnPlan`, inclusive na leitura de `--version`. O helper novo é
`fakeEngineLauncher(file)` (`tests/fake-executable.mjs`, reexportado por
`tests/helpers.mjs`):

- POSIX: devolve o próprio arquivo e garante o bit de execução — comportamento
  idêntico ao de antes.
- Windows: gera, uma vez por processo e num diretório temporário rastreado
  (`temp-dir.mjs`), um `fake-opencode-<hash>.cmd` com:

  ```bat
  @echo off
  "<process.execPath>" "<caminho absoluto do .mjs>" %*
  ```

  O nome leva um hash do caminho para dois fakes de mesmo basename em runtimes
  diferentes não se sobrescreverem. `.exe`/`.cmd`/`.bat` voltam como estão.

Nenhum código de produção mudou. `deskEnv` passou a usar o helper por padrão, e
cada teste que define `FAKE_OPENCODE_BIN`/`LEARNING_DESK_OPENCODE` na mão
também. O teste unitário `tests/fake-engine-launcher.test.mjs` simula
`platform: 'win32'` e confere o caminho e o conteúdo do `.cmd`.

## 3. As cinco falhas fora do EFTYPE

### 3.1 `opencode-install-ui`: "o comando de login mostra o caminho completo…"

Actual do run: `D:\…\home\.opencode\bin\opencode.exe auth login`; a asserção
esperava `/opencode/<versão>/bin/opencode auth login` com barras POSIX.
`loginBinary` (`src/setup-view.mjs`) acrescenta `.exe` no `win32` e usa o
separador nativo. **É teste, não app.** O teste agora monta o caminho com
`path.join` e aplica a mesma `loginBinary` do app; no Windows ele aceita
`\` e `.exe`, no POSIX continua igual. O cenário "instalado por bun" usa shell
de login, que o app declara POSIX (`findOpenCodeInLoginShell` devolve `''` em
`win32`); ele foi pulado com uma linha no log.

### 3.2 `legacy-session-ui`: "a sessão nova é OpenCode"

Actual:
`D:\…\conversations\opencode-….json`; a regex pedia
`conversations/opencode-….json`. O caminho é nativo do Windows e o app está
certo. **É teste.** A regex agora aceita `[\\/]` nos dois lados (também na
continuação, `Continuar cria a sessão OpenCode`).

### 3.3 `free-study-ui`: "em 1440 os três botões ficam na mesma linha"

Actual: `2 !== 1` (dois `top`s distintos — a linha quebrou). O teste **nunca
redimensiona**; ele confia no tamanho de abertura. `placeWindow` (`desk/lib.cjs`)
limita a janela ao `workArea` da tela: num runner Windows com área de trabalho
menor, a janela abre abaixo de 1440, o vazio fica estreito e o `flex-wrap`
quebra. A fonte do Windows (Segoe UI, métricas diferentes) diminui a folga,
mas o gatilho é a largura. **É teste.** No Windows o teste agora fixa
`1440×900` com `resizeWindow` logo depois de abrir, como os outros testes de
layout; no POSIX nada muda.

### 3.4 `pdf-rotation`: "âncora: página 2 continua atual depois de girar"

O check que falhou no run foi o de `pdf-rotation.mjs`, depois de rolar até a
página 2 e girar 90°. Hipótese concreta: com a página 1 em rotação nativa 90°
(paisagem) e a 2 em retrato, girar deixa a 1 retrato (mais alta) e a 2
paisagem (mais baixa). O `render` salva/reaplica `scrollTop` e reancora a
página atual; quando o documento girado fica mais baixo que o viewport, o
navegador limita `scrollTop`, o centro cai na página 1 e `updateCurrentPage`
troca a página. No Windows a geometria do run (caixas 279×488 e 279×159)
expôs isso. Não é separador de caminho nem `\r\n`: é comportamento de
reancoragem em viewport maior que o documento girado — **provável defeito real
da Mesa**, que precisa de um ticket próprio e de uma sonda no Windows antes de
mexer. Não foi alterado aqui.

### 3.5 `pi-prompt-capture-ipc-smoke`: "prompt aceito…"

O arquivo **continua existindo** e usa o `fake-opencode.mjs` como motor. O log
mostra `{"sent":false,…,"reason":"spawn EFTYPE"}`: é a mesma causa das outras,
não um defeito do Pi nem do contrato. Com o lançador, a primeira checagem deve
passar; o resto do smoke continua igual.

## 4. Proposta de CI (sem editar `.github/`)

O `ensaio-windows.yml` serve para a release publicada, não para o dia a dia.
A cobertura deve morar no `test.yml`, num job separado do `unit`:

```yaml
  ui-windows:
    name: janelas (windows-latest)
    runs-on: windows-latest
    timeout-minutes: 60
    defaults:
      run:
        working-directory: desk
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22.19.0'
          cache: npm
          cache-dependency-path: desk/package-lock.json
      - run: npm ci
      - run: node node_modules/electron/install.js
      - run: npm run ui
```

Por quê:

- Job separado: uma falha de janela não esconde a suíte de unidade (que hoje
  já roda no Windows) e o `timeout` de 60 min fica explícito.
- `npm run ui` já tem o corredor com prazo e limpeza de processos; não precisa
  de `xvfb` no Windows nem de `MESA_GATE_CACHE` (o cache é só do `npm test`).
- O `ensaio-windows.yml` pode ganhar, depois que o job acima estiver verde, um
  passo `cd "$DESK" && npm run ui` antes do "Abrir a Mesa"; mas ele testa a
  versão publicada, então o sinal útil é o job de PR.
- Enquanto o item 3.4 não for resolvido, o job vai falhar em `pdf-rotation`.
  A proposta é entrar com `npm run ui -- ...` (subconjunto) e ir ampliando; ou
  marcar o `pdf-rotation` como falha conhecida até o ticket da âncora.
- O corredor do Claude (`npm run test:claude-ui`) fica fora deste job: os
  traps são scripts POSIX e a detecção real usa `execFile`, sem `spawnPlan`.

## 5. Provas locais (Linux)

- `node --test tests/fake-engine-launcher.test.mjs`: `ℹ tests 3`, `ℹ pass 3`,
  `ℹ fail 0`.
- Um arquivo por vez (todos com `DISPLAY=:0 nice -n 10`): `legacy-session-ui:
  ok`; `free-study-ui: fluxo completo da aba Livre passou`; `ok
  opencode-install-ui`; `SMOKE_OK` no `pi-prompt-capture-ipc-smoke`; `ok
  opencode-ui`; `SEND OFFLINE PASSED`; `ok pi-opcional-ui`; `PDF ROTATION: 0
  falha(s)`.
- Rodada cheia no fim: `DISPLAY=:0 MESA_GATE_CACHE=0 nice -n 10 npm test` →
  `ℹ tests 3098`, `ℹ pass 3094`, `ℹ fail 0`, `ℹ skipped 4` (os 4 pulos são os
  de sempre do toolchain/backup, sem relação com esta issue).
