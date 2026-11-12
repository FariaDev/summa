# Cópia própria do OpenCode 2.x — medição e proposta (#94)

Pesquisa de 2026-11-08 para a decisão de 2026-11-07. Nada aqui altera código de
produção; os números foram medidos nos pacotes publicados e conferidos no
binário extraído.

## Recomendação

1. **Baixar no primeiro uso, não embutir no pacote.** É o que a Mesa já faz; o
   que muda é o destino: `desk/.runtime/opencode/<versão>/`, fora de
   `~/.opencode`. O download é de 101–116 MiB por plataforma e vira 216–247 MiB
   instalado; embutir estouraria o teto de 64 MiB do zip do updater e exigiria
   assinar/notarizar um binário aninhado no macOS.
2. **Isolar `XDG_*`, não o `HOME`.** A cópia própria usa
   `XDG_DATA_HOME`/`XDG_CONFIG_HOME`/`XDG_CACHE_HOME`/`XDG_STATE_HOME` dentro de
   `.runtime/opencode/<versão>/`, mas mantém o `HOME` real. Antes do primeiro
   `serve`, copiar **somente para leitura** o `auth.json` da pessoa para o data
   dir próprio; o migrador do 2.x importa as credenciais para o banco dele. A
   cópia da Mesa nunca escreve no OpenCode da pessoa. Quem não tiver
   `auth.json` entra pelo login por provedor que a Mesa já oferece.
3. **Fixar a versão em `desk/src/tested-versions.json`** (`"opencode":
   "2.2.4"`) e trocar o hunt versionado por um hunt da versão fixa, que lê a
   tabela. Hoje a última 2.x publicada é a **2.2.6** (2026-11-06).

## 1. Tamanho

Medição do pacote que a Mesa usa hoje (`@opencode/cli-*@2.2.4`, o mesmo que o
instalador da Mesa baixa) e do asset oficial da release `v2.2.4`
(`github.com/anomalyco/opencode`). "Instalado" é o pacote npm descomprimido; o
asset oficial carrega o mesmo binário, só muda o empacotamento.

| Plataforma | Pacote npm | Tarball npm (comprimido) | Asset oficial `v2.2.4` | Asset oficial (comprimido) | Instalado (pacote) |
| --- | --- | --- | --- | --- | --- |
| macOS arm64 | `@opencode/cli-darwin-arm64` | 105.806.373 B (100,9 MiB) | `opencode-darwin-arm64.zip` | 105.850.647 B (100,9 MiB) | 226.670.417 B (216,2 MiB) |
| macOS x64 | `@opencode/cli-darwin-x64` | 111.040.306 B (105,9 MiB) | `opencode-darwin-x64.zip` | 111.083.511 B (105,9 MiB) | 240.601.037 B (229,5 MiB) |
| Windows x64 | `@opencode/cli-windows-x64` | 121.993.790 B (116,3 MiB) | `opencode-windows-x64.zip` | 121.956.018 B (116,3 MiB) | 259.155.061 B (247,1 MiB) |
| Linux x64 | `@opencode/cli-linux-x64` | 118.634.475 B (113,1 MiB) | `opencode-linux-x64.tar.gz` | 119.193.657 B (113,7 MiB) | 252.696.987 B (241,0 MiB) |

O binário em si ocupa quase tudo: 226.670.176 B (macOS arm64), 240.600.800 B
(macOS x64), 259.154.824 B (Windows x64) e 252.696.752 B (Linux x64). O pacote
npm tem só o binário e um `package.json` (o tarball **não** traz `LICENSE`).

Variantes que o instalador escolhe sozinho: `-baseline` quando o x64 não tem
AVX2 e `-musl` no Linux com musl. Elas ficam na mesma faixa (por exemplo
`linux-x64-musl`: 251.561.624 B instalado; asset oficial de 117.803.758 B).
A release mais nova, 2.2.6, tem assets cerca de 2–3 MB maiores.

