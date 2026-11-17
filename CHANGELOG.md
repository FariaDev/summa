# Novidades da Summa

## 1.3.2

Um plano de estudo dentro da Summa e o envio só com imagem. Quem tem a 1.3.0 ou a 1.3.1 recebe pelo **Atualizar**.

- **Plano de estudo:** o botão **Plano**, na barra de cima ao lado de Caderno e GeoGebra, mostra a tarefa de agora. As tarefas se editam no próprio texto (Enter cria a próxima), podem ser ligadas ao PDF e à página abertos e reabertas com **abrir**, ou desligadas do PDF. No fim fica um bloco de **Anotações** livre. Cada matéria tem o seu plano.
- **Só imagem:** dá para mandar uma imagem ao tutor sem escrever nada; ele responde a partir dela. Vale no tutor e no chat lateral, e a exportação da conversa mostra só a imagem.
- **Ensaio do Windows:** o teste de atualização no Windows parte das versões do Summa.

## 1.3.1

Correções. Quem tem a 1.3.0 recebe pelo **Atualizar**.

- **Resposta duplicada:** a resposta do tutor não aparece mais duas vezes no mesmo balão quando o modelo pensa antes de responder.
- **Página preta do Ambitus:** a página e a tinta que o Ambitus manda chegam ao tutor sobre fundo branco, e não mais pretas.
- **Página do Ambitus no tutor:** a página que o Ambitus envia vai direto para a pergunta do tutor principal, com o campo em foco. O chat lateral continua lá para quem quiser usar.

## 1.3.0

A Mesa virou **Summa**, ganhou casa nova e chegou ao Windows com instalador. A escrita à mão do Ambitus entra na conversa, o tutor cabe numa janela pequena e a leitura ficou mais perto de você. Quem instalou pelo zip recebe tudo pelo **Atualizar**; só quem clonou o mesa-de-estudos reinstala uma vez pelo Summa.

### Antes de atualizar

- **Nome e repositório novos:** a Mesa de Estudos agora é **Summa**, com a integral a pincel como logo, em grafite e violeta, e vive em `github.com/FariaDev/summa`. Matérias, PDFs, caderno e progresso ficam onde estão.
- **Quem instalou pelo clone do mesa-de-estudos** precisa baixar e instalar de novo a partir do Summa para continuar recebendo atualizações. Não apague a pasta antiga: seus dados podem estar nela, e a Summa continua lendo de lá. O aviso está na release 1.3.0 do mesa-de-estudos, porque o clone antigo não recebe esta versão.
- **Acento:** ficam só **Grafite** e **Violeta**; azul, verde, laranja e rosa saem. Quem usava um deles volta ao Grafite.

### Novidades

- **Summa no Windows:** `npm run install-app` instala por usuário em `%LOCALAPPDATA%\Programs\Summa`, com atalho no menu Iniciar, ícone próprio, entrada em "Aplicativos instalados" e desinstalação. Sem admin e sem mexer no PATH.
- **Logo e identidade novas:** a integral a pincel ao lado do nome, no ícone, na janela, no Guia e na página do celular. O nome é o mesmo nas duas línguas: **Summa**.
- **Ponte com o Ambitus:** com a Summa aberta, o Ambitus manda a página escrita à mão e recebe o texto de volta para a busca do caderno. Para ligar, use **Configurações → Recursos da mesa → Buscar também na escrita à mão** e um modelo pago com visão.
- **Página do Ambitus no chat:** a página aberta no Ambitus vira uma imagem de verdade na bandeja de anexos; o **Conferir** pede a página atual ao Ambitus, e o chat lateral também recebe a página, agora com clipe, bandeja e colar imagem.
- **Modo mini do tutor:** a conversa numa janela de 360×480, sempre por cima, para acompanhar a resolução no Xournal++ sem trocar de janela.
- **Chat lateral solto:** o botão **Trazer de volta à Mesa** e a faixa trazem a janela solta do chat de volta à coluna, e ela se comporta como o chat preso.
- **Sessão nova lembra o modelo:** a próxima sessão já vem com o último modelo e esforço usados.
- **Seletor de material:** os PDFs aparecem agrupados por subpasta (capítulos), com busca.
- **Busca na conversa:** **⌘F** (`Ctrl+F` no Windows) procura no PDF focado ou na conversa, e a conversa acompanha a resposta ao vivo.
- **Marcas no PDF:** o tutor pode circular, destacar e apontar trechos na leitura do PDF; as marcas ficam no histórico e na exportação.
- **Nota sugerida:** o tutor sugere a nota e só grava depois de **Guardar**; o cartão oferece **Descartar**.
- **Estatísticas:** intervalo personalizado no painel.
- **Ações do Anexar:** o clique direito fixa até duas ações na fileira da caixa de mensagem.
- **Sem internet:** o indicador e o Sobre mostram quando não há conexão.
- **Aviso de compactação:** quando o OpenCode compacta a conversa sozinho, a Summa avisa.
- **Conversa mais leve:** os anexos saem do arquivo da conversa, e o caderno do tutor fica guardado por conversa e vira chip na bolha.

