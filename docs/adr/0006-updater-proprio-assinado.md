# 6. Updater próprio assinado, sem electron-updater

**Status:** decidida em 2026-11-21 (fase 6 da modernização do `desk/`),
depois de comparar o updater atual com `electron-updater` + GitHub Releases.
Nada foi migrado.

## Contexto

O updater por clique (Sobre → Atualizar e reiniciar) é superfície mantida:
`update-host.cjs`, `update-origin.cjs`, `updater-*.cjs` e os scripts
`update-cli`, `update-release` (keygen/sign/verify), `update-rehearsal`,
`update-open-rehearsal` e `update-zip` — cerca de 3 mil linhas. O plano pediu
para avaliar se o `electron-updater` com GitHub Releases o substitui.

O que o updater de hoje garante ([release.md](../agents/release.md)):

- **Três formas de instalação com um mecanismo só:** zip de fonte (`git
  archive`, relançado com `npm start`), clone git (pull até a tag assinada) e
  bundle (`Summa.app` no macOS, pasta por usuário no Windows, ADR 0005), em que
  só o payload troca e o Electron acompanha `node_modules`.
- **Raiz de confiança Ed25519 do autor:** manifesto assinado com `{version,
  commit, zipSha256, zipBytes}`, teto de bytes em todo download, commit da tag
  conferido nos modos git/bundle, rollback quando algo falha.
- **Ensaio antes de assinar:** o `sign` recusa se o updater da versão
  publicada anterior não aplicar o zip candidato sem perder arquivo, dado do
  usuário ou chave (`update:rehearsal`).
- **Compatibilidade com instalações antigas:** a regra de arquivos da 0.5.0
  (`tests/updater-compat.test.mjs`) e a cópia da chave para quem não recebe
  `.pub` mostram que versões publicadas continuam se atualizando.

## Comparação

| Critério | Updater atual | electron-updater + GitHub Releases |
| --- | --- | --- |
| Formas de instalação | zip de fonte, clone git e bundle | só artefatos do electron-builder: Squirrel.Mac, NSIS, AppImage/rpm/deb (README do pacote) |
| macOS | `.app` com assinatura ad-hoc quando não há certificado (`install-app`) | Squirrel.Mac passa o update pela verificação de assinatura de código; sem identidade estável, o update não fecha |
| Confiança | assinatura Ed25519 própria sobre manifesto + hash do zip | hash sha512 do `latest.yml` servido junto do artefato; sem chave do autor por padrão |
| Instalações já publicadas | atualizam pelo código que já têm | nenhuma versão publicada traz electron-updater: exigiria release-ponte e reinstalação |
| Build | nenhum (o zip roda do fonte, fase 2) | electron-builder vira passo obrigatório de release |
| Dependências | nenhuma de runtime | `electron-updater` entra como dependência de runtime |
| Ensaio da versão anterior | `update:rehearsal` no `sign` | não há; teria de ser reescrito |

## Decisão

Manter o updater próprio. A assinatura Ed25519 com chave do autor, o ensaio
contra a versão publicada anterior e o suporte a zip de fonte e clone git são
requisitos deliberados (#80, #130, #153, ADR 0005), não acidente de
implementação. O `electron-updater` cobriria só o modo bundle, e mesmo nele
pediria assinatura de código paga no macOS e no Windows, electron-builder no
release, uma dependência de runtime e uma versão-ponte para quem já instalou.
Os scripts customizados continuam.

## Consequências

- O custo de manter `updater-*.cjs` e os scripts de release segue com a Mesa;
  testes (`updateflow`, `updater-*`, `update-*`) e o ensaio são a rede.
- Se um dia houver certificado Developer ID e Authenticode, e o zip de fonte e
  o clone deixarem de ser formas suportadas de instalação, vale reabrir: aí o
  `electron-updater` cobriria todas as instalações restantes.

## Referências

- [`docs/agents/release.md`](../agents/release.md), ADR 0005.
- `electron-updater` README (sistemas suportados) e Squirrel.Mac README
  (verificação de assinatura de código no update).
