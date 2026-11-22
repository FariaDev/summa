'use strict';

const {EventEmitter} = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function fakeOpenCodeExtract(version) {
  const bytes = Buffer.from('pacote verificado');
  const integrity = 'sha512-' + crypto.createHash('sha512').update(bytes).digest('base64');
  const commands = [];
  async function fetchImpl(url) {
    if (url === 'https://example.test/opencode.tgz') {
      return {ok: true, headers: {get: () => String(bytes.length)}, body: [bytes]};
    }
    return {ok: true, status: 200, json: async () => ({dist: {integrity, tarball: 'https://example.test/opencode.tgz'}})};
  }
  function spawnProcess(file, args) {
    commands.push({file, args});
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stdout.setEncoding = () => {};
    child.kill = () => {};
    setImmediate(() => {
      if (args[0] === '-xzf') {
        const bin = path.join(args[3], 'package', 'bin');
        fs.mkdirSync(bin, {recursive: true});
        fs.writeFileSync(path.join(bin, 'opencode.exe'), 'exe');
      } else child.stdout.emit('data', version);
      child.emit('close', 0);
    });
    return child;
  }
  return {commands, fetchImpl, spawnProcess};
}

module.exports = {fakeOpenCodeExtract};
