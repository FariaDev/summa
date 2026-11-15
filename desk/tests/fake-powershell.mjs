/* Fake nomeado do PowerShell da instalação do Windows (#181). O teste de
   unidade o passa por parâmetro; os scripts ficam guardados para conferir
   caminhos, aspas e valores da chave sem chamar powershell.exe no Linux. */
export function fakePowerShell({fail = false} = {}) {
  const scripts = [];
  return {
    scripts,
    run(script) {
      if (fail) throw Error('powershell recusou o script');
      scripts.push(script);
    },
  };
}
