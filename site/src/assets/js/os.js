// O sistema de quem visita, separado da página para o teste rodar no Node.

export const OS_NAMES = {mac: 'macOS', win: 'Windows', linux: 'Linux'};

/**
 * O sistema de quem visita, pelo user agent; sem pista, macOS. Celular e tablet
 * dão `mobile`, porque a Summa não roda neles: antes, iPhone e Android caíam no
 * macOS e o botão entregava um .dmg. O iPad se diz Mac, então o toque decide.
 * @param {string} ua o `navigator.userAgent`
 * @param {number} [touchPoints] o `navigator.maxTouchPoints`
 * @returns {'mac'|'win'|'linux'|'mobile'}
 * @example detectOs('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5) // → 'mobile' (iPad)
 */
export function detectOs(ua, touchPoints = 0) {
  if (/Android|iPhone|iPad|iPod|Mobile/.test(ua)) return 'mobile';
  if (/Macintosh/.test(ua) && touchPoints > 1) return 'mobile';
  if (/Windows/.test(ua)) return 'win';
  if (/Linux/.test(ua)) return 'linux';
  return 'mac';
}
