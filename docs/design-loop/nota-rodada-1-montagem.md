# Nota da rodada 1 — montagem real (Xournal++ + chat solto)

Recorte: a montagem real da #157/#159 — Xournal++ 900×650 à esquerda e a
janela solta do chat lateral 420×650 à direita — nas capturas **17** e **18**
de `docs/design-loop/rodada-1/antes/xournal/`. O interior do Xournal++ (GTK)
fica fora, como pedido. A Mesa principal está minimizada; o conteúdo do chat é
fixture (`Resposta do OpenCode falso: …`, `Limites.pdf. p. 1`), então o texto
das mensagens não entra na nota. Para contraste, alvos e foco, usei os JSON da
janela solta em `docs/design-loop/rodada-1/antes/chat-solto/`; para a família,
as capturas da Mesa (`mesa-faixa-claro-1440x900.png`,
`mesa-trazido-de-volta-claro-900x650.png`).

**Vi as imagens.** Abri os PNG **17-montagem-real** e
**18-montagem-real-convertendo** com o leitor de imagens (1356×650). Abri
também `solto-resposta-claro-420x1000.png`,
`mesa-trazido-de-volta-claro-900x650.png` e
`mesa-faixa-claro-1440x900.png` para medir e comparar. Li os JSON 17/18,
`solto-resposta-claro-420x1000.json`,
`solto-resposta-escuro-420x1000.json`, `teclado-solto-resumo.json` e o código
citado (`support-sidechat.css`, `composer.css`, `tutor-chat.css`,
`sidechat-detach.mjs`, `sidechat-window-host.cjs`, `desk-menu.cjs`). Não abri
os PNG de tema escuro nem os de menu. O **18** repete a janela da Mesa e só
muda a seleção no Xournal (Ctrl+A); os achados valem para os dois.

## Resposta curta

- **As duas janelas funcionam como posto?** Sim. Topos e bases alinhados
  (ambas 650 px), 36 px de desktop entre elas, sem sobreposição (JSON 17/18,
  `seguro: true`, `intrusas: []`). A página do Xournal fica à esquerda e o chat
  à direita; a janela solta é calma o bastante para não competir com a barra de
  ferramentas do GTK.
- **Cabe e lê bem a 420 px?** Sim. A coluna de texto tem **396 px**
  (x=948–1343 no recorte; 12 px de recuo de cada lado), o corpo é
  **15 px/24 px** e a resposta quebra em **42–44 caracteres** por linha
  (`Resposta do OpenCode falso: ligue o limite` = 42). Nada estoura na
  horizontal.
- **Barra de menu, moldura, título, cabeçalho?** No cliente, há a barra de menu
  do app com **27 px** (`Mesa de Estudos · Editar · Estudar · Visualizar ·
  Ajuda`, y=0–26) e o cabeçalho **Chat lateral** com **40 px** (y=27–66). A
  moldura/título nativo não está no recorte (o crop começa na área do cliente;
  `xwininfo` em y=56), então não dá para julgar duplicação de título. O menu do
  app na janela solta é o achado 1.
- **Hierarquia?** Pergunta → resposta → campo, na ordem; a pergunta emoldurada
  puxa o olho antes da resposta em texto plano (achado 5).
- **O composer segue a regra da casa?** Sim na forma: fio de **1 px em cima**,
  colado de ponta a ponta (**420 px**, x=936–1355), texto recuado **12 px**
  (placeholder em x=949; bolha em x=948) e fio que acende em `--ring` no foco
  (`desk/src/composer.css:19-20`). O problema é a **altura** (achado 2).
- **É da família da Mesa?** Sim. É o mesmo componente do chat lateral preso
  (`mesa-trazido-de-volta-claro-900x650.png`): cabeçalho de 40 px, título
  12 px/600, corpo 15/24, rótulos 11 px, recuo 12 px, cinzas neutros e o mesmo
  azul de acento. O único elemento estranho é a barra de menu do app (achado 1).

## Notas

