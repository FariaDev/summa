// @ts-check
/* A cena da primeira abertura (#101): a integral a pincel e a Mesa em
   miniatura da opção I de docs/design/marca/movimento.html. A integral se
   desenha nas Boas-vindas, encolhe rumo à aba quando o passeio começa e volta
   no Pronto; no meio, a miniatura acende uma região por vez com contorno na
   tinta e o resto a 30%. A regra de qual estado aparece é pura e tem teste; o
   DOM só recebe `data-scene`, `data-focus`, `data-tone`, o nome da aba e os
   primeiros PDFs. */

import {TOUR, stepId} from './setup-flow.mjs';

export const SCENE_MODES = /** @type {const} */ (['welcome', 'app', 'ready']);
export const SCENE_TONES = /** @type {const} */ (['idle', 'waiting', 'dragging', 'found', 'connecting', 'online', 'installing', 'error', 'no-engine']);

/** @typedef {'readers'|'writer'|'tutor'|'top'|''} SceneRegion */
/** @typedef {{mode:'welcome'|'app'|'ready', region:SceneRegion, tone:'idle'|'waiting'|'dragging'|'found'|'connecting'|'online'|'installing'|'error'|'no-engine'}} Scene */

const hasEngine = (/** @type {any} */ facts) => {
  const visible = facts?.visibleEngines || ['claude', 'opencode'];
  return (!!facts?.claudeFound && visible.includes('claude'))
    || (!!facts?.opencodeFound && visible.includes('opencode'));
};

/**
 * O estado da cena para o passo atual. O tutor sem motor, instalando ou com
 * falha fica com contorno fraco e estável, sem alarme; ligando pulsa e ligado
 * fica estável (#101).
 * @param {import('./setup-flow.mjs').SetupState} state
 * @param {any} [facts]
 * @param {{state?: string}} [install]
 * @returns {Scene}
 * @example sceneOf({...initialSetup('setup'), step: 1, frame: 0}) // {mode:'app', region:'readers', tone:'idle'}
 */
export function sceneOf(state, facts = {}, install = {}) {
  const id = stepId(state);
  if (id === 'welcome') return {mode: 'welcome', region: '', tone: 'idle'};
  if (id === 'tour') return {mode: 'app', region: TOUR[state.frame]?.region || 'readers', tone: 'idle'};
  if (id === 'name') return {mode: 'app', region: 'top', tone: 'idle'};
  if (id === 'folder') {
    const tone = state.alert ? 'dragging' : state.folder && state.pdfCount ? 'found' : 'waiting';
    return {mode: 'app', region: 'readers', tone};
  }
  if (id === 'tutor') return {mode: 'app', region: 'tutor', tone: tutorTone(state, facts, install)};
  return {mode: 'ready', region: '', tone: 'idle'};
}

/** @param {import('./setup-flow.mjs').SetupState} state @param {any} facts @param {{state?: string}} install @returns {Scene['tone']} */
function tutorTone(state, facts, install) {
  if (state.online) return 'online';
  if (install.state === 'installing') return 'installing';
  if (install.state === 'error') return 'error';
  if (hasEngine(facts) || install.state === 'done') return 'connecting';
  return 'no-engine';
}

/**
 * O texto da aba da miniatura: antes do Nome, o vazio; no Nome, o que a pessoa
 * digita com cursor; depois, o nome já escolhido.
 * @param {import('./setup-flow.mjs').SetupState} state
 * @param {string} placeholder
 * @returns {{text:string, muted:boolean, caret:boolean}}
 * @example sceneTabOf({...initialSetup('setup'), step: 2, name: 'Cál'}, 'Nova matéria') // {text:'Cál', muted:false, caret:true}
 */
export function sceneTabOf(state, placeholder = '') {
  const id = stepId(state);
  const typed = String(state.name ?? '');
  if (id === 'welcome' || id === 'tour') return {text: placeholder, muted: true, caret: false};
  if (id === 'name') return {text: typed || placeholder, muted: !typed, caret: true};
  return {text: typed || placeholder, muted: !typed, caret: false};
}

/**
 * O nome de um PDF como cabe numa página da miniatura.
 * @param {string} name
 * @returns {string}
 * @example scenePdfLabel('Formulario.pdf') // 'Formulario.pdf'
 */
export function scenePdfLabel(name) {
  const text = String(name ?? '');
  return text.length > 16 ? `${text.slice(0, 15)}…` : text;
}

/** As caixas das regiões no viewBox 520×300, iguais às do mockup. */
/** @type {Record<string,[number,number,number,number]>} */
export const SCENE_BOX = {top: [2, 2, 326, 24], readers: [6, 30, 204, 266], tutor: [214, 30, 112, 266], writer: [340, 2, 178, 296], all: [2, 2, 516, 296]};