O pacote `opencode-ai` no npm continua na 1.19.5; a linha 2.x mora em
`@opencode/cli` (o metapacote tem 8.175 B e declara os pacotes por plataforma
como `optionalDependencies`). `npm view opencode-ai@2.2.4` responde 404 — o
instalador da Mesa já usa `@opencode/cli-<alvo>` e o nome legado
`@opencode-ai/cli-<alvo>`.

## 2. Licença

O repositório oficial é `github.com/anomalyco/opencode` (apontado pelo
`repository` dos pacotes npm). Na tag `v2.2.4`, o arquivo `LICENSE` tem 1.065 B
e SPDX **MIT**; o texto é o MIT padrão com `Copyright (c) 2025 opencode`.

O que a MIT exige para redistribuir:

- incluir o aviso de copyright e a permissão em "todas as cópias ou porções
  substanciais do Software";
- manter a isenção de garantia.

Se a Mesa apenas **baixa** o binário na máquina da pessoa, quem recebe a cópia
é a própria pessoa e a Mesa não está redistribuindo. Ainda assim, é barato e
correto gravar uma cópia do `LICENSE` ao lado do binário em
`.runtime/opencode/<versão>/` e mostrar o aviso em Sobre/licenças. Se a Mesa
**embutir** o binário no pacote, ela passa a redistribuir e precisa incluir o
texto do MIT no app (o tarball npm não o traz, então a Mesa teria de fornecer).
O binário compilado também contém dependências de terceiros; para embutir,
convém revisar os avisos dessas dependências.

## 3. Como a Mesa instala hoje e onde a cópia própria moraria

Hoje (`desk/src/agents/opencode-install.cjs`):

- `PINNED_VERSION = '2.2.4'` (linha 27);
- baixa do registro npm o pacote `@opencode/cli-<alvo>` (ou o legado
  `@opencode-ai/cli-<alvo>`), com alvo `linux-x64`, `darwin-arm64`,
  `windows-x64` etc. (linhas 96–98);
- confere o **SRI** `sha512` publicado em `dist.integrity` (linhas 111–135 e
  143–182); não confere a atestação/proveniência do npm;
- extrai com o `tar` do sistema e copia o binário para
  `~/.opencode/bin/opencode` (Windows: `%USERPROFILE%\.opencode\bin\opencode.exe`),
  com troca atômica e um atalho `opencode2` (linhas 225–271);
- confere `opencode --version` depois de instalar (linhas 390–428).

Quem chama é `desk/opencode-install-host.cjs` (`opencode-install` via IPC), na
primeira abertura. A detecção do executável (`candidatePaths`, em
`desk/src/agents/opencode-process.cjs:56`) procura `LEARNING_DESK_OPENCODE`,
o caminho configurado, `~/.opencode/bin/opencode`, `~/.local/bin/opencode`,
Homebrew e o shell de login.

O problema da #94 está no destino: `~/.opencode/bin` é o caminho do OpenCode da
pessoa. O instalador da Mesa **sobrescreve** esse binário. A cópia própria
deve morar no runtime, que não é versionado (`desk/.gitignore` tem `.runtime/`)
e que o updater nunca toca (`SKIP_TREE` em `desk/updater-core.cjs:25` e
`isProtected` em `desk/updater-files.cjs:34`).

Proposta de layout, usando o `runtime` que já é passado aos hosts (não
hardcodar `desk/.runtime`, porque `runtimePath` é configurável em
`config.json`):

```
<runtime>/opencode/<versão>/
  bin/opencode            # binário verificado (no Windows, opencode.exe)
  data/                   # XDG_DATA_HOME/opencode (banco, auth.json importado, log)
  config/                 # OPENCODE_CONFIG_DIR (config da Mesa + sanitizado da pessoa)
  cache/                  # XDG_CACHE_HOME/opencode
  state/                  # XDG_STATE_HOME/opencode
  LICENSE-opencode        # aviso MIT (não vem no tarball npm)
```

