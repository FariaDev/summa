import test from 'node:test';
import assert from 'node:assert/strict';
import {fakePeInstaller} from './fake-pe-installer.mjs';

test('identidade PE32 e PE32+ vem do recurso de versao', async () => {
  const {assertInstallerIdentity} = await import('../scripts/installer-identity.mjs');
  for (const pe64 of [false, true]) {
    assertInstallerIdentity(fakePeInstaller({version:'1.2.3',commit:'a'.repeat(40),pe64}), {version:'1.2.3',commit:'a'.repeat(40)});
  }
});

test('recusa PE vazio, texto, truncado e offsets fora do arquivo', async () => {
  const {assertInstallerIdentity} = await import('../scripts/installer-identity.mjs');
  const broken = fakePeInstaller({}); broken.writeUInt32LE(0xfffffff0, 0x3c);
  for (const bytes of [Buffer.alloc(0),Buffer.from('texto'),fakePeInstaller({}).subarray(0,200),broken]) {
    assert.throws(()=>assertInstallerIdentity(bytes,{version:'0.1.0',commit:'a'.repeat(40)}),/identidade.*recebido.*esperado/);
  }
});

test('recusa versao ou commit incorreto mesmo quando o arquivo foi renomeado', async () => {
  const {assertInstallerIdentity} = await import('../scripts/installer-identity.mjs');
  const expected = {version:'1.2.3',commit:'a'.repeat(40)};
  assert.throws(()=>assertInstallerIdentity(fakePeInstaller({version:'1.2.2'}),expected),/1\.2\.2.*1\.2\.3/);
  assert.throws(()=>assertInstallerIdentity(fakePeInstaller({version:'1.2.3',commit:'b'.repeat(40)}),expected),/bbbb.*aaaa/);
  const spoof = fakePeInstaller({version:'1.2.3'});
  spoof.writeUInt32LE(2 * 65536, 0x400 + 40 + 20);
  assert.throws(()=>assertInstallerIdentity(spoof,expected));
});
