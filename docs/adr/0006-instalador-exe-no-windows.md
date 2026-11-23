# 6. Instalador `.exe` e atualização sem Node no Windows

**Status:** decidida em 2026-11-18 (#119), com o ok do autor. Substitui a
[ADR 0005](0005-instalador-windows-por-usuario.md).

## Contexto

A ADR 0005 evitou uma ferramenta de empacotamento e deixou o Windows igual ao
macOS: clone, `npm ci` e `npm run install-app`. Na prática, instalar exigia
terminal e Node, e cada atualização dependia do Node do sistema, do clone e de um
`npm ci` que falha com o `electron.exe` travado (#6). As duas queixas do autor
vinham desse mesmo desenho.

## Decisão

1. **Instalador NSIS por usuário.** O `Summa-Setup-X.Y.Z.exe` leva o Electron e o
   payload de `stageBundlePayload`, sem administrador, em
   `%LOCALAPPDATA%\Programs\Summa`. É a mesma pasta da ADR 0005, então instala por
   cima de uma instalação antiga. O script é `desk/scripts/summa.nsi`.
2. **Atualização pelo próprio app.** Na pasta instalada, o `update-host` baixa o
   `.exe`, confere tamanho e SHA-256 com o manifesto assinado e o abre com
   `/S /UPDATE`. Se algo falhar até aí, a Summa continua aberta. Rodar do código
   continua no updater antigo.
3. **Troca de pastas.** O instalador extrai em `Summa.new` com a Summa ainda aberta
   e avisa em `Summa.ready`. Só então o app fecha e as pastas são renomeadas, o que
   encurta o tempo sem o app de minutos para segundos. Renomear falha enquanto algum processo segura arquivos, então a versão aberta
   nunca fica pela metade. Depois de 120 s, ele desiste, mantém a versão anterior
   e a reabre. A abertura seguinte compara a versão pedida com a que subiu e o
   Sobre mostra o resultado.
4. **Raiz de confiança igual.** O manifesto Ed25519 ganha `exeSha256` e `exeBytes`.
   O CI gera o `.exe` a partir da tag e o autor o assina no Mac com
   `update:sign --exe`. Versões antigas ignoram os campos novos.
5. **Dados fora da pasta do app.** Sem clone, o runtime novo fica em
   `%APPDATA%\Mesa de Estudos\runtime`. Dentro da pasta instalada, as sessões
   sumiriam na primeira troca.

## Migração

Quem roda da pasta do zip/clone continua recebendo atualizações pelo caminho
antigo. A ação separada **Instalar a versão para Windows (.exe)** no Sobre
baixa o instalador assinado e salva antes `runtimePath` e `vaultPath`, mesmo
sem config anterior (#187). Não move dados: o runtime continua em
`<clone>\desk\.runtime`. Quem já usava o app instalado de um clone também tem
a origem preservada em `previous-install-source.json`. **A pasta do clone
não pode ser apagada** enquanto o runtime morar nela.

## Consequências

- Instalar e atualizar no Windows deixam de exigir Node, npm, Git e clone.
- A Release publica mais um asset, e o `update:sign` recusa assinar sem ele.
- O zip continua publicado para instalações por zip/código; o DMG tem updater próprio.
- Sem certificado de assinatura de código, o SmartScreen avisa no primeiro
  download. A atualização pelo app não passa por esse aviso.
- O `npm run install-app` fica para quem desenvolve.

## Alternativas consideradas

- **electron-builder e electron-updater:** trariam um segundo formato de manifesto
  e outra raiz de confiança, ao lado do Ed25519 que já protege as releases.
- **Squirrel:** instala em pasta versionada, o que quebraria o contrato da pasta e
  o atalho de quem já tem a Summa.
- **Manter o clone e endurecer o `npm ci`:** não tira Node e terminal da instalação.
