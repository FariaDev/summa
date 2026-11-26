/* busca-binaria.roteiro.js: o que o MODELO escreve para um roteiro.
   O algoritmo de verdade, com chamadas ao kit onde o aluno deve poder parar
   (k.linha). Cores, tamanhos, posições e animação são do kit. */
const BUSCA_BINARIA = {
  titulo: 'Busca binária',
  linguagem: 'JavaScript',
  arquivo: 'busca-binaria.roteiro.js',
  codigo: [
    'function buscaBinaria(a, alvo) {',
    '  let lo = 0, hi = a.length - 1;',
    '  while (lo <= hi) {',
    '    const mid = Math.floor((lo + hi) / 2);',
    '    if (a[mid] === alvo) return mid;',
    '    if (a[mid] < alvo) lo = mid + 1;',
    '    else hi = mid - 1;',
    '  }',
    '  return -1;',
    '}',
  ],
  entradas: {alvo: {valor: '23', rotulo: 'alvo'}},
  roteiro(k, {alvo}) {
    const a = [2, 5, 8, 12, 16, 23, 38, 56, 72, 91], x = Number(alvo);
    const V = k.vetor('a', a);
    let lo = 0, hi = a.length - 1, mid = null;
    const vars = () => ({lo, hi, mid, 'a[mid]': mid === null ? null : a[mid]});
    const mostrar = () => { V.faixa(lo, hi); V.ponteiros(mid === null ? {lo, hi} : {lo, mid, hi}); };
    mostrar();
    k.linha(2, 'Começa olhando o vetor inteiro.', vars());
    while (true) {
      k.linha(3, lo <= hi ? `lo ≤ hi (${lo} ≤ ${hi}): ainda há onde procurar.` : `lo > hi (${lo} > ${hi}): o intervalo acabou.`, vars());
      if (lo > hi) break;
      mid = Math.floor((lo + hi) / 2);
      V.limpar(); V.marcar(mid, 'atual'); mostrar();
      k.linha(4, `mid é o meio de [${lo}, ${hi}]: ${mid}.`, vars());
      if (a[mid] === x) {
        V.marcar(mid, 'achado');
        k.linha(5, `a[${mid}] = ${a[mid]} é o alvo. Devolve ${mid}.`, vars());
        return;
      }
      k.linha(5, `a[${mid}] = ${a[mid]} não é ${x}.`, vars());
      if (a[mid] < x) { lo = mid + 1; mostrar(); k.linha(6, `${a[mid]} < ${x}: tudo até ${mid} sai. lo vira ${lo}.`, vars()); }
      else { hi = mid - 1; mostrar(); k.linha(7, `${a[mid]} > ${x}: tudo de ${mid} em diante sai. hi vira ${hi}.`, vars()); }
    }
    V.limpar();
    k.linha(9, `${x} não está no vetor. Devolve −1.`, vars());
  },
};
