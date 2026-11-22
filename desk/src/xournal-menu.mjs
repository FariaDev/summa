/**
 * Whether the host supplied a usable Xournal++ menu target on this platform.
 * @param {{platform?: string, xournalPath?: string, desk?: {xournal?: boolean}}} config
 * @returns {boolean}
 * @example xournalMenuAvailable({platform:'linux',xournalPath:''}) // false
 */
export function xournalMenuAvailable(config){
 if(config.desk?.xournal===false)return false;
 return !['win32','linux'].includes(config.platform)||!!config.xournalPath;
}
