// @ts-check
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');

/**
 * Resolve an installed Linux Xournal++ executable without running a shell.
 * @param {{env?: NodeJS.ProcessEnv, home?: string, candidates?: string[]}} options
 * @returns {string} Absolute executable path, or empty when unavailable.
 * @example linuxXournalPath({env:{PATH:'/usr/bin'}}) // '/usr/bin/xournalpp' when installed
 */
function linuxXournalPath({env=process.env,home=os.homedir(),candidates}={}){
 const common=candidates??[
  '/usr/local/bin/xournalpp','/usr/bin/xournalpp','/snap/bin/xournalpp',
  path.join(home,'.local/share/flatpak/exports/bin/com.github.xournalpp.xournalpp'),
  '/var/lib/flatpak/exports/bin/com.github.xournalpp.xournalpp'
 ];
 const onPath=String(env.PATH||'').split(path.delimiter).filter(dir=>path.isAbsolute(dir)).map(dir=>path.join(dir,'xournalpp'));
 return [...onPath,...common].find(file=>{
  try{fs.accessSync(file,fs.constants.X_OK);return fs.statSync(file).isFile();}catch{return false;}
 })||'';
}

module.exports={linuxXournalPath};
