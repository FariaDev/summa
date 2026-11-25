// Tudo o que a demo escreve em português: PDFs, matérias, respostas do tutor e
// rótulos. A estrutura é a mesma de content-en.js; main.js escolhe pelo lang.
const m = (t) => `<span class="m">${t}</span>`;

export default {
  decimal: ',',
  docs: {
    lista: {name: 'lista-derivadas.pdf', n: '1 / 2', html: `<h4>Lista de exercícios</h4><p class="sub">Cálculo I · Derivadas</p><ol>
  <li><mark id="q1">Calcule a derivada de f(x) = x³ − 3x² + 4.</mark></li><li>Derive g(x) = sen(x)·cos(x) usando a regra do produto.</li>
  <li>Encontre a reta tangente a y = x³ no ponto (2, 8).</li><li>Use a regra da cadeia em h(x) = (2x + 1)⁵.</li><li>Calcule a derivada de y = ln(x² + 1).</li></ol>`},
    form: {name: 'formulario-derivadas.pdf', n: '1 / 1', html: `<h4>Formulário</h4><p class="sub">Derivadas</p><h5>Regras básicas</h5>
  <p><mark id="tombo">(xⁿ)′ = n xⁿ⁻¹</mark></p><p>(sen x)′ = cos x</p><p>(cos x)′ = −sen x</p><p>(eˣ)′ = eˣ</p><p>(ln x)′ = 1/x</p>
  <h5>Regras de combinação</h5><p>(f + g)′ = f′ + g′</p><p>(fg)′ = f′g + fg′</p><p>(f/g)′ = (f′g − fg′)/g²</p>`},
    cine: {name: 'lista-cinematica.pdf', n: '1 / 1', html: `<h4>Lista 1</h4><p class="sub">Física I · Cinemática</p><ol><li><mark id="c1">Um carro parte do repouso com a = 2 m/s². Qual a velocidade após 5 s?</mark></li><li>Uma bola é lançada para cima a 20 m/s. Qual a altura máxima?</li><li>Esboce v(t) para s(t) = t³ − 6t² + 9t.</li></ol>`},
    form2: {name: 'formulario-cinematica.pdf', n: '1 / 1', html: `<h4>Formulário</h4><p class="sub">Cinemática</p><h5>MRUV</h5><p><mark id="mruv">v = v₀ + a t</mark></p><p>s = s₀ + v₀t + at²/2</p><p>v² = v₀² + 2aΔs</p><h5>Unidades (SI)</h5><p>a: m/s² · t: s · v: m/s</p>`},
    none: {name: 'Sem PDF', n: '', html: '', blank: 'Arraste um PDF para cá.'},
  },
  // Cada matéria tem a própria conversa e a própria folha; `first` é a tentativa
  // com o erro e `fix` a correção que o aluno escreve depois da primeira resposta.
  courses: {
    calc1: {docs: ['lista', 'form'], xopp: 'derivadas.xopp', sub: 'Cálculo I', first: "f'(x) = 3x² - 3x", fix: "f'(x) = 3x² - 6x",
      empty: 'Escreva no Xournal++ e aperte Conferir.', replies: [
        {title: 'Conferir a derivada de f(x)', sub: 'lista-derivadas.pdf, p. 1 +1', user: 'Confere o 1?', reads: 'Lendo lista-derivadas.pdf, p. 1', blocks: [
          `<p><b>Quase.</b> O primeiro termo está certo, e a constante some mesmo. Olhe de novo o termo do meio, ${m('−3x')}², com a regra do tombo (<button class="pdf-ref" data-ref="tombo" data-doc="form">formulario-derivadas.pdf, p. 1</button>):</p>`,
          `<div class="disp"><span class="frac"><span>d</span><span>dx</span></span><span>(<i>x</i><sup>n</sup>) = <i>n</i><i>x</i><sup><i>n</i>−1</sup></span></div>`,
          `<p>O expoente desce e <b>multiplica</b> o coeficiente. Quanto dá ${m('−3x')}² agora?</p>`]},
        {title: 'Conferir a derivada de f(x)', sub: 'lista-derivadas.pdf, p. 1 +1', user: 'E agora?', reads: 'Lendo a página 1', blocks: [
          `<p><b>Isso.</b> ${m('f′')}(${m('x')}) = 3${m('x')}² − 6${m('x')}. O 2 do expoente desceu e multiplicou o −3.</p>`,
          `<p>Quer ver onde a tangente fica horizontal? Abra o <button class="pdf-ref" data-go="ggb">GeoGebra</button> e passe o mouse na curva.</p>`]}]},
    fis1: {docs: ['cine', 'form2'], xopp: 'cinematica.xopp', sub: 'Física I', first: 'v = 2 · 5 = 10', fix: 'v = 10 m/s',
      empty: 'Escreva no Xournal++ e aperte Conferir.', replies: [
        {title: 'Velocidade do carro após 5 s', sub: 'lista-cinematica.pdf, p. 1 +1', user: 'Confere o 1?', reads: 'Lendo lista-cinematica.pdf, p. 1', blocks: [
          `<p><b>Quase.</b> A conta está certa: parte do repouso, então ${m('v')} = ${m('a t')} (<button class="pdf-ref" data-ref="mruv" data-doc="form2">formulario-cinematica.pdf, p. 1</button>).</p>`,
          `<p>Só falta uma coisa no 10. A aceleração está em m/s² e o tempo em s. Em que unidade fica ${m('v')}?</p>`]},
        {title: 'Velocidade do carro após 5 s', sub: 'lista-cinematica.pdf, p. 1 +1', user: 'E agora?', reads: 'Lendo a página 1', blocks: [
          `<p><b>Isso.</b> ${m('v')} = 10 m/s: m/s² vezes s dá m/s.</p>`,
          `<p>Na 2, a bola sobe até a velocidade chegar a zero. Comece por aí.</p>`]}]},
    livre: {docs: ['none', 'none'], xopp: 'rascunho.xopp', sub: 'Livre', first: null,
      empty: 'Estudo avulso, sem matéria. Pergunte ou confira uma página.', replies: [
        {title: 'Conferir rascunho', sub: 'rascunho.xopp', user: 'Confere?', reads: 'Lendo a página 1', repeat: true, blocks: [
          '<p>A página está em branco. Escreva a sua tentativa no Xournal++ e confira de novo.</p>']}]},
  },
  // O que a folha mostra muda a resposta: tentativa apagada, ou rabisco no Livre.
  sheet: {
    user: 'Confere?', reads: 'Lendo a página 1',
    erased: '<p>Não achei a sua tentativa na página 1: parte dela foi apagada. Escreva de novo, ou desfaça com <kbd>Ctrl</kbd> <kbd>Z</kbd>, e confira.</p>',
    scribbleTitle: 'Conferir rascunho', scribbleSub: 'rascunho.xopp',
    scribble: '<p>Vi o seu rascunho. Nesta demo eu só leio as listas de Cálculo I e Física I; na Summa, confiro o que você escrever.</p>',
  },
  cards: {
    'calc1:0': ['Regra do tombo no termo do meio', 'Cálculo I'], 'calc1:1': ['Derivada de x³ − 3x² + 4', 'Cálculo I'],
    'fis1:0': ['Unidade da velocidade no MRUV', 'Física I'], 'fis1:1': ['Velocidade após 5 s', 'Física I'], 'livre:0': ['Rascunho', 'Livre'],
  },
  commands: {
    check: 'Conferir a página do Xournal++', caderno: 'Abrir o Caderno', ggb: 'Abrir o GeoGebra',
    calc1: 'Ir para Cálculo I', fis1: 'Ir para Física I', mini: 'Modo mini',
    theme: 'Alternar tema claro e escuro', violet: 'Acento violeta', graphite: 'Acento grafite', reset: 'Nova conversa',
  },
  text: {
    newChat: 'Nova conversa',
    demoEnd: 'A demo acaba aqui. Na Summa, a conversa continua.',
    worked: 'Trabalhou por 1s · 1 leitura',
    page: 'p. 1',
    freeAsk: '<p>Na demo eu só confiro a folha. Escreva no Xournal++ ao lado e aperte <b>Conferir</b>; na Summa, pergunte o que quiser.</p>',
    save: 'Guardar no Caderno', retry: 'Tentar de novo',
    cadernoTitle: 'Caderno', cadernoEmpty: 'Nada guardado ainda. Guarde uma resposta do tutor pelo marcador.',
    review: 'Revisar hoje', today: 'Hoje',
    themeToLight: 'Tema claro', themeToDark: 'Tema escuro',
    miniOn: 'Modo mini', miniOff: 'Sair do modo mini',
    downloadFor: 'Baixar para', copy: 'Copiar',
    sendToComputer: 'Mandar para o computador', sendShort: 'Mandar', linkCopied: 'Link copiado',
    mobileNote: 'A Summa roda no macOS, no Windows e no Linux. A demo abaixo funciona aqui.',
  },
  picker: {
    policy: {zero: 'Não guarda nem treina', improve: 'Pode usar para treinar', trial: 'Só teste: não mande dados pessoais'},
    effort: {default: 'Padrão do OpenCode', low: 'Baixo', medium: 'Médio', high: 'Alto'},
    recent: 'Recentes', favorites: 'Favoritos', defaultBadge: 'Padrão',
    favorite: 'Favoritar', unfavorite: 'Tirar dos favoritos', setDefault: 'Usar como padrão', unsetDefault: 'Desfazer padrão',
    none: (q) => `Nenhum modelo com “${q}”.`,
  },
};