| Categoria | Nota | Base (medida) |
|---|---:|---|
| Typography | 9,0 | Corpo 15 px/24 px; título 12 px/600; rótulos e ações 11 px/17,6 px; coluna de 396 px dá 42–44 caracteres por linha; sem truncamento ou estouro no recorte. A escala é a da casa (11 px é o piso, legível). |
| Hierarchy | 8,5 | A ordem pergunta → resposta → campo funciona; os rótulos “Você”/“OpenCode” são 11 px. A bolha cheia da pergunta compete com a resposta em texto plano (achado 5, baixa). |
| Spacing & density | 7,5 | Recuo de 12 px consistente; cabeçalho 40 px; mas o composer ocupa **191 px de 650 (29%)** e a barra de menu mais 27 px (4%) — 40% da janela é cromo, com ~105 px de vão vazio dentro do campo (achados 1 e 2). |
| Color & contrast | 8,0 | Neutros coerentes com a Mesa (#f6f5f4 no cromo, branco no corpo, fio #e0e0e0, azul #2548c7). Contraste do corpo 17,58:1, rótulos 4,95:1, escopo 6,69:1, link 7,42:1; “Copiar”/“Levar à sessão principal” a 3,92:1 no claro (achado 3, média). |
| Iconography | 9,0 | +, ⋯ e × em alvos 28×28; cadeado 24×24 e atualizar 134×24 (24×24 no modo ícone), glifos de 12 px; ↑ Enviar em 75,9×28. Mesmo traço e mesma família de ícones do cabeçalho da Mesa; nada desalinha. |
| Consistency & polish | 8,0 | Mesmo componente do chat preso (título, corpo, rótulos, recuo, paleta e acento — comparar `mesa-trazido-de-volta-claro-900x650.png`); a barra de menu do app (achado 1) e a bolha esticada (achado 5) são as exceções. |
| Clarity | 8,5 | Pergunta, resposta e campo se entendem sem legenda; o escopo “fora da sessão principal” fica só no `title`/`aria-label` do cadeado (achado 6, baixa). |
| Estados | sem captura | As duas capturas mostram só a resposta concluída; vazio, respondendo, incerto/erro, Parar, anexos/cartões, rolagem longa, tema escuro na montagem e “sempre por cima” não estão em 17/18. |
| Feedback e movimento | sem captura | PNG estático: hover, transição de opacidade, streaming e retorno do envio não aparecem. O foco de teclado está no JSON e vira o achado 4. |
| Acessibilidade | 7,5 | Alvos ≥24 px (28×28 no cabeçalho, 51,7×25,6 e 148,6×25,6 nas ações, 24×24 no cadeado, 134×24 no atualizar, 75,9×28 no Enviar); foco 2 px azul nos botões e nomes acessíveis no DOM. Falham o contraste de 3,92:1 (achado 3) e o anel de foco da janela solta (achado 4). |
| Janela pequena | 8,0 | 420×650 cabe, sem overflow; escopo em uma linha em 420; na coluna de 254 px do chat preso o escopo já trunca (inventário do chat solto, observação 4), sem quebrar o resto. O peso do menu e do composer é o dos achados 1 e 2. |
| Overall | 8,0 | O par funciona como posto e a janela solta lê bem e é da família; os defeitos visíveis (menu, altura do composer, contraste) impedem o 9. |

## Achados

| # | Categoria | Severidade | Evidência | Conserto em uma linha | Arquivo provável |
|---:|---|---|---|---|---|
| 1 | Consistency & polish | média | **17/18**: a janela solta mostra a barra de menu do app inteiro, com **27 px** no topo (y=0–26; “Mesa de Estudos · Editar · Estudar · Visualizar · Ajuda”, texto de x=943 a 1287). Os itens do menu (Conferir/Estudar, Configurações etc.) chamam `live.win.webContents.send(...)` (`desk/desk-menu.cjs:78-81`), ou seja, agem na Mesa principal, que está minimizada no posto. No macOS a barra fica no menu do sistema e o defeito não aparece. | `child.setMenu(null)` (ou um menu mínimo do lateral) no `did-create-window`, mantendo o menu do app só na principal. | `desk/sidechat-window-host.cjs:177`; `desk/desk-menu.cjs:80` |
| 2 | Spacing & density | média | **17/18**: o fio do composer está em y=459 do recorte de 650 px; o composer ocupa **191 px (29%)**. O campo vazio vai do placeholder (y=503–517) ao “Enviar” (y=622–632): **~105 px de vão**, e o campo mede 126 px no JSON de 420×1000. O `min-height` do lateral soma a altura do composer do tutor e o pé da calculadora (`desk/src/support-sidechat.css:61`), que não existem na janela solta. | Na janela solta, zerar o `min-height` e fixar o campo em 3 linhas (~92 px), devolvendo ~100 px à conversa. | `desk/src/support-sidechat.css:61-66`; override no `layout` de `desk/src/sidechat-detach.mjs:122` |
| 3 | Color & contrast | média | `solto-resposta-claro-420x1000.json`: “Copiar” e “Levar à sessão principal” a 11 px/400 com `opacity:.55` computam **3,92:1** no claro (no escuro, 5,26:1) — abaixo de AA 4,5:1 para texto pequeno. Em **17/18** as duas ações aparecem pálidas sob as mensagens. | Subir o repouso para ≥4,5:1 (opacidade ~0,75 ou `--muted` sem opacidade) e manter a opacidade 1 no hover/focus. | `desk/src/support-sidechat.css:52-53` |
| 4 | Acessibilidade | baixa | `solto-resposta-claro-420x1000.json`: com foco no `#sidechat-prompt` (`focusVisible: true`), o `after` de `#sidechat` computa `display:none`. O layout da janela solta desliga `#sidechat:focus-within::after` e a regra `:has(:focus-visible)` repõe `content`/borda, mas não `display` (`desk/src/sidechat-detach.mjs:122`); o anel de 1 px em volta da janela não pinta e sobra o fio azul de 1 px do composer (7,42:1). | Acrescentar `display:block` à regra `:has(:focus-visible)` (ou usar `content:none` no repouso). | `desk/src/sidechat-detach.mjs:122` |
| 5 | Hierarchy | baixa | **17/18**: a bolha do usuário estica **396 px** (x=948–1343), com o texto à esquerda e “Você” à direita; o fundo é branco puro (`--user: var(--surface)`, `desk/src/support-sidechat.css:24`) e o fio #e0e0e0 dá 1,32:1 contra o branco. No tutor a mesma mensagem é `max-width:85%`, encostada à direita, com o token `--user:#f1f1f1` (`desk/style.css:92`; `desk/src/tutor-chat.css:178-184`); o lateral força `align-self:stretch` (`support-sidechat.css:51`). | Usar `align-self:flex-end;max-width:85%` e o `--user` do tutor (a forma da bolha do tutor). | `desk/src/support-sidechat.css:24`, `:51` |
| 6 | Clarity | baixa | **17/18**: a linha de escopo visível diz só “Limites.pdf. p. 1” (y=472–483), com um cadeado de 12 px e “Atualizar contexto”; “Fora da sessão principal” existe apenas em `title`/`aria-label` do cadeado (`desk/src/sidechat.mjs:726-730`). Sem hover, o aluno lê um cadeado sem legenda. | Mostrar “fora da sessão” quando couber (ou um rótulo curto no popover) e manter tooltip/aria. | `desk/src/sidechat.mjs:95-98`, `:726-730` |

## SEM CAPTURA

| Item | Por quê | Onde |
|---|---|---|
| Estados do chat: vazio, respondendo/streaming, incerto/erro, “Parar”, anexos, cartões de permissão, conversa longa com rolagem, tema escuro na montagem, “sempre por cima” ligado/desligado | 17/18 mostram só a resposta concluída; a rodada do chat solto tem estados separados, fora desta montagem. | 17/18; `solto-*`/`preso-*` em `chat-solto/` |
| Feedback e movimento: hover, transição de opacidade, envio/streaming | As duas são PNG estáticos; não há captura de movimento. O foco de teclado mensurável está no achado 4. | 17/18; JSON de foco do chat solto |
| Moldura e título nativo da janela solta | O recorte começa na área do cliente (y=56 da tela; `xwininfo`); a moldura/título do sistema não está na imagem. No cliente, o título é o cabeçalho “Chat lateral”. | 17/18; `17-montagem-real.json` |
| Leitor de tela em execução | Os nomes acessíveis foram lidos do DOM (`sidechat.mjs:692-698`, `:726-730`); não há captura de árvore de acessibilidade nem de leitor de tela falando. | `solto-resposta-claro-420x1000.json` (`labels`) |
| Interior do Xournal++ (GTK) | Fora do escopo por definição. | — |
