/* arvore-busca.roteiro.js: inserção recursiva numa árvore de busca, com a
   pilha de chamadas. Escrito pelo MODELO; só conteúdo e pontos de parada. */
const ARVORE_BUSCA = {
  titulo: 'Árvore de busca: inserir',
  linguagem: 'JavaScript',
  arquivo: 'arvore-busca.roteiro.js',
  codigo: [
    'function inserir(no, v) {',
    '  if (no === null) return novoNo(v);',
    '  if (v < no.v) no.esq = inserir(no.esq, v);',
    '  else no.dir = inserir(no.dir, v);',
    '  return no;',
    '}',
  ],
  entradas: {valores: {valor: '50 30 70 20 40 60 45', rotulo: 'valores'}},
  roteiro(k, {valores}) {
    const T = k.arvore('árvore'), P = k.pilha('chamadas');
    function inserir(no, v, pai, lado) {
      P.empilhar(`inserir(${no ? no.v : 'null'}, ${v})`);
      if (no === null) {
        const id = pai ? T.filho(pai.id, lado, v) : T.raiz(v);
        T.marcar(id, 'novo');
        k.linha(2, pai ? `Lugar vazio à ${lado === 'esq' ? 'esquerda' : 'direita'} de ${pai.v}: ${v} entra aqui.` : `Árvore vazia: ${v} vira a raiz.`, {v, 'no.v': null});
        P.desempilhar();
        return {v, id, esq: null, dir: null};
      }
      T.marcar(no.id, 'atual');
      const esq = v < no.v;
      k.linha(esq ? 3 : 4, `${v} ${esq ? '<' : '≥'} ${no.v}: desce para a ${esq ? 'esquerda' : 'direita'}.`, {v, 'no.v': no.v});
      if (esq) no.esq = inserir(no.esq, v, no, 'esq');
      else no.dir = inserir(no.dir, v, no, 'dir');
      T.marcar(no.id, 'atual');
      k.linha(5, `De volta em ${no.v}: a chamada de baixo terminou e esta devolve o próprio nó.`, {v, 'no.v': no.v});
      P.desempilhar();
      return no;
    }
    let raiz = null;
    for (const v of valores.trim().split(/\s+/).map(Number)) {
      T.limpar();
      k.marco(`inserir ${v}`);
      raiz = inserir(raiz, v, null, null);
    }
  },
};
