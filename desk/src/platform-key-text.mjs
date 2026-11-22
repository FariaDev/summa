/** Rótulos de atalhos da interface; `platformKeyText('⌘⏎', false, 'linux')` → `Ctrl+Enter`.
 * @param {string} value @param {boolean} [kbd] @param {string} [platform] */
export function platformKeyText(value,kbd=false,platform=globalThis.navigator?.userAgent||''){
 if(/Mac|darwin/i.test(platform))return String(value);
 const text=String(value).replace(/⏎/g,'Enter').replace(/⌃/g,'Ctrl').replace(/⌥/g,'Alt');
 return kbd
  ? text.replace(/⌘/g,'Ctrl').replace(/⇧/g,'Shift')
  : text.replace(/⌘⇧/g,'Ctrl+Shift+').replace(/⌘(?=[,.)]|$)/g,'Ctrl').replace(/⌘ /g,'Ctrl+').replace(/⌘/g,'Ctrl+').replace(/⇧/g,'Shift+');
}