### Melhorias

- **Instalação mais clara:** os textos batem com as versões reais (Node 22, OpenCode 2.2.7); no Windows, o setup explica a falta do Visual C++ Redistributable.
- **Atualização:** a instalação por zip registra a origem e se atualiza pelo zip; no Windows, a atualização espera os processos do Electron; o app instalado avisa que usa o runtime do clone.
- **Janela:** a Summa volta para a tela quando o monitor é desconectado; em janela baixa, o painel Contexto e a fala da primeira abertura continuam inteiros.
- **Primeira abertura:** fonte maior e a cena acompanha a altura. O passeio **Como funciona** para no primeiro clique ou tecla e não recomeça sozinho; os nomes das cores de acento aparecem inteiros; o resumo da pasta mostra o total de PDFs e a subpasta quando dois têm o mesmo nome.
- **Diagnóstico:** antes da primeira abertura, o `npm run doctor` marca como pendente o que só existe depois dela, em vez de dar erro.
- **Conferir no Linux:** com o Ambitus conectado, o Conferir pede a página pela ponte também no Linux.
- **Tutor:** o MCP da Summa religa sozinho quando cai no meio da sessão; a atividade aparece no ponto em que o tutor a enviou; a prévia sem erro publica o quadro na hora; o `ler_pdf` responde dentro do prazo.
- **OpenCode 2.2.7** e **Claude Code 2.1.325** testados; Node mínimo 22.
- **Relatar um problema:** sai do Mais opções do tutor para o menu **Ajustes**, a paleta e o rodapé do Guia, e continua montando o relatório limpo.
- **Ícone:** no macOS com ícones tingidos ou transparentes, o Dock e o ⌘Tab mostram o ícone do pacote, que o sistema tinge como os outros; e o desinstalador do Windows recusa com a Summa aberta.

### Correções

- **Fila:** o × e o Limpar mantêm o foco; a fila recuperada de uma entrega incerta não fica presa.
- **Busca:** o resultado não sai da vista depois do reflow.
- **Backup:** a restauração recusa o que a captura exclui, e a cópia própria do OpenCode fica fora do backup.
- **GeoGebra:** a sonda mantém uma cadeia só ao reabrir.
- **Exportação:** o nome do PDF no alt da conversa exportada é escapado.
- **OpenCode:** a conversa guarda a chamada da atividade antes de religar; o caminho no PowerShell só usa caracteres seguros e o comando permitido não aceita operadores de shell.
- **Updater:** sem manifesto, o updater não deriva a lista do disco; a instalação por zip leva o manifesto; o clone sujo é recusado com a contagem de arquivos e o Sobre explica.
- **Importação:** a prévia mostra a transcrição do pacote.
- **Setup:** lê o `opencodePath` do `config.json`; o doctor usa o diretório de dados da plataforma.
- **Notas:** o teto de três sugestões vale na sugestão, não no clique **Guardar**.
- **Modelo:** o seletor para no pé do cabeçalho do tutor.
- **Caderno no Windows:** quando o Xournal++ é um `.cmd`, a página é lida pelo `cmd.exe` em vez de falhar.

### O que ainda falta

- Quem instalou pelo clone do mesa-de-estudos precisa reinstalar uma vez pelo Summa.
- A leitura da escrita à mão no Ambitus precisa de um modelo pago com visão e fica desligada por padrão.
- No Windows, a instalação e a primeira conversa foram provadas numa conta limpa; o uso do dia a dia ainda foi testado à mão só no macOS.
- O instalador do Windows começa por `npm run install-app` num clone: ainda não há instalador gráfico para quem não tem Node.

Para quem já usa: **Sobre → Atualizar e reiniciar**. Quem clonou o mesa-de-estudos: reinstale pelo Summa.

## 1.2.0

A conversa pode ocupar a tela inteira, o login do OpenCode agora acontece dentro da Mesa e a leitura ficou do seu jeito. Nada precisa ser configurado de novo.

### Novidades

- **Chat na tela inteira:** o botão no cabeçalho do tutor, ou `⌘⇧E` (`Ctrl+Shift+E` no Windows), esconde as referências e centra a conversa. Ao voltar, PDF, página e zoom continuam como estavam.
- **Entrar na conta pelo app:** na primeira abertura e em Configurações → Pastas e programas, escolha o provedor e entre pelo navegador ou com a chave. O tutor religa sem reiniciar a Mesa.
- **Continuar conversa antiga com contexto:** a sessão antiga ganha **Continuar no OpenCode com o contexto**, sem reescrever o histórico.
- **Leitura do seu jeito:** em Configurações → Aparência e avisos, escolha o tamanho e a largura do texto do chat e o tom **Suave** da página escura do PDF. O texto vale na hora no tutor e no chat lateral.

### Melhorias

