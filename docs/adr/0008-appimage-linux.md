# ADR 0008 — AppImage no Linux

Status: aceita.

## Contexto

Uma instalação Linux precisa levar Electron e dependências, sem exigir Node,
npm ou clone. O aluno deve atualizar pelo Sobre sem perder estudos ou atalhos.

## Decisão

Publicar `Summa-X.Y.Z-x86_64.AppImage`, com o mesmo payload do instalador
Windows e sem origem de clone. O AppRun desliga somente o sandbox SUID do
Chromium, pois AppImage não preserva esse bit, mantendo o sandbox de namespaces.
Se AppArmor restringe namespaces sem privilégio ou `unshare -Ur true` falha
(inclusive quando o comando está ausente), usa `--no-sandbox` como fallback.
Só nesse caso há redução do isolamento, sem mudar o app de desenvolvimento.

Na abertura, integrar menu e ícone por usuário em `XDG_DATA_HOME` (fallback
`~/.local/share`), somente se o conteúdo mudou. O arquivo pode ser renomeado ou
movido: abrir novamente atualiza o atalho. Dados ficam fora da montagem.

A Release assina também `appImageSha256` e `appImageBytes` no manifesto
Ed25519. O updater baixa com teto e hash incremental para um `.part` oculto na
mesma pasta do AppImage. Somente depois da conferência aplica `chmod 0755` e
rename atômico sobre o caminho original. Pasta protegida recusa sem fechar a
Summa; não há elevação nem instalação global.

O processo novo não herda as variáveis da montagem antiga. O pedido pendente
reusa o registro do instalador Windows; na abertura seguinte a versão em
execução determina o resultado aplicado/recuperado mostrado no Sobre.

## Consequências

O nome original permanece estável para atalhos. Downloads inválidos não
alteram o executável nem os dados do aluno. Falha ao iniciar depois do rename
mantém o processo antigo aberto, mas o arquivo já é o novo; não há rollback
automático desse rename. O workflow Linux prova build e abertura; o ensaio
de atualização deve percorrer o IPC real antes de publicar mudanças nesse fluxo.

Ubuntu pode exigir `libfuse2` (`libfuse2t64` nas versões recentes); sem FUSE,
`--appimage-extract-and-run` permite abrir o mesmo arquivo.
