# Inventário: chat solto (#157)

Parte "Chat solto" do ciclo 2 de UI/UX: a janela própria do chat lateral, a
faixa "Chat em outra janela", soltar/trazer de volta, "sempre por cima" e o
chat preso na Mesa com resposta, cartões, envio incerto e janela pequena.

Capturas em `docs/design-loop/rodada-2/antes/chat-solto/` (o "antes" da rodada 2;
a rodada 1 continua em `rodada-1/antes/chat-solto/`). Cada PNG tem um `.json`
homônimo com as medidas do DOM (não é só olho): cor do texto, fundo efetivo e
razão de contraste WCAG; fonte/peso/line-height; tamanho dos alvos clicáveis;
elemento focado com outline/box-shadow e a cadeia de ancestrais; rótulos
acessíveis (`aria-label`/`role`/`title`); placeholders; e o tamanho real da
janela. Dados sintéticos e `fake-opencode`: nenhum material de curso.

Script reproduzível, fora do `npm run ui`:

```sh
cd desk
DISPLAY=:0 node tests/capture-ciclo2-chat-solto.mjs
# opções: --out <dir>  |  CICLO2_OUT=<dir>
# CICLO2_ONLY=solto,vazio,carregando,erro,preso,en roda só alguns blocos
```

A pasta de saída é limpa de PNG/JSON antes da rodada completa
(`CICLO2_ONLY` preserva o que já existe). O script usa `helpers.mjs`,
`waits.mjs` e o molde de `capture-auditoria-ui-rodada5.mjs`; a janela solta é
uma BrowserWindow filha e é capturada pela página dela (`app.windows()`), não
por recorte da Mesa. O cartão vem do `quiz` sintético do `fake-opencode`; o
envio incerto é montado por `openSavedSidechat` com payload sintético (o mesmo
caminho de restauração do app), sem reenvio real. Os blocos de vazio,
carregando e erro ficam em `capture-ciclo2-chat-solto-estados.mjs` só para o
script principal ficar abaixo de 500 linhas.

## Tamanhos reais nesta máquina

A tela é 1366×768; o X11 aceitou as janelas maiores. `resizeWindow` mede
`setSize` (moldura), então o conteúdo fica alguns pixels menor que o pedido.
Nenhum pedido caiu no fallback (`extra.window.fallback = false`).

| Pedido (moldura) | Conteúdo medido | Onde |
|---|---|---|
| 1440×900 | 1440×873 | Mesa grande |
| 900×650 | 900×623 | Mesa pequena (mínimo) |
| 380×800 | 380×773 | janela solta |
| 420×1000 | 420×973 | janela solta alta |

## Telas e estados

### Janela solta — resposta do tutor

| Tema | 380×800 | 420×1000 |
|---|---|---|
| claro | `solto-resposta-claro-380x800` | `solto-resposta-claro-420x1000` |
| escuro | `solto-resposta-escuro-380x800` | `solto-resposta-escuro-420x1000` |

### Janela solta — vazio, carregando e erro

| Estado | Claro | Escuro | O que o `.json` registra |
|---|---|---|---|
| Vazio (sem mensagens) | `solto-vazio-claro-380x800` | `solto-vazio-escuro-380x800` | `.sidechat-empty` visível, zero mensagens/cartões |
| Respondendo (fake segura o turno) | `solto-carregando-claro-380x800` | `solto-carregando-escuro-380x800` | Parar visível, Enviar desligado, linha "O chat lateral está respondendo…" |
| Erro do motor (fake `network`) | `solto-erro-claro-380x800` | `solto-erro-escuro-380x800` | `Erro do chat lateral: Sem conexão…`, Parar sumiu, Enviar reabilitado |

O "carregando" usa `FAKE_OPENCODE_QUEUE_HOLD_MS=60000`; nenhuma resposta real do
modelo é esperada. O "erro" usa `FAKE_OPENCODE_FAIL=network` e é o mesmo caminho
de erro do provedor que o chat principal mostra.

### Faixa "Chat em outra janela" na Mesa

| Tema | 1440×900 | 900×650 |
|---|---|---|
| claro | `mesa-faixa-claro-1440x900` | `mesa-faixa-claro-900x650` |
| escuro | `mesa-faixa-escuro-1440x900` | `mesa-faixa-escuro-900x650` |

### Soltar em outra janela — menu "Mais opções" do chat preso

| Tema | 1440×900 |
|---|---|
| claro | `mesa-menu-soltar-claro-1440x900` |
| escuro | `mesa-menu-soltar-escuro-1440x900` |

### Trazer de volta — menu da janela solta ("Trazer de volta" + "Sempre por cima" desligado)

| Tema | 380×800 |
|---|---|
| claro | `solto-menu-trazer-claro-380x800` |
| escuro | `solto-menu-trazer-escuro-380x800` |

O JSON registra `aria-checked="false"`, `data-state="Desligada"` e
`alwaysOnTop: false` (o estado de abertura da filha).

### Sempre por cima ligado — menu e sinal no cabeçalho