A instalação baixa e verifica num diretório temporário e renomeia a pasta da
versão de uma vez; a versão antiga só é apagada depois que nenhum `serve` a
estiver usando. A detecção deve preferir a cópia própria e só cair no OpenCode
da pessoa se ela não existir. O comando de login mostrado ao aluno
(`setup-view.mjs`) passa a apontar o binário do runtime, não `~/.opencode`.

Custo em disco: ~216–247 MiB por plataforma em `.runtime`, mais o temporário
do download durante a instalação.

## 4. Login, chave e histórico

### Onde o OpenCode 2.x guarda cada coisa

Fonte: `packages/util/src/global-roots.ts` e `packages/util/src/global.ts` na
tag `v2.2.4`.

| Uso | Variável | Padrão sem a variável |
| --- | --- | --- |
| Dados (banco, auth legado, log, repos) | `XDG_DATA_HOME` | `~/.local/share/opencode` |
| Config global | `XDG_CONFIG_HOME` (ou `OPENCODE_CONFIG_DIR`) | `~/.config/opencode` |
| Cache (inclusive `bin/`) | `XDG_CACHE_HOME` | `~/.cache/opencode` |
| Estado | `XDG_STATE_HOME` | `~/.local/state/opencode` |
| Temporário | `TMPDIR`/`TEMP` | `<tmp do sistema>/opencode` |
| Home usada pelo binário | `OPENCODE_TEST_HOME` (gancho de teste) | `os.homedir()` |

No Windows, os caminhos seguem o mesmo `os.homedir()` para os dados; a config
global medida pela Mesa no 2.2.4 é `%APPDATA%\opencode`
(`opencode-personal-config.cjs:59–69`).

O banco do 2.x é `opencode.db` dentro do data dir
(`packages/cli/src/database-path.ts`). As credenciais ficam na tabela
`credential` desse banco. O `auth.json` é legado: a migração
`20260805200742_import_legacy_credentials.ts` lê `<data>/auth.json` na
primeira criação do banco e importa cada provedor para a tabela. Depois disso
o `auth.json` não é mais a fonte.
O `v1-migration` do binário (`v1-migration.bun.ts`) trata do
`opencode-next.db` de betas anteriores; não encontramos migração de sessões v1
em arquivos JSON nessa tag.

### O que a Mesa faz hoje

O `serve` da Mesa **não isola** `HOME` nem `XDG_*`: ele herda o ambiente e só
troca o config (`desk/src/agents/opencode-serve-config.cjs:96–130`):

- `OPENCODE_CONFIG_DIR` aponta para `<runtime>/opencode-config` (config da
  Mesa);
- `OPENCODE_CONFIG_CONTENT` leva o mesmo JSON quando a gravação falha;
- `OPENCODE_DISABLE_PROJECT_CONFIG=1` e `OPENCODE_DISABLE_CLAUDE_CODE=1`;
- o config pessoal é lido, sanitizado e mesclado por
  `opencode-personal-config.cjs`;
- a chave do Zen da Mesa vai como `OPENCODE_API_KEY` (cofre próprio, nunca no
  `auth.json`).

Ou seja: hoje o `opencode serve` lê e escreve no data dir da pessoa. O
`opencode-host.cjs:47–50` lê `auth.json` só no clique "usar esta chave", e o
login por provedor usa a API do próprio `serve`
(`opencode-providers-host.cjs:4–22`), que grava no banco compartilhado.

### Uma cópia isolada perde o login?

**Sim, se isolarmos o data dir sem mais nada.** O 2.x cria um banco novo; o
login que a pessoa fez no OpenCode dela (ou o login que a Mesa fez no data dir
compartilhado) não aparece. Sessões `ses_` antigas da Mesa também deixam de
resolver; o descritor da conversa ainda mostra as mensagens em cache, mas o
`serve` responde sessão ausente e a conversa teria de começar outra sessão
nativa.

**Opção recomendada (mantém o login sem tocar no OpenCode da pessoa):**

