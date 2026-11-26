/* pitagoras.desenho.js: o que o MODELO escreve para um desenho narrado.
   Sem tempos, sem cores literais e sem tamanhos em px para o texto: só a
   ordem, os pontos, as palavras e a narração. O kit (quadro-kit-desenho.js)
   decide o ritmo da caneta, as cores pelos tokens e o tamanho das letras, então
   dois modelos diferentes entregam desenhos com a mesma cara. */
const PITAGORAS = {
  titulo: 'Teorema de Pitágoras',
  roteiro(k) {
    const u = 28, a = 3 * u, b = 4 * u, s = a + b;     // a = 3, b = 4, c = 5
    const C = [150, 230], A = [150, 146], B = [262, 230];
    const P = (x, y) => [440 + x, 60 + y];               // canto do quadrado grande

    k.passo('O triângulo', 'Um triângulo retângulo. O canto marcado é o ângulo reto.');
    k.traco([C, A], {nome:'o cateto a'});
    k.traco([C, B], {nome:'o cateto b'});
    k.traco([A, B], {nome:'a hipotenusa c'});
    k.traco([[150, 216], [164, 216], [164, 230]], {fino:true, nome:'o ângulo reto'});

    k.passo('Os lados', 'Os dois lados que formam o ângulo reto são os catetos, a e b. O lado oposto, o maior, é a hipotenusa c.');
    k.escrever([157, 188], 'a', {ancora:'inicio'});
    k.escrever([206, 214], 'b');
    k.escrever([219, 175], 'c');

    k.passo('Os quadrados', 'Sobre cada lado, um quadrado. Com a = 3, b = 4 e c = 5 dá para contar os quadradinhos: 9, 16 e 25.');
    [[[66, 146], [a, 0], [0, a], 3, 1, 'a²'], [C, [b, 0], [0, b], 4, 2, 'b²'], [A, [b, a], [a, -b], 5, 3, 'c²']].forEach(([o, du, dv, n, cor, rotulo]) => {
      const q = k.quadrado(o, du, dv);
      k.traco(q.pts, {fechado:true, nome:`o quadrado sobre ${rotulo[0]}`});
      k.preencher(q, {cor, malha:n});
      k.escrever(q.centro, rotulo, {tam:'grande'});
    });

    k.passo('A pergunta', '9 + 16 = 25: os dois quadrados menores juntos têm a área do maior. Mas isso vale para todo triângulo retângulo?');
    k.escrever([18, 291], '9 + 16 = 25', {ancora:'inicio', marca:'conta'});
    k.escrever([18, 329], 'sempre?', {ancora:'inicio', cor:'destaque'});

    k.passo('Quatro cópias', 'Num quadrado de lado a + b cabem quatro cópias do triângulo. O que sobra no meio é um quadrado de lado c, de área c².');
    k.traco([P(0, 0), P(s, 0), P(s, s), P(0, s)], {fechado:true, nome:'o quadrado de lado a + b'});
    const tris = [[[0, 0], 0], [[s, 0], 90], [[s, s], 180], [[0, s], -90]].map(([R, giro], i) => {
      const g = k.grupo({frente:true});
      const pts = [P(...R), P(...k.soma(R, k.dir(giro), a)), P(...k.soma(R, k.dir(giro + 90), b))];
      k.traco(pts, {fechado:true, em:g, nome:`o triângulo ${i + 1}`});
      k.preencher({pts}, {cor:'neutro', em:g});
      return g;
    });
    const sobra = k.quadrado(P(a, 0), [b, a], [-a, b]);
    const sobraArea = k.preencher(sobra, {cor:3, malha:5});
    const sobraRotulo = k.escrever(sobra.centro, 'c²', {tam:'grande', marca:'sobra-c'});
    k.traco([P(a, -7), P(a, 7)], {fino:true});
    k.escrever([440 + a / 2, 40], 'a', {tam:'pequeno'});
    k.escrever([440 + a + b / 2, 40], 'b', {tam:'pequeno'});

    k.passo('Rearranjar', 'Agora só deslizamos três das peças, sem girar nem esticar. O quadrado grande é o mesmo e os triângulos também, então a sobra tem a mesma área.');
    k.junto(() => { k.sumir(sobraArea); k.sumir(sobraRotulo); });
    k.mover([[tris[0], [0, a]], [tris[2], [-b, 0]], [tris[3], [a, -b]]], {nome:'3 dos 4 triângulos', marca:'deslize'});
    const qa = k.quadrado(P(0, 0), [a, 0], [0, a]), qb = k.quadrado(P(a, a), [b, 0], [0, b]);
    k.preencher(qa, {cor:1, malha:3});
    k.escrever(qa.centro, 'a²', {tam:'grande'});
    k.preencher(qb, {cor:2, malha:4});
    k.escrever(qb.centro, 'b²', {tam:'grande', marca:'sobra-ab'});

    k.passo('A conclusão', 'Antes a sobra era c², agora é a² + b². É a mesma área, então a² + b² = c² em qualquer triângulo retângulo.');
    k.escrever([440 + s / 2, 303], 'a² + b² = c²', {tam:'titulo', cor:'destaque', marca:'conclusao'});
    k.traco([[446, 330], [538, 333], [630, 328]], {cor:'destaque'});
  },
};