| Tema | Menu (380×800) | Cabeçalho com o alfinete (380×800) |
|---|---|---|
| claro | `solto-menu-por-cima-claro-380x800` | `solto-por-cima-sinal-claro-380x800` |
| escuro | `solto-menu-por-cima-escuro-380x800` | `solto-por-cima-sinal-escuro-380x800` |

O JSON do menu registra `aria-checked="true"`, `data-state="Ligada"`,
`alwaysOnTop: true` e `desk.sidechatAlwaysOnTop: true` no `desk.json`. O sinal é
o `#sidechat-pin` (`role=img`) no cabeçalho, com o ícone de alfinete e nome
acessível "Sempre por cima ligado" — só existe na filha. Padrão confirmado
desligado na abertura (`defaultAlwaysOnTop: false`).

### Trazido de volta — Mesa com a coluna restaurada e o foco no campo

| Tema/idioma | 1440×900 | 900×650 |
|---|---|---|
| claro pt-BR | `mesa-trazido-de-volta-claro-1440x900` | `mesa-trazido-de-volta-claro-900x650` |
| escuro pt-BR | `mesa-trazido-de-volta-escuro-1440x900` | — |
| inglês | — | `en-mesa-trazido-de-volta-light-900x650` |

O JSON registra `focus.id = "sidechat-prompt"`: fechar a filha devolve o foco
ao campo, como o teste de janela já cobra. O `en-...-900x650` é o estado **limpo**:
sem o aviso de entrega incerta e com o Enviar habilitado (o payload incerto é
capturado à parte, em `en-solto-incerto-light-380x800`).

### Chat preso na Mesa — resposta do tutor + cartão

| Tema | 1440×900 | 900×650 |
|---|---|---|
| claro | `preso-cartao-claro-1440x900` | `preso-cartao-claro-900x650` |
| escuro | `preso-cartao-escuro-1440x900` | `preso-cartao-escuro-900x650` |

### Chat preso na Mesa — cartão respondido

| Tema | 1440×900 | 900×650 |
|---|---|---|
| claro | `preso-cartao-respondido-claro-1440x900` | `preso-cartao-respondido-claro-900x650` |
| escuro | `preso-cartao-respondido-escuro-1440x900` | `preso-cartao-respondido-escuro-900x650` |

A opção certa fica `.correct` (verde), a escolha continua `aria-checked=true` e
a ação do cartão vira "Concluir".

### Chat preso na Mesa — toast de "copiado"

| Tema | 1440×900 |
|---|---|
| claro | `preso-copiado-claro-1440x900` |
| escuro | `preso-copiado-escuro-1440x900` |

O clique é no Copiar da resposta; o clipboard vira um gravador nomeado no teste
(`window.__c2Copied`), e o toast "Mensagem lateral copiada." nasce do caminho
real de `copySidechatMessage`.

### Chat preso na Mesa — envio incerto

| Tema | 1440×900 | 900×650 |
|---|---|---|
| claro | `preso-incerto-claro-1440x900` | `preso-incerto-claro-900x650` |
| escuro | `preso-incerto-escuro-1440x900` | `preso-incerto-escuro-900x650` |

O JSON registra UM aviso só, o `.sidechat-warn` (achado 8): a linha de atividade
fica vazia no incerto e `#sidechat-send` está desligado.

### Janela pequena

Coberta pelas linhas de 900×650 do chat preso (resposta+cartão, cartão
respondido e incerto) e pela janela solta de 380×800.

## Inglês (interface em en)

Um tamanho de cada estado, tema claro:

| Estado | Captura |
|---|---|
| chat preso com resposta + cartão (900×650) | `en-preso-cartao-light-900x650` |
| menu "Soltar em outra janela" (900×650) | `en-menu-soltar-light-900x650` |
| janela solta com resposta + cartão (380×800) | `en-solto-resposta-light-380x800` |
| faixa "Chat in another window" (900×650) | `en-faixa-light-900x650` |
| menu "Bring back" + "Always on top" desligado (380×800) | `en-solto-menu-trazer-light-380x800` |
| menu "Always on top" ligado (380×800) | `en-solto-menu-por-cima-light-380x800` |
| envio incerto na janela solta (380×800) | `en-solto-incerto-light-380x800` |
| trazido de volta limpo (900×650) | `en-mesa-trazido-de-volta-light-900x650` |

## Percurso só pelo teclado

Na janela solta (380×800, claro), Tab a partir do body; cada captura mostra o
anel de foco e o JSON registra `focus.focusVisible`, `outline`, `boxShadow` e a
rota até ali. A rota completa está em `teclado-solto-resumo.json`.

| # | Controle | Captura |
|---|---|---|
| 1 | fechar | `teclado-solto-01-sidechat-close-claro-380x800` |
| 2 | Copiar (ação da pergunta) | `teclado-solto-02-copiar-sua-pergunta-claro-380x800` |
| 3 | Copiar (ação da resposta) | `teclado-solto-03-copiar-resposta-claro-380x800` |
| 4 | Levar à sessão principal | `teclado-solto-04-levar-a-sessao-principal-claro-380x800` |
| 5 | cadeado "Fora da sessão principal" | `teclado-solto-05-sidechat-scope-lock-claro-380x800` |
| 6 | Atualizar contexto | `teclado-solto-06-sidechat-refresh-claro-380x800` |
| 7 | campo de mensagem | `teclado-solto-07-sidechat-prompt-claro-380x800` |
| 8 | Enviar | `teclado-solto-08-sidechat-send-claro-380x800` |
| 9 | chat novo | `teclado-solto-09-sidechat-new-claro-380x800` |
| 10 | Mais opções | `teclado-solto-10-sidechat-more-claro-380x800` |

