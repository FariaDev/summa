# 5. Instalador Windows por usuário, sem ferramenta de empacotamento

**Status:** decidida em 2026-11-12 (#181), com a recomendação aceita pelo autor
no comentário da issue ("siga suas recomendações"). A prova na VM Windows
(instalar, abrir, atualizar e desinstalar em conta limpa) fica para depois da
integração e segue o roteiro do ticket.

## Contexto

No Windows a Mesa rodava por `npm start` (ou um atalho para ele), sem
instalador. As consequências apareceram em três frentes:

- **#178:** sem atalho próprio, o menu Iniciar e as notificações mostravam o
  ícone do Electron. O `windows-shortcut.cjs` já cria o atalho com o
  `AppUserModelId` da Mesa na abertura, mas ele só existe depois de o app rodar
  uma vez — e não há entrada de desinstalação.
- **#160:** o updater por clique recusava atualizações de um clone sujo e
  deixava a instalação sem uma identidade de "app instalado"; sem um lugar
  canônico para o payload, o update não sabia o que reabrir.
- **#129:** quem não é programador precisava de Node, npm e terminal para
  instalar.
- **#103:** o Electron do app instalado precisa acompanhar a versão pedida,
  como no `.app` do macOS.

O macOS já tem o `npm run install-app`: monta o `Summa.app`, mantém o
Electron na versão de `node_modules`, registra a procedência e o manifesto do
updater, e o updater assinado troca só o payload. A escolha aqui é não criar um
segundo mecanismo de instalação/atualização para o Windows.

## Decisão

O `npm run install-app` ganha um ramo Windows que espelha o `.app`:

1. **Cópia sem admin, sem PATH.** O Electron de `node_modules/electron/dist` e
   o payload vão para `%LOCALAPPDATA%\Programs\Summa`. O payload é o
   mesmo `stageBundlePayload` do `.app` (mesma lista de arquivos, dependências
   de runtime, `install-source.json` e `.update-manifest.json`), agora em
   `resources\app`, que é onde o `electron.exe` procura o app. Nada de NSIS,
   Squirrel ou electron-builder.
2. **Menu Iniciar via PowerShell.** O atalho `.lnk` em
   `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Summa.lnk` é
   criado com `WScript.Shell` (alvo, pasta de trabalho e o ícone
   `assets\mesa.ico` do payload) e recebe o `AppUserModelId`
   `br.com.fariadev.mesa-de-estudos` pelo `IPropertyStore`
   (`System.AppUserModel.ID`). O `WScript.Shell` não expõe o AUMID, e o
   interop C# inline é o menor caminho para gravar a propriedade sem trocar
   todo o atalho por `IShellLink`. O `main.cjs` já usa o mesmo AUMID; o atalho
   do boot (`windows-shortcut.cjs`) reconhece e não reescreve.
3. **Desinstalação por usuário.** A chave
   `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\Summa`
   leva `DisplayName`, `DisplayVersion` (do `package.json`), `DisplayIcon`,
   `Publisher` e `UninstallString`. O `UninstallString` chama o
   `uninstall.ps1` do próprio payload. O desinstalador apaga **só** a pasta da
   instalação, o atalho e a chave: os dados do aluno em
   `%APPDATA%\Mesa de Estudos` ficam. Antes de apagar a pasta, o script confere
   o caminho canônico dentro de `%LOCALAPPDATA%\Programs`, o nome exato e o
   atributo de reparse point (se a pasta virou link simbólico/junção, só o link
   é removido).
4. **Update assinado preservado.** O updater continua trocando só o payload e
   sem chave nova. Na instalação Windows, o `install-source.json` no payload
   põe o updater em modo bundle: ele atualiza o clone até o commit assinado e
   re-roda o `install-app`, que reescreve o payload e mantém o Electron na
   versão pedida (#103). A raiz do app instalado muda de plataforma
   (`Contents/Resources/app` no `.app`, `resources\app` no Windows), então
   `install-location.cjs` calcula a raiz e o comando de reabrir
   (`electron.exe` em vez de `open`). O atalho e a chave de desinstalação não
   são tocados pelo update.

## Consequências

- Instalar deixa de exigir terminal depois do `npm ci`: roda uma vez
  `npm run install-app` na pasta `desk\` e a Mesa aparece no menu Iniciar, em
  "Aplicativos instalados" e com o ícone/nome certos.
- O update por clique passa a funcionar na instalação Windows do mesmo jeito
  que no `.app`: mesma release assinada, mesmo manifesto, mesmo rollback. O
  Electron acompanha a versão pedida no pacote.
- O desinstalador é intencionalmente estreito (três alvos). Limpar dados do
  aluno continua sendo decisão dele, por fora.
- Continua sendo um instalador de desenvolvedor: o `npm run install-app`
  precisa de Node/npm na máquina em que é rodado; o app instalado não carrega
  Node para funcionar. O updater por clique mantém a exigência de Node já
  existente no `.app` (o worker é um processo Node).
- Sem assinatura de código, o SmartScreen avisa na primeira execução do
  `electron.exe` baixado — consequência aceita nesta decisão, não um bug.
- O caminho `%LOCALAPPDATA%\Programs\Summa` fica sendo o contrato do
  update no Windows. Mudá-lo exige migração/desinstalação, como mudar o
  `CFBundleIdentifier` no macOS.

## Alternativas consideradas

- **NSIS ou Inno Setup por usuário:** resolveriam instalador, atalho e
  desinstalação, mas exigem uma toolchain de build nova e uma segunda lista de
  arquivos do payload. Rejeitadas: a paridade com o macOS mantém uma regra só.
- **Squirrel/`electron-winstaller`:** traz um segundo mecanismo de update e
  dependência de build, brigando com o updater assinado atual (manifesto
  Ed25519, rollback, zip estável). Rejeitada.
- **Zip + script de primeira abertura que cria o atalho:** não cria entrada em
  "Aplicativos instalados" nem desinstalação; continua exigindo que o aluno
  saiba onde está a pasta. É o estado atual que a issue quer resolver.
  Rejeitada.
- **MSIX/Store ou Instalador com certificado:** depende de assinatura e de
  empacotamento por loja; a assinatura é decisão à parte (custo do
  certificado). Rejeitada para este ticket.
- **Renomear `electron.exe` para `Summa.exe`:** melhora o nome no
  Gerenciador de Tarefas, mas não muda AUMID, menu Iniciar nem update, e
  aumenta a diferença com o Electron do `.app`. Não entra.

## Fora daqui

- **Assinatura de código e SmartScreen** (#181 cita explicitamente): o
  certificado tem custo e é decisão separada; enquanto não houver, o
  instalador não assina nada.
- **Prova em conta limpa da VM Windows** (instalar, abrir, atualizar pelo
  Sobre e desinstalar): fica para a etapa de validação do ticket, com o
  roteiro de comandos anexado ao relatório.
- **Instalador gráfico/duplo clique para quem não tem Node:** o fluxo atual
  ainda começa por `npm run install-app` num clone.

## Referências

- Issues #181 (decisão), #178 (atalho e ícone), #160 (update em clone sujo) e
  #129 (instalação sem programador).
- `desk/scripts/install-app.mjs`, `desk/bundle-runtime.cjs`
  (`stageBundlePayload`, `installWindowsBundle`), `desk/windows-install.cjs`,
  `desk/windows-shortcut.cjs`, `desk/install-location.cjs`,
  `desk/updater.cjs` e `desk/update-host.cjs`.
- `docs/agents/release.md` (updater assinado e modos de atualização).
- ADR 0001 (Bend só para invariantes de domínio) e 0004 (TypeScript aos
  poucos), para o critério de manter uma regra só e não duplicar listas.