1. manter o `HOME` real (para PATH, `claude-agent` e o config pessoal);
2. apontar `XDG_DATA_HOME`, `XDG_CONFIG_HOME`, `XDG_CACHE_HOME` e
   `XDG_STATE_HOME` para `.runtime/opencode/<versão>/...`;
3. **antes do primeiro `serve`**, ler o `auth.json` da pessoa em
   `<data pessoal>/opencode/auth.json` (o mesmo caminho de
   `opencode-host.cjs:authFilePath`, respeitando o `XDG_DATA_HOME` pessoal) e
   copiá-lo para `<runtime>/opencode/<versão>/data/opencode/auth.json`, com
   permissão `0600`, sem logar o conteúdo e sem incluí-lo em backup;
4. o migrador do 2.x importa as credenciais para o banco próprio na primeira
   subida. A partir daí, o login vive no banco da Mesa;
5. a cópia da Mesa nunca escreve no `auth.json` nem no banco da pessoa.

Se a pessoa já usa OpenCode 2.x e o `auth.json` não existir mais (credenciais
só no banco dela), não dá para importar sem ler o segredo do banco alheio.
Nesse caso, o login por provedor da Mesa (já implementado) é o caminho: a
pessoa entra uma vez na cópia da Mesa. A chave do Zen continua vindo do cofre
da Mesa por `OPENCODE_API_KEY`, independente do data dir.

Cuidados: validar o JSON antes de copiar (um `auth.json` corrompido faria a
migração falhar), copiar depois de criar o data dir e antes de qualquer
execução do binário, e não usar o `XDG_DATA_HOME` do filho para localizar o
arquivo pessoal — capturar o caminho pessoal do ambiente original.

**Alternativa mais simples, não recomendada:** deixar o data dir compartilhado
(só isolar binário e config). Mantém login e histórico sem trabalho, mas o 2.x
passa a criar `opencode.db` e a migrar dados no diretório da pessoa, e as
sessões da Mesa aparecem no histórico dela. Isso contraria o "sem tocar no
OpenCode dela"; serve só como plano B se a importação do `auth.json` for
recusada.

## 5. Atualização e teste da versão fixa

Estado atual (2026-11-08):

- a Mesa fixa **2.2.4** (`PINNED_VERSION` e `desk/SETUP.md:11`);
- o GitHub publicou `v2.2.4` em 2026-10-30T16:59:08Z, `v2.2.5` em
  2026-10-30T23:17:23Z e **`v2.2.6` em 2026-11-06T23:37:20Z**;
- no npm, `@opencode/cli` está com `latest` = 2.2.6;
- o hunt real é `desk/tests/hunt-opencode-2.2.4.mjs` (pula sem
  `LEARNING_DESK_OPENCODE` apontando um binário 2.x);
- `desk/tests/hunt-opencode-1.19.5.mjs` prova a recusa da 1.x e não usa o
  mesmo ambiente.

Proposta:

- `desk/src/tested-versions.json` ganha `"opencode": "2.2.4"` (a versão fixa,
  não uma faixa: a API v2 do `serve` muda com o binário). O instalador passa a
  ler a tabela em vez de ter a constante duplicada; o teste
  `opencode-install.test.mjs:94` e as frases de UI que citam "2.2.4" passam a
  usar o valor da tabela.
- `hunt-opencode-2.2.4.mjs` vira `hunt-opencode-2.x.mjs` (ou
  `hunt-opencode-versao-fixa.mjs`), lê a versão esperada da tabela, exige
  `opencode --version` igual e continua provando o comportamento (config,
  permissões, MCP, cartões). O nome fixo não precisa ser renomeado a cada
  subida. `hunt-opencode-1.19.5.mjs` fica como prova de recusa.
- Subida de versão: baixar o pacote da plataforma para um temporário **novo**,
  extrair, rodar
  `LEARNING_DESK_OPENCODE=<tmp>/package/bin/opencode npm run hunts -- opencode`,
  depois `MESA_GATE_CACHE=0 npm test` e `npm run ui -- opencode`; atualizar a
  tabela, o `PINNED_VERSION` derivado e as frases/documentos; commitar os
  artefatos gerados se houver.

