'use strict';

/* Fonte do Electron para o teste de `user-data.cjs` (#137/#190): depois do
   `app.setName('Summa')` e sem `app.setPath`, imprime a pasta que o app usa
   (`electronUserData`, a mesma conta do main.cjs) e sai sem abrir janela (não
   depende de DISPLAY). O teste compara com `userDataDirectory`. */

const {app} = require('electron');
const {electronUserData} = require('../../user-data.cjs');
app.setName('Summa');
console.log(`__USERDATA__${electronUserData(app)}`);
process.exit(0);
