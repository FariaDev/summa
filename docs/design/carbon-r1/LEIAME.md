# Mesa — Carbon r1

Protótipo estático da interface da Mesa com um sistema inspirado no IBM Carbon. Não é o app: nada em `desk/`, `core/` ou `config` foi alterado.

## Como abrir

Abra `index.html` direto pelo `file://`. O índice leva às quatro telas e tem as chaves de tema (claro/escuro) e de acento. As telas também leem `?theme=dark&accent=violet` na URL. Tudo é offline: as fontes estão em `fonts/`.

## O que está aqui

- `tokens.css`: a única fonte de valores — cor, tipo, espaço, raio, sombra e medidas de controle. Os outros CSS só usam `var(--...)`.
- `components.css`: base, componentes e o desenho das telas.
- `principal.html`: as três colunas atuais com a anatomia nova de cabeçalho, conversa e composer.
- `configuracoes.html`: tela cheia com as cinco seções reais (Matérias, Leitores, Recursos da mesa, Aparência e avisos, Pastas e programas). A captura abre em Aparência e avisos; as outras seções estão a um clique.
- `guia.html`: as sete seções reais, com o texto do Guia, sumário, tabela de atalhos e pé de navegação.
- `componentes.html`: a folha de componentes e a proposta de marca.
- `capturas/`: PNGs 1440×900 no claro e no escuro, mais a folha de componentes inteira e capturas extras de Pastas e programas e Atalhos.

## Decisões

- **Escala curta:** 12, 14, 16, 20 e 28 px; pesos 400 e 600, com 500 só no Mono. Números em `tabular-nums`.
- **Espaço:** 2, 4, 8, 12, 16, 24, 32 e 48. Controles de 32 e 40; cabeçalho de painel de 48.
- **Canto e sombra:** raio 0 em tudo, exceto o ponto de status; sombra só no menu suspenso. A hierarquia vem de `--layer-1`, `--layer-2` e do fio de 1 px.
- **Acento:** azul `#0f62fe` no claro e `#4589ff` no escuro, como pedido. Violeta, verde, laranja, rosa e grafite foram mapeados para equivalentes Carbon da mesma família (por exemplo, violeta `#8a3ffc`/`#be95ff`, verde `#198038`/`#42be65`).
- **Toggles:** para cumprir o raio 0, o toggle é quadrado (trilho de 40×20 com botão quadrado), não a pílula do Carbon.
- **Cabeçalho de painel:** um só desenho nos três painéis; o papel vira rótulo pequeno e o documento é o seletor. O contador fica em Mono.
- **Composer:** colado na coluna, só o fio em cima; a calculadora ocupa a linha de baixo em `--layer-1`.
- **Foco:** contorno de 2 px do acento, inset; nos botões cheios ele vira a cor do texto, para não desaparecer dentro do próprio acento.
- **Configurações e Guia:** os textos e as opções vieram de `desk/index.html`, `desk/src/locales/pt-BR.json` e `desk/src/guide.mjs`. Não há opção inventada.
- **Marca:** a luminária foi redesenhada em uma cor, sem gradiente, brilho, mesa, gavetas ou grade: só a cúpula e a luz numa folha chapada, em negativo. É proposta; a arte original continua sendo a do autor.
- **Fontes:** IBM Plex Sans (400/500/600) e IBM Plex Mono (400/500), de `@ibm/plex-sans` e `@ibm/plex-mono` no npm; STIX Two Text (normal e itálico), copiada de `desk/src/fonts/`. Licenças em `fonts/OFL-Plex.txt` e `fonts/OFL.txt`.

## Fora do escopo

- Nenhuma mudança no app, nos PDFs ou no `config.json`.
- Sem dados reais e sem material de curso: os “PDFs” são texto escrito para o protótipo.
- Sem backend, CDN, servidor ou dependência de rede.
- Interações só de protótipo: troca de tela, tema, acento, seções de Configurações/Guia e controles nativos. Salvar, buscar de verdade e conversar com o tutor não estão implementados.
- Sem versão responsiva: as telas foram desenhadas para 1440×900.
- As capturas foram renderizadas em Chromium headless (Playwright); o ambiente de trabalho não tinha servidor X para abrir o Electron.
- As capturas principais cobrem Aparência e avisos em Configurações e Começar no Guia; há extras de Pastas e programas e Atalhos. As demais seções existem no HTML, mas não foram fotografadas.
