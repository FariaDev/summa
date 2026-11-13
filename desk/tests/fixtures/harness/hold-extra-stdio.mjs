/* Segura os fds 3 e 4 do pai num neto, como os filhos do Chromium no Windows
   (#165): o processo do teste sai, mas as pontas de escrita dos cinco pipes do
   Playwright continuam abertas. Imprime o pid do neto para o teste matá-lo. */
import {spawn} from 'node:child_process';

/* `stdio: 'inherit'` só herda 0–2; os fds 3/4 precisam ser listados. */
const grand = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)'], {stdio: [0, 1, 2, 3, 4]});
process.stdout.write(String(grand.pid));
setTimeout(() => process.exit(0), 50);