Menu "Mais opções" pelo teclado (setas ↑/↓, Home/End e Esc), com o foco no
último item:

| Tema | Captura |
|---|---|
| claro | `teclado-solto-menu-item-claro-380x800` |
| escuro | `teclado-solto-menu-item-escuro-380x800` |

Na Mesa, Tab até a faixa "Chat em outra janela", nos dois temas:

| Tema | Captura | Resumo da rota |
|---|---|---|
| claro | `teclado-faixa-claro-1440x900` | `teclado-faixa-resumo-claro.json` |
| escuro | `teclado-faixa-escuro-1440x900` | `teclado-faixa-resumo-escuro.json` |

A faixa recebe `outline: 2px solid var(--ring)` visível nos dois temas.

## Estado sem captura (e motivo)

- **Estado `unavailable`** (ponte `window.desk.sidechat*` ausente, texto em
  `renderUnavailable`): exigiria um host sem a ponte do lateral; não é um estado
  que a Mesa normal alcança. Fica fora do recorte.
- **Hover das ações de mensagem** ("Copiar"/"Levar à sessão principal"): não foi
  pedido; a nota de Feedback usa o contraste em repouso e o `:focus-within` dos
  JSON. O hover medido desta rodada foi o dos cadernos (linha e interruptor).

Os demais estados visuais do recorte têm PNG, inclusive os que a rodada 1
declarou SEM CAPTURA (vazio, carregando, erro, cartão respondido, teclado do
menu, sinal de "sempre por cima" e toast de copiado).

## Observações de UI (anotadas, não corrigidas)

1. **Área vazia entre a faixa e o tutor quando o chat está solto.** O leitor
   fixado continua em 50% da grade (`readers.css:74`) enquanto o segundo
   leitor some e o slot recolhe para 34px (`readers.css:105`); sobram ~490px
   vazios em 1440×900 e ~220px em 900×650 (ver `mesa-faixa-*` e
   `teclado-faixa-*`). O leitor não cresce para ocupar o espaço liberado.
2. **Contraste das ações de mensagem no tema claro.** "Copiar" e "Levar à
   sessão principal" ficam com `opacity: .55` (`.sidechat-msg-actions`,
   `support-sidechat.css:52`): 3,92:1 em 11px no claro (abaixo de 4,5:1 do
   WCAG AA); no escuro, 5,26:1. Só sobem para opacidade cheia no hover ou
   `:focus-within`.
3. **Foco do campo de mensagem.** O textarea tem `outline: 3px none` e
   `box-shadow: none` (`composer.css:147`); o sinal de foco é o fio superior do
   composer mudando para `--ring` (`composer.css:20`) e, na Mesa, o contorno do
   painel (`readers.css:119`). Na janela solta o contorno do painel é desligado
   (`sidechat-detach.mjs:122`) e o substituto `:has(:focus-visible)` não repõe
   `display`, então sobra o fio de 1px.
4. **Escopo truncado em coluna estreita.** Em 900×650 o texto
   "Formulario.pdf p. 1" vira "Formulario…" sem `title` no texto do escopo
   (o cadeado e o ícone de atualizar continuam com nome acessível); o
   `scopeLabels` completo só aparece na janela solta mais larga.
5. **Erro do motor ocupa a lista como uma resposta.** Em `solto-erro-*`, o
   texto "Erro do chat lateral: …" entra como uma mensagem `assistant` normal
   (com Copiar), sem uma marca visual de falha; quem lê a conversa depois não
   distingue o aviso de uma resposta do tutor.

## Medidas que valem para a nota

- Textos visíveis amostrados: nenhuma resposta/cartão/aviso abaixo de 4,5:1
  nos dois temas; a exceção é a ação de mensagem no claro (item 2 acima) e o
  "Enviar" desligado no incerto (2,04:1 claro / 2,52:1 escuro; componente
  inativo, isento pela WCAG).
- Alvos clicáveis: nenhum abaixo de 24px; exemplos: ícones do cabeçalho
  28×28, Enviar 75,9×28, itens do menu 230×28, faixa 33×829, "Atualizar
  contexto" 24×24 no modo ícone.
- Placeholders: "Pergunte no lateral…" 4,95:1 no claro e 6,02:1 no escuro.

## Contagem

61 PNG + 61 `.json` de medidas + 3 resumos de teclado
(`teclado-solto-resumo.json`, `teclado-faixa-resumo-claro.json` e
`teclado-faixa-resumo-escuro.json`) + `falhas.json` = 126 arquivos.
Todos os blocos imprimiram `ok`; `falhas` está vazio.
