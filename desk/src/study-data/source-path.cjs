'use strict';

const path = require('node:path');

/** Identify the syntax of a fully qualified path persisted by another machine.
 * @param {unknown} value
 * @returns {typeof path.win32 | typeof path.posix | null}
 * @example sourcePathFlavor('C:\\Study') === path.win32
 */
function sourcePathFlavor(value) {
  if (typeof value !== 'string') return null;
  if (/^(?:[a-z]:[\\/]|(?:\\\\|\/\/)[^\\/]+[\\/][^\\/]+)/i.test(value)) return path.win32;
  return path.posix.isAbsolute(value) ? path.posix : null;
}

/** Map a source root or descendant onto a local root; null means no match.
 * @param {string} value
 * @param {string} from
 * @param {string} to
 * @returns {string | null}
 * @example remapSourcePath('C:\\Old\\a.pdf', 'C:\\Old', '/new') // '/new/a.pdf' on POSIX
 */
function remapSourcePath(value, from, to) {
  const source = sourcePathFlavor(from);
  if (!source || sourcePathFlavor(value) !== source || !to) return null;
  const relative = source.relative(from, value);
  if (relative === '..' || relative.startsWith(`..${source.sep}`) || source.isAbsolute(relative)) return null;
  const parts = relative.split(source.sep);
  if (parts.some((part) => part.includes(path.sep))) return null;
  return path.join(to, ...parts);
}

module.exports = {sourcePathFlavor, remapSourcePath};