/**
 * A caixa do contorno, dois pixels para fora da região.
 * @param {SceneRegion} region
 * @returns {{x:number, y:number, w:number, h:number}}
 * @example ringFor('readers') // {x:4, y:28, w:208, h:270}
 */
export function ringFor(region) {
  const [x, y, w, h] = SCENE_BOX[region] || SCENE_BOX.all;
  return {x: x - 2, y: y - 2, w: w + 4, h: h + 4};
}

const D = "M 800.500 166.419 C 799.950 166.646, 795.232 168.019, 790.016 169.470 C 744.006 182.270, 703.646 214.434, 675.789 260.500 C 658.982 288.293, 644.491 321.376, 635.433 352.636 C 629.407 373.430, 625.123 389.837, 624.502 394.500 C 622.644 408.446, 620.640 417.915, 618.439 423.145 C 617.097 426.332, 615.993 430.866, 615.984 433.220 C 615.976 435.574, 615.065 441.775, 613.961 447 C 612.857 452.225, 610.610 464.375, 608.968 474 C 607.326 483.625, 605.086 495.527, 603.991 500.449 C 602.896 505.371, 601.995 511.446, 601.988 513.949 C 601.982 516.452, 601.090 522.100, 600.006 526.500 C 598.201 533.826, 596.857 542.368, 592.372 575 C 591.503 581.325, 590.160 589.055, 589.388 592.177 C 588.615 595.300, 587.744 600.475, 587.453 603.677 C 586.597 613.084, 584.963 625.685, 583.001 638 C 581.993 644.325, 580.419 657.375, 579.503 667 C 578.586 676.625, 577.263 687.512, 576.561 691.192 C 575.859 694.873, 575.199 701.418, 575.095 705.736 C 574.991 710.054, 574.719 715.367, 574.490 717.543 C 574.262 719.719, 573.407 727.800, 572.592 735.500 C 571.776 743.200, 570.605 757.150, 569.991 766.500 C 569.376 775.850, 568.203 788.216, 567.384 793.980 C 565.715 805.734, 562.929 833.352, 562.491 842.500 C 560.072 892.946, 536.484 966.120, 510.962 1002.344 C 500.851 1016.695, 485.487 1031.601, 473.973 1038.229 C 451.408 1051.220, 420.902 1049.709, 407.010 1034.912 C 397.581 1024.869, 396.778 1014.630, 404.025 996.880 C 411.081 979.602, 411.240 979.012, 410.705 972.130 C 410.086 964.144, 408.620 962.118, 398.156 954.778 C 385.715 946.051, 378.291 944.612, 362 947.772 C 353.362 949.447, 345.156 956.040, 337.398 967.538 C 329.878 978.683, 330.006 1004.267, 337.658 1019.754 C 351.301 1047.365, 377.906 1069.204, 405.254 1075.239 C 418.021 1078.056, 442.837 1078.201, 458 1075.546 C 508.291 1066.740, 554.660 1028.375, 596.444 961 C 599.684 955.775, 603.123 950.600, 604.085 949.500 C 606.378 946.880, 632.311 894.796, 634.429 888.558 C 635.788 884.554, 642.575 868.145, 646.034 860.500 C 647.252 857.807, 655.859 831.673, 661.020 815 C 663.318 807.575, 666.091 799.025, 667.182 796 C 668.855 791.361, 674.078 770.044, 679.554 745.500 C 680.291 742.200, 681.840 736.575, 682.998 733 C 684.155 729.425, 686.624 715.873, 688.484 702.884 C 690.344 689.896, 692.557 676.846, 693.401 673.884 C 694.246 670.923, 694.903 666.700, 694.863 664.500 C 694.762 659.057, 696.731 642.046, 698.451 633.500 C 699.226 629.650, 700.389 620.200, 701.036 612.500 C 702.258 597.945, 702.695 593.479, 705.342 568.500 C 707.366 549.392, 708.668 532.012, 710.495 499.691 C 711.298 485.497, 712.194 473.495, 712.487 473.021 C 712.780 472.547, 713.231 461.210, 713.490 447.829 C 714.967 371.274, 721.307 306.129, 729.882 279.392 C 748.666 220.824, 788.369 186.454, 826.781 195.511 C 847.859 200.480, 854.550 213.255, 849.129 238.177 C 844.843 257.882, 851.100 269.391, 870.102 276.754 C 879.686 280.467, 881.917 280.630, 892.127 278.363 C 913.624 273.589, 922.505 258.896, 917.509 236.371 C 914.826 224.275, 910.637 217.096, 896.404 200.207 C 884.567 186.162, 862.147 173.635, 840.500 168.972 C 832.265 167.198, 803.119 165.338, 800.500 166.419";