- **OpenCode já instalado:** a Mesa agora encontra a instalação feita por outros meios, como bun ou npm, e deixa você escolher o programa se ainda não achar.
- **PDF mais difícil:** o tutor gira, recorta e amplia a página antes de ler.
- **Anexo na fila:** colar ou soltar uma imagem durante a resposta entra na fila, como o texto.
- **Conversas longas:** o histórico e as fórmulas aparecem mais rápido; quando o espaço aperta, a conversa antiga perde a imagem antes do texto.
- **Caixa de mensagem:** o resumo do contexto foi para **Mais opções** e o campo do tutor fica fixo em três linhas.
- **Sobre:** mostra de onde o app se atualiza — Release oficial ou pasta de desenvolvimento.
- **Inglês:** os textos foram revisados e a busca, o copiar e os avisos acompanham a troca de idioma na hora.

### Correções

- **Limite do modelo grátis:** o aviso agora explica o que aconteceu e oferece a saída certa, uma vez só.
- **Relatar um problema:** o relato vai para o repositório público e volta a funcionar com o OpenCode 2 ou mais novo.
- **Links:** links `https` na resposta abrem pelo diálogo da Mesa, que mostra o destino.
- **Sessões:** **Parar** funciona do Enviar até o fim da resposta, conectar não bloqueia Ajustes, matéria e sessão, e uma sessão recusada não fica presa em “conectando”.
- **Erros do tutor:** fechou sozinho, login ou credencial aparecem em linguagem clara, e enviar sem rede avisa que falta conexão.
- **Primeira mensagem:** não aparece de novo no fim da resposta.
- **Citar:** o cursor volta para o fim da caixa de mensagem.
- **Zoom:** os atalhos valem para o leitor em que você está, sem mexer no outro.
- **Backup e GeoGebra:** uma falha no backup não é marcada como backup feito, e o GeoGebra não restaura duas vezes ao reabrir a aba.
- **Recuperação e atualização:** se a Mesa fechar no meio de uma resposta, você perde no máximo os últimos 8 segundos dela; a atualização não instala uma versão mais antiga nem deixa cópia para trás quando é recusada.

### O que ainda falta

- É preciso o OpenCode 2 ou mais novo.
- No macOS com ícones em preto e branco, o ícone da Mesa fica colorido enquanto ela está aberta.
- No Windows, esta versão passou só por testes automáticos.

Para quem já usa: **Sobre → Atualizar e reiniciar**.

## 1.1.0

A Mesa ganhou cara nova e o tutor agora funciona pelo OpenCode. Seus estudos continuam onde estavam.

### Antes de atualizar

- **O tutor passa a usar o OpenCode**, no lugar do Pi e do Claude Code. A Mesa instala o programa para você. Depois, é só entrar na conta do modelo que você usa, uma vez só. As contas do Pi não vêm junto.
- **Matérias, PDFs, caderno e progresso ficam como estão.** As sessões antigas continuam abertas para leitura; para seguir o assunto, comece uma sessão nova.
- **No macOS**, o sistema pode pedir de novo a permissão de Gravação de Tela para o Conferir.

### Novidades

- **Luminária:** o novo ícone do app, que acompanha a sua cor de acento enquanto a Mesa está aberta. Quando o tutor pensa, a luminária aparece acesa na conversa.
- **Primeira abertura:** a luz da luminária acende aos poucos a cada passo, e a configuração inicial ficou mais direta, com o detalhe no Guia.
- **Quiz e perguntas em cartões:** o tutor pergunta sem prender a conversa.
- **Cartões de revisão propostos pelo tutor:** só entram no caderno depois que você aprova.
- **PDF solto na conversa:** anexe um PDF e o tutor consegue ler.
- **Modelo padrão:** escolha qual modelo já vem em cada sessão nova.
- **Fila de mensagens:** uma mensagem na fila pode interromper o tutor e ser enviada na hora.

### Melhorias

- **Menos texto na tela:** configurações, diálogos e estados vazios ficaram mais enxutos, e as explicações foram para o Guia.
- **Caixa de mensagem nova:** encostada na coluna, com menos controles, e alinhada entre o tutor e o chat lateral.
- **Visual:** cinzas neutros, novas superfícies e o texto da conversa maior e mais espaçado.
- **Conversa:** segue a resposta até o fim sem puxar quem rolou para cima, e os desenhos em SVG do tutor aparecem como figura.
- **Leitor de PDF:** navegação por páginas e numeração impressa nas Configurações.

### Segurança

- **Atualizações assinadas:** a Mesa só aplica uma versão com assinatura válida e confere o arquivo antes de instalar.
- **Tutor só com as ferramentas da Mesa:** ele não roda comandos no seu computador nem usa as ferramentas nativas do motor.
- **Links de atividade:** mostram o destino antes de abrir o navegador.
- **Pacote de estudo:** agora leva as conversas do OpenCode, e uma sessão do Pi importada não volta retomável com histórico de terceiros.

### O que ainda falta

- Quem instalou o OpenCode por `bun` ou `npm` pode ver o aviso de que ele não está instalado.
- No macOS com ícones em preto e branco, o ícone da Mesa fica colorido enquanto ela está aberta.
- É preciso o OpenCode 2 ou mais novo.
- No Windows, esta versão passou só por testes automáticos.

Para quem já usa: **Sobre → Atualizar e reiniciar**.
