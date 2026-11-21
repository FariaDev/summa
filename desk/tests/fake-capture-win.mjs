import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const run = promisify(execFile);
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200)]);

/** Simulates a PowerShell exit status.
 * @param {number} code exit status; e.g. captureExitExec(6) rejects rendering.
 * @returns {() => Promise<never>} runner that fails without external I/O.
 */
export function captureExitExec(code) {
  return async () => { throw Object.assign(Error(`exit ${code}`), {code}); };
}

/** Confere o arquivo entregue ao PowerShell; ex.: captureScriptExec('capture.ps1'). */
export function captureScriptExec(filename, realPowerShell = false) {
  return async (cmd, args, options) => {
    const scriptPath = args.at(-1);
    assert.equal(path.basename(scriptPath), filename);
    const bytes = fs.readFileSync(scriptPath);
    const script = bytes.toString('utf8');
    const outFile = path.join(path.dirname(scriptPath), 'attempt.png');
    if (filename === 'capture.ps1') assert.ok(script.includes(outFile));
    if (realPowerShell) {
      /* Mantém a codificação recebida: o PS 5.1 precisa preservar José no literal. */
      const bom = script.startsWith('\uFEFF') ? '\uFEFF' : '';
      fs.writeFileSync(scriptPath, `${bom}$ErrorActionPreference='Stop'\nSet-Content -LiteralPath '${outFile.replaceAll("'", "''")}' -Value 'ok'`);
      await run(cmd, args, options);
      assert.equal(fs.readFileSync(outFile, 'utf8').trim(), 'ok');
    } else {
      assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
    }
    if (filename === 'capture.ps1') fs.writeFileSync(outFile, png);
    return {stdout: filename === 'list.ps1' ? '[]' : 'Notepad'};
  };
}
