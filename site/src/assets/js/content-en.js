// Everything the demo writes in English. Same shape as content-pt.js.
const m = (t) => `<span class="m">${t}</span>`;

export default {
  decimal: '.',
  docs: {
    lista: {name: 'derivatives-problems.pdf', n: '1 / 2', html: `<h4>Problem set</h4><p class="sub">Calculus I · Derivatives</p><ol>
  <li><mark id="q1">Find the derivative of f(x) = x³ − 3x² + 4.</mark></li><li>Differentiate g(x) = sin(x)·cos(x) with the product rule.</li>
  <li>Find the tangent line to y = x³ at (2, 8).</li><li>Use the chain rule on h(x) = (2x + 1)⁵.</li><li>Find the derivative of y = ln(x² + 1).</li></ol>`},
    form: {name: 'derivatives-formulas.pdf', n: '1 / 1', html: `<h4>Formula sheet</h4><p class="sub">Derivatives</p><h5>Basic rules</h5>
  <p><mark id="tombo">(xⁿ)′ = n xⁿ⁻¹</mark></p><p>(sin x)′ = cos x</p><p>(cos x)′ = −sin x</p><p>(eˣ)′ = eˣ</p><p>(ln x)′ = 1/x</p>
  <h5>Combination rules</h5><p>(f + g)′ = f′ + g′</p><p>(fg)′ = f′g + fg′</p><p>(f/g)′ = (f′g − fg′)/g²</p>`},
    cine: {name: 'kinematics-problems.pdf', n: '1 / 1', html: `<h4>Problem set 1</h4><p class="sub">Physics I · Kinematics</p><ol><li><mark id="c1">A car starts from rest with a = 2 m/s². What is its speed after 5 s?</mark></li><li>A ball is thrown up at 20 m/s. What is its maximum height?</li><li>Sketch v(t) for s(t) = t³ − 6t² + 9t.</li></ol>`},
    form2: {name: 'kinematics-formulas.pdf', n: '1 / 1', html: `<h4>Formula sheet</h4><p class="sub">Kinematics</p><h5>Constant acceleration</h5><p><mark id="mruv">v = v₀ + a t</mark></p><p>s = s₀ + v₀t + at²/2</p><p>v² = v₀² + 2aΔs</p><h5>Units (SI)</h5><p>a: m/s² · t: s · v: m/s</p>`},
    none: {name: 'No PDF', n: '', html: '', blank: 'Drop a PDF here.'},
  },
  courses: {
    calc1: {docs: ['lista', 'form'], xopp: 'derivatives.xopp', sub: 'Calculus I', first: "f'(x) = 3x² - 3x", fix: "f'(x) = 3x² - 6x",
      empty: 'Write in Xournal++ and press Check.', replies: [
        {title: 'Check the derivative of f(x)', sub: 'derivatives-problems.pdf, p. 1 +1', user: 'Is 1 right?', reads: 'Reading derivatives-problems.pdf, p. 1', blocks: [
          `<p><b>Almost.</b> The first term is right, and the constant does vanish. Look again at the middle term, ${m('−3x')}², with the power rule (<button class="pdf-ref" data-ref="tombo" data-doc="form">derivatives-formulas.pdf, p. 1</button>):</p>`,
          `<div class="disp"><span class="frac"><span>d</span><span>dx</span></span><span>(<i>x</i><sup>n</sup>) = <i>n</i><i>x</i><sup><i>n</i>−1</sup></span></div>`,
          `<p>The exponent comes down and <b>multiplies</b> the coefficient. What does ${m('−3x')}² give now?</p>`]},
        {title: 'Check the derivative of f(x)', sub: 'derivatives-problems.pdf, p. 1 +1', user: 'How about now?', reads: 'Reading page 1', blocks: [
          `<p><b>That’s it.</b> ${m('f′')}(${m('x')}) = 3${m('x')}² − 6${m('x')}. The exponent 2 came down and multiplied the −3.</p>`,
          `<p>Want to see where the tangent is horizontal? Open <button class="pdf-ref" data-go="ggb">GeoGebra</button> and hover over the curve.</p>`]}]},
    fis1: {docs: ['cine', 'form2'], xopp: 'kinematics.xopp', sub: 'Physics I', first: 'v = 2 · 5 = 10', fix: 'v = 10 m/s',
      empty: 'Write in Xournal++ and press Check.', replies: [
        {title: 'Speed of the car after 5 s', sub: 'kinematics-problems.pdf, p. 1 +1', user: 'Is 1 right?', reads: 'Reading kinematics-problems.pdf, p. 1', blocks: [
          `<p><b>Almost.</b> The arithmetic is right: it starts from rest, so ${m('v')} = ${m('a t')} (<button class="pdf-ref" data-ref="mruv" data-doc="form2">kinematics-formulas.pdf, p. 1</button>).</p>`,
          `<p>The 10 is missing one thing. Acceleration is in m/s² and time in s. What unit does ${m('v')} end up in?</p>`]},
        {title: 'Speed of the car after 5 s', sub: 'kinematics-problems.pdf, p. 1 +1', user: 'How about now?', reads: 'Reading page 1', blocks: [
          `<p><b>That’s it.</b> ${m('v')} = 10 m/s: m/s² times s gives m/s.</p>`,
          `<p>In 2, the ball rises until its speed reaches zero. Start there.</p>`]}]},
    livre: {docs: ['none', 'none'], xopp: 'scratch.xopp', sub: 'Free', first: null,
      empty: 'Free study, no course. Ask, or check a page.', replies: [
        {title: 'Check scratch page', sub: 'scratch.xopp', user: 'Is this right?', reads: 'Reading page 1', repeat: true, blocks: [
          '<p>The page is blank. Write your attempt in Xournal++ and check again.</p>']}]},
  },
  sheet: {
    user: 'Is this right?', reads: 'Reading page 1',
    erased: '<p>I couldn’t find your attempt on page 1: part of it was erased. Write it again, or undo with <kbd>Ctrl</kbd> <kbd>Z</kbd>, and check.</p>',
    scribbleTitle: 'Check scratch page', scribbleSub: 'scratch.xopp',
    scribble: '<p>I see your scratch work. In this demo I only read the Calculus I and Physics I problems; in Summa, I check whatever you write.</p>',
  },
  cards: {
    'calc1:0': ['Power rule on the middle term', 'Calculus I'], 'calc1:1': ['Derivative of x³ − 3x² + 4', 'Calculus I'],
    'fis1:0': ['Unit of speed under constant acceleration', 'Physics I'], 'fis1:1': ['Speed after 5 s', 'Physics I'], 'livre:0': ['Scratch page', 'Free'],
  },
  commands: {
    check: 'Check the Xournal++ page', caderno: 'Open Notebook', ggb: 'Open GeoGebra',
    calc1: 'Go to Calculus I', fis1: 'Go to Physics I', mini: 'Mini mode',
    theme: 'Toggle light and dark theme', violet: 'Violet accent', graphite: 'Graphite accent', reset: 'New conversation',
  },
  text: {
    newChat: 'New conversation',
    demoEnd: 'The demo ends here. In Summa, the conversation goes on.',
    worked: 'Worked for 1s · 1 read',
    page: 'p. 1',
    freeAsk: '<p>In the demo I only check the page. Write in Xournal++ beside this and press <b>Check</b>; in Summa, ask anything.</p>',
    save: 'Save to Notebook', retry: 'Try again',
    cadernoTitle: 'Notebook', cadernoEmpty: 'Nothing saved yet. Save a tutor reply with the bookmark.',
    review: 'Review today', today: 'Today',
    themeToLight: 'Light theme', themeToDark: 'Dark theme',
    miniOn: 'Mini mode', miniOff: 'Leave mini mode',
    downloadFor: 'Download for', copy: 'Copy',
    sendToComputer: 'Send to my computer', sendShort: 'Send', linkCopied: 'Link copied',
    mobileNote: 'Summa runs on macOS, Windows and Linux. The demo below works here.',
  },
  picker: {
    policy: {zero: 'Does not store or train', improve: 'May be used for training', trial: 'Trial only: do not send personal data'},
    effort: {default: 'OpenCode default', low: 'Low', medium: 'Medium', high: 'High'},
    recent: 'Recent', favorites: 'Favorites', defaultBadge: 'Default',
    favorite: 'Favorite', unfavorite: 'Remove from favorites', setDefault: 'Use as default', unsetDefault: 'Clear default',
    none: (q) => `No model matches “${q}”.`,
  },
};
