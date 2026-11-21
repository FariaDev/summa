import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {seedRuntime, cleanup} from './study-backup-fixtures.mjs';

const require = createRequire(import.meta.url);
const packages = require('../src/study-data/packages.cjs');
const zipkit = require('../src/study-data/zipkit.cjs');

export function windowsPackage() {
  const fixture = seedRuntime();
  try {
    const built = packages.buildPackage({runtime: fixture.runtime, course: {id: 'mat-1', name: 'Algebra'},
      materialsDir: fixture.materialsDir, include: {bookmarks: true}});
    const entries = zipkit.readZip(built.buffer);
    const manifest = built.manifest;
    const oldBase = manifest.source.materialsDir;
    const windowsBase = 'C:\\Users\\Student\\Documents\\Algebra';
    manifest.source.materialsDir = windowsBase;
    manifest.host.platform = 'win32';
    for (const entry of manifest.files.filter(item => item.kind === 'store')) {
      const payload = entries.find(item => item.name === entry.archivePath);
      const rewrite = value => {
        if (typeof value === 'string' && value.startsWith(oldBase)) return path.win32.join(windowsBase, ...path.relative(oldBase, value).split(path.sep));
        if (Array.isArray(value)) return value.map(rewrite);
        if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rewrite(item)]));
        return value;
      };
      payload.data = Buffer.from(JSON.stringify(rewrite(JSON.parse(payload.data))));
      entry.bytes = payload.data.length;
      entry.sha256 = createHash('sha256').update(payload.data).digest('hex');
    }
    manifest.counts.bytes = manifest.files.reduce((sum, item) => sum + item.bytes, 0);
    entries.find(item => item.name === packages.MANIFEST_NAME).data = Buffer.from(JSON.stringify(manifest));
    return zipkit.writeZip(entries, {deflate: true});
  } finally {
    cleanup(fixture.runtime, fixture.materialsDir, fixture.agentHome);
  }
}