## 6. Baixar no setup ou embutir no pacote

| Critério | Baixar no primeiro uso | Embutir no pacote |
| --- | --- | --- |
| Tamanho do app | não muda | +101–116 MiB comprimido por plataforma; +216–247 MiB descomprimido |
| Primeiro uso | precisa de rede e de ~101–116 MiB de download; mostrar tamanho, progresso, prazo e repetir | funciona offline |
| Updater | a cópia em `.runtime` é ignorada (`SKIP_TREE`); sobrevive às atualizações da Mesa e sobe de versão quando a Mesa quiser | o zip da Mesa tem 13.765.574 B (13,1 MiB) e o updater recusa zip acima de 64 MiB (`updater-signature.cjs:22`); embutir estoura o teto e obriga a mudar o updater |
| macOS | binário separado, fora da assinatura/notarização do `.app`; o download do Node não põe o xattr de quarentena, então o Gatekeeper não o trata como download de navegador | binário aninhado precisa ser assinado e notarizado junto com o app; reassinar a cada release |
| Atualização do OpenCode | independente da release da Mesa; basta o instalador fixar outra versão | exige release da Mesa para cada patch do OpenCode |
| Repositório git | nenhum binário versionado | binário não pode ir para o git; teria de ser asset de release |
| Falha/offline | precisa de plano B (retry, espelho, instrução) | sempre disponível |

Recomendação: **baixar**, como hoje, mas para `.runtime/opencode/<versão>/`,
com SRI, versão fixa, progresso e retry. O updater por zip/git continua
pequeno e só roda `npm ci` quando o lockfile muda
(`desk/updater.cjs:218 e 268–269`); a cópia do OpenCode não entra no zip
assinado nem no `git merge`. Se um dia a Mesa precisar funcionar sem rede no
primeiro uso, o caminho é um asset opcional da release (baixado pelo mesmo
instalador), não o binário dentro do zip do updater.

## 7. Fontes e comandos

Medições (executadas em 2026-11-08, em `/tmp/opencode/oc94-*`, apagado no
fim; nenhum OpenCode foi executado com o HOME real):

```sh
# versão fixa atual e repo oficial
rg -n "2\.2\.[0-9]" desk/src/agents desk/tests | head
cat desk/src/tested-versions.json
npm view @opencode/cli@2.2.4 --json | head

# metadados dos pacotes por plataforma (tamanho descomprimido e integridade)
for p in darwin-arm64 darwin-x64 windows-x64 linux-x64; do
  npm view @opencode/cli-$p@2.2.4 dist --json
done

# tamanhos reais dos tarballs e do binário extraído
D=$(mktemp -d /tmp/opencode/oc94-XXXXXX)
for p in darwin-arm64 darwin-x64 windows-x64 linux-x64; do
  curl -fsSL -o "$D/$p.tgz" \
    "https://registry.npmjs.org/@opencode/cli-$p/-/cli-$p-2.2.4.tgz"
  stat -c%s "$D/$p.tgz"
  mkdir "$D/x-$p"; tar -xzf "$D/$p.tgz" -C "$D/x-$p"
  du -sb "$D/x-$p"; find "$D/x-$p" -type f -printf '%s %P\n' | sort -rn | head
  rm -rf "$D/x-$p" "$D/$p.tgz"
done
rm -rf "$D"

# assets oficiais da release e última 2.x
gh release view v2.2.4 -R anomalyco/opencode --json tagName,publishedAt,assets
gh release list -R anomalyco/opencode --limit 12
gh release view v2.2.6 -R anomalyco/opencode --json tagName,publishedAt,assets

# licença na tag
gh api "repos/anomalyco/opencode/license?ref=v2.2.4" \
  --jq '{name:.name,path:.path,spdx:.license.spdx_id,size:.size}'
curl -fsSL https://raw.githubusercontent.com/anomalyco/opencode/v2.2.4/LICENSE
```

Fontes do OpenCode 2.2.4:

