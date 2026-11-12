# Ciclo 2 de UI/UX: cadernos, Xournal++ e chat solto

Meta: 9 em cada categoria e no Overall, em cada parte do recorte (#133, #135,
#158, #159, #157 e a montagem real). Rubrica, regras e entrega: pedido do Lucas
de 2026-11-07. Ciclo 1: 5 rodadas, terminou em 8,5 (registro na memória "Fila
deste release").

Capturas: `desk/tests/capture-ciclo2-<parte>.mjs`, fora do `npm run ui`, com o
mesmo molde de `capture-auditoria-ui-rodada5.mjs`. Cada captura sai com um
`.json` de medidas (contraste, alvos, foco, fonte) ao lado, para a nota não
depender só do olho. Antes e depois em `docs/design-loop/rodada-N/`.

Em 2026-11-10, antes do push, o Lucas aprovou tirar do histórico da branch os
`.json` de medidas e as capturas que nenhuma nota cita: ficaram as 548 PNG
citadas (de 1986), e o design-loop caiu de 108 MB para 29 MB. Os hashes nas
notas já são os de depois da limpeza. Os `.json` novos ficam fora do git
(`.gitignore`).

| Rodada | Data | Notas (por parte) | Commits | Decisões |
|---|---|---|---|---|
| 0 | 2026-11-07 | inventário e capturas (cadernos 101, chat solto 45, Xournal++ 18) | 85b748ee, 5ebdf8f0, 6ac6d868, 5dc0d19c | montagem refeita: era a Mesa inteira, passou a ser o chat solto |
| 1 | 2026-11-07 | cadernos 6,5 · chat solto 7,0 · Xournal++ 7,0 (só Clarity/Feedback/Estados/Consistência) · montagem 8,0 | notas 0deea212, d1e50845, afbe20e8 | D1 a D3 em `decisoes.md`; consertos em 4 grupos (cadernos, diário, chat solto JS, Xournal++), CSS do chat e cobertura de capturas na fila |
| 2 | 2026-11-08 | cadernos 7,5 · chat solto 8,0 · Xournal++ 8,0 · montagem 8,5 | consertos R1 9bc9c361, a3fbc48b, b8435050, 940d0730, eca17963; capturas 76160abc, 9139a20e; notas e475569d, 7506cb38, ed09850d, d9e2afb4 | Converter sem progresso segue em D1; Cadernos a 3 cliques segue em D2; consertos R2 em 5 grupos (MesaPagina, chat solto, busca e tinta, plugin, passo do ler_caderno); escopo da montagem e Enviar vazio na fila |
| 3 | 2026-11-08 | cadernos 8,5 (biblioteca e plugin 9,0 · ler_caderno 9,0 · busca e tinta 8,5) · chat solto 8,0 · Xournal++ 8,1 · montagem 8,5 | consertos R2 6ba69b8a, 15539c62, a843394e, f02426ce, 9f232472, 2c94c053, fdf59a4a; roteiros 9b506640, 0812e196; capturas fdda29b6; notas 7da09342, daf0755c, 28089e2c, b7d30fff | Color & contrast do chat solto parada em 8,5 por duas rodadas: a abordagem passa de remendos caso a caso para o token compartilhado (`--faint` e primário escuros). Clarity da montagem parada em 8,5: se não subir na R4, o escopo ganha linha própria. Converter segue em D1 (Feedback 5,5). Consertos R3 em 4 grupos (MesaPagina, chat solto, tinta e plugin, tokens) |
| 4 | 2026-11-09 | cadernos 8,5 (biblioteca e plugin 9,0 · ler_caderno 9,0 · busca e tinta 8,5) · chat solto 8,5 · Xournal++ 8,5 (Converter 8,1 · Trocar fonte 8,5 · página 8,8) · montagem 8,5 | consertos R3 9d46deb3, caeda681, e665046a, 601533ca; roteiro 8a891a13; capturas 21eddada; notas ec944f8a, be37119e, 2ab3a58a, 48406baa | Avaliadores da R4 travaram na 1ª tentativa (abriam todas as PNG); relançados com no máximo 30 imagens e medidas dos JSON em lote. Clarity da montagem parada em 8,5 por três rodadas: o escopo do chat ganha linha própria na coluna estreita. Converter segue em D1 (Feedback 6,5). "Tentar de novo" do erro do chat devolve a pergunta ao campo; reenviar direto é decisão do autor (D4). Consertos R4 em 3 grupos (busca dos cadernos, Trocar fonte, escopo do chat) |
| 5 | 2026-11-09 | cadernos 8,5 (ler_caderno 9,0) · chat solto 8,5 · Xournal++ 8,6 (Converter 8,1 · Trocar fonte 8,8 · página 8,9) · montagem 8,5 | consertos R4 117fd506, 2e3e359f, 599fd17b; capturas 504badf4; notas 466fdcdc, 64c7620d, e6644f02, 1beed5db | O kit de captura media contraste sem a `opacity` do elemento (JSON 6,57:1, pixel 2,59:1): passou a compor a opacidade efetiva. O escopo em linha própria da R4 quebrava mesmo com um material: agora só quebra quando não cabe. Os portões acusaram 8 esperas fixas sem motivo e dois arquivos acima do teto de linhas, todos desta branch: consertados antes da R6. Consertos R5 em 3 grupos (desabilitados legíveis, escopo/Copiado/quiz, textos do plugin) + esperas (d72e5262) + teto de linhas (195c5cb1) |
| 6 | 2026-11-10 | cadernos 9,0 · chat solto 9,0 · Xournal++ 8,6 (Converter 8,1 · Trocar fonte 8,8 · página 8,9) · montagem 9,0 | consertos R5 32dbcccc, a135c326, 814b741f; esperas d72e5262, abdfb174; teto de linhas 195c5cb1; capturas 3a6ff4a5; notas 266e210f, 78b11deb, 106bac38, e767b029 | Três partes chegaram a 9. O Xournal++ ficou em 8,6 por D1 e por estados sem captura: o roteiro passou de 19 para 33 estados (38ff8770), com o 12 limpo |
| 7 | 2026-11-10 | só Xournal++: 8,6 (Converter 8,1 · Trocar fonte 8,8 · página 8,9) | nota 8a39ba85; conserto 85a74ff4 | Estados subiu de 8,3 para 8,8 com as capturas novas, que mostraram quatro defeitos: nomes de fonte cortados iguais, diálogo de 903 px e dois avisos. Consertados em 85a74ff4 (rótulo pelo fim, 3 famílias da 2ª página em diante, diálogo de 702 px). O que resta abaixo de 9 é D1 (Feedback do Converter 6,5) e o limite da API 1.3.8 (tamanho da página): parada do ciclo |
| 8 | 2026-11-10 | sem nova nota: decisões D1–D4 aplicadas | D1 532bd48a + cfce6ca4; D2/D3 5a51b9a2 | D1 A: o plugin confere os tetos reais da ponte (2000 elementos com o fundo, 300 KB) antes do aviso, e o host loga o tempo de cada conversão. D2 B: `Mod+Shift+K` abre Cadernos. D3 B: ícone de caderno na lista; a Mesa não tem cor por matéria nem lê o formato na listagem, então hoje o ícone é cinza e a etiqueta "A4" só aparece quando o host mandar o formato. D4 A: sem mudança |
