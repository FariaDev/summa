/** IPC do Sobre com resultado persistido e checagem que oferece nova versão. */
export function fakeAboutUpdate(result){
 const checks=[];
 return {checks,desk:{
  async updateResult(){return result;},
  async updateOrigin(){return {kind:'normal'};},
  async updateCheck(options){checks.push(options);return {status:'update',version:'1.3.3'};},
 }};
}