/* Linha central da integral, de cima (gota do topo) até a gota de baixo,
   feita à mão sobre o path; serve de máscara para o traço aparecer. */
const SPINE = [[888, 252], [872, 205], [822, 180], [760, 200], [712, 262], [684, 370], [664, 500], [648, 640], [630, 770], [602, 880], [556, 975], [492, 1045], [425, 1062], [372, 1040], [352, 1000], [368, 968]];

/** @param {number[][]} points */
function smooth(points) {
  let d = `M${points[0]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i], p1 = points[i], p2 = points[i + 1], p3 = points[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1} ${c2} ${p2}`;
  }
  return d;
}

const SPINE_D = smooth(SPINE);

const lines = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ w, /** @type {number} */ n) => Array.from({length: n}, (_, i) => `<line class="mini-line" x1="${x}" y1="${y + i * 9}" x2="${x + w * (i % 3 === 2 ? 0.6 : 1)}" y2="${y + i * 9}"/>`).join('');

const MINI = `
<g class="mini-region" data-region="top"><rect class="mini-win" x="1" y="1" width="328" height="298" rx="6"/><rect class="mini-bar" x="1" y="1" width="328" height="24" rx="6"/>
<rect class="mini-tab" x="8" y="6" width="74" height="16" rx="3"/><text class="mini-tab-text" x="14" y="17" data-scene-tab clip-path="url(#scene-tab-clip)"></text><text class="mini-tab-text mini-muted" x="92" y="17" data-i18n="free.tab">Livre</text></g>
<g class="mini-region" data-region="readers"><rect class="mini-page" x="12" y="36" width="92" height="124" rx="2"/><text class="mini-pdf" data-pdf="0" x="20" y="48"></text>${lines(20, 58, 76, 10)}
<rect class="mini-page" x="112" y="36" width="92" height="124" rx="2"/><text class="mini-pdf" data-pdf="1" x="120" y="48"></text>${lines(120, 58, 76, 10)}
<rect class="mini-page" x="12" y="168" width="92" height="124" rx="2"/><text class="mini-pdf" data-pdf="2" x="20" y="180"></text>${lines(20, 190, 76, 10)}
<rect class="mini-page" x="112" y="168" width="92" height="124" rx="2"/><text class="mini-pdf" data-pdf="3" x="120" y="180"></text>${lines(120, 190, 76, 10)}</g>
<g class="mini-region" data-region="tutor"><rect class="mini-bubble me" x="250" y="40" width="70" height="22" rx="6"/><rect class="mini-bubble" x="220" y="70" width="96" height="44" rx="6"/><rect class="mini-bubble me" x="262" y="122" width="58" height="18" rx="6"/>
<rect class="mini-bubble" x="220" y="148" width="90" height="30" rx="6"/><rect class="mini-composer" x="218" y="262" width="104" height="30" rx="6"/></g>
<g class="mini-region" data-region="writer"><rect class="mini-win" x="340" y="1" width="178" height="298" rx="6"/><rect class="mini-bar" x="340" y="1" width="178" height="20" rx="6"/>
<rect class="mini-page" x="352" y="30" width="154" height="258" rx="2"/>
<path class="mini-hand" d="M364 56c6-8 10 6 16-2s8-4 12 0m10-2h8m6 4c4-10 12-8 14 0s8 6 12-4M364 84c10-6 18 4 26-2m8 2c6-6 12-6 16 0M366 112c4 8 10-10 16 0s10-6 14 2m10-4h10m6-2c6 10 14-10 18 0"/></g>`;

/** A cena inteira, em SVG: a Mesa em miniatura e a integral por cima. */
export const SCENE_SVG = `
<svg viewBox="0 0 520 300" role="presentation" focusable="false">
<defs>
<mask id="scene-brand-mask" maskUnits="userSpaceOnUse" x="155" y="150" width="940" height="940"><path class="brand-spine" pathLength="1" d="${SPINE_D}" fill="none" stroke="#fff" stroke-width="130" stroke-linecap="round" stroke-linejoin="round"/></mask>
<clipPath id="scene-tab-clip"><rect x="8" y="4" width="76" height="20" rx="3"/></clipPath>
</defs>
<g class="layer app">${MINI}<rect class="scene-ring" x="0" y="0" width="0" height="0" rx="6"/></g>
<g class="layer brand"><svg x="175" y="55" width="170" height="170" viewBox="155 150 940 940" overflow="visible"><path class="brand-base" d="${D}" fill="var(--scene-ink)" mask="url(#scene-brand-mask)"/></svg></g>
</svg>`;