- `packages/util/src/global-roots.ts` e `packages/util/src/global.ts` — pastas
  XDG e `OPENCODE_CONFIG_DIR`;
- `packages/cli/src/database-path.ts` — `opencode.db` no data dir;
- `packages/core/src/database/migration/20260805200742_import_legacy_credentials.ts`
  — importação do `auth.json` legado;
- `packages/core/src/database/v1-migration.bun.ts` — migração do
  `opencode-next.db`;
- `packages/cli/src/commands/handlers/auth/import.ts` — `auth import` usa o
  formato de exportação e um servidor vivo, não o `auth.json` legado.

Fontes da Mesa:

- `desk/src/agents/opencode-install.cjs`, `desk/opencode-install-host.cjs`;
- `desk/src/agents/opencode-process.cjs` (detecção), `desk/src/agents/opencode-serve-config.cjs`
  (ambiente do `serve`);
- `desk/opencode-host.cjs` (`authFilePath`), `desk/opencode-providers-host.cjs`
  (login por provedor), `desk/src/agents/opencode-personal-config.cjs`;
- `desk/updater-core.cjs`, `desk/updater-files.cjs`, `desk/updater-signature.cjs`;
- `desk/src/tested-versions.json`, `desk/tests/hunt-opencode-2.2.4.mjs`,
  `desk/tests/hunt-opencode-1.19.5.mjs`, `desk/SETUP.md`.

## Implementado (passo 1)

Em 2026-11-09, só o passo 1 da recomendação. O `HOME`, os `XDG_*` e as pastas
de dados/login continuam como estavam: a Mesa não isola dados nem importa
`auth.json` ainda. As sessões e o login existentes continuam onde estão.

- **Destino:** `<runtime>/opencode/<versão>/bin/opencode` (no Windows,
  `opencode.exe`), com a versão fixa em `desk/src/tested-versions.json`
  (`"opencode": "2.2.4"`). O `runtime` é o mesmo que o app já passa aos hosts
  (`config.runtimePath` ou `LEARNING_DESK_RUNTIME`), não um caminho fixo:
  `src/agents/opencode-binary.cjs` é a fonte única.
- **Instalador:** `installOpenCode` recebe `runtime` e grava só ali. A troca
  atômica e a conferência de `--version` continuam; `PINNED_VERSION` lê a
  tabela. Nada em `~/.opencode` é criado, apagado ou movido, e o binário que a
  pessoa já tinha lá continua intacto.
- **Detecção/serve:** `findOpenCodeLauncher`/`candidatePaths` aceitam `runtime`
  e põem a cópia da Mesa depois de `LEARNING_DESK_OPENCODE` e de
  `opencodePath` (que seguem vencendo) e antes de `~/.opencode/bin`,
  `~/.local/bin`, Homebrew e o shell de login. `opencode-tutor-host` usa o
  mesmo resolvedor, então o `serve` sobe o binário do runtime; o doctor detecta
  a cópia com o `runtime` do contexto.
- **Mensagens:** a confirmação de atualização do OpenCode 1.x agora diz que a
  Mesa instala a própria cópia e não altera a do aluno; o log de binário não
  encontrado cita a cópia do runtime, sem caminho pessoal.
- **Licença:** comentário no instalador e no resolvedor registra que o OpenCode
  é MIT (`github.com/anomalyco/opencode`) e que a Mesa baixa na máquina da
  pessoa, sem redistribuir.

Provas em `desk/tests/`: instalação em `.runtime/opencode/2.2.4` com um
`~/.opencode` falso (hash antes/depois), versão vinda da tabela, `serve`
resolvendo a cópia do runtime e `opencodePath` vencendo. O hunt versionado não
foi tocado (continua aceitando qualquer 2.x).

Pendências fora deste passo (anotadas, não corrigidas): isolar
`XDG_*`/importar `auth.json` (passo 2); `triage-report.mjs` ainda procura o
binário sem o `runtime`; `desk/SETUP.md` ainda descreve o destino antigo
`~/.opencode/bin`.
