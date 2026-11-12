/* Ícone do app: a integral a pincel aprovada (#189), no lugar da luminária.
   O `d` é cópia literal do símbolo `int` de docs/design/marca/r1.html, sem
   redesenho. A grade é a do macOS: quadro 1024×1024, placa de 824 centrada,
   cantos de 185 (≈22,4%) e o símbolo a 62% da placa, centrado. Em 32 e 16 px o
   traço ganha corpo para a integral continuar legível. */

/** As quatro variantes aprovadas, com a placa e a tinta de cada uma. */
export const INTEGRAL_VARIANTS = Object.freeze({
  'light-graphite': {plate: '#ffffff', ink: '#161616'},
  'dark-graphite': {plate: '#161616', ink: '#ffffff'},
  'light-violet': {plate: '#ffffff', ink: '#8044ca'},
  'dark-violet': {plate: '#161616', ink: '#b89cea'},
});

const FRAME = 1024;
const PLATE = 824;
const PLATE_RADIUS = 185;
const SYMBOL_SHARE = .62;
const SYMBOL_STROKE = 48;
const INTEGRAL_VIEWBOX = '155 150 940 940';

const INTEGRAL_PATH = "M 800.500 166.419 C 799.950 166.646, 795.232 168.019, 790.016 169.470 C 744.006 182.270, 703.646 214.434, 675.789 260.500 C 658.982 288.293, 644.491 321.376, 635.433 352.636 C 629.407 373.430, 625.123 389.837, 624.502 394.500 C 622.644 408.446, 620.640 417.915, 618.439 423.145 C 617.097 426.332, 615.993 430.866, 615.984 433.220 C 615.976 435.574, 615.065 441.775, 613.961 447 C 612.857 452.225, 610.610 464.375, 608.968 474 C 607.326 483.625, 605.086 495.527, 603.991 500.449 C 602.896 505.371, 601.995 511.446, 601.988 513.949 C 601.982 516.452, 601.090 522.100, 600.006 526.500 C 598.201 533.826, 596.857 542.368, 592.372 575 C 591.503 581.325, 590.160 589.055, 589.388 592.177 C 588.615 595.300, 587.744 600.475, 587.453 603.677 C 586.597 613.084, 584.963 625.685, 583.001 638 C 581.993 644.325, 580.419 657.375, 579.503 667 C 578.586 676.625, 577.263 687.512, 576.561 691.192 C 575.859 694.873, 575.199 701.418, 575.095 705.736 C 574.991 710.054, 574.719 715.367, 574.490 717.543 C 574.262 719.719, 573.407 727.800, 572.592 735.500 C 571.776 743.200, 570.605 757.150, 569.991 766.500 C 569.376 775.850, 568.203 788.216, 567.384 793.980 C 565.715 805.734, 562.929 833.352, 562.491 842.500 C 560.072 892.946, 536.484 966.120, 510.962 1002.344 C 500.851 1016.695, 485.487 1031.601, 473.973 1038.229 C 451.408 1051.220, 420.902 1049.709, 407.010 1034.912 C 397.581 1024.869, 396.778 1014.630, 404.025 996.880 C 411.081 979.602, 411.240 979.012, 410.705 972.130 C 410.086 964.144, 408.620 962.118, 398.156 954.778 C 385.715 946.051, 378.291 944.612, 362 947.772 C 353.362 949.447, 345.156 956.040, 337.398 967.538 C 329.878 978.683, 330.006 1004.267, 337.658 1019.754 C 351.301 1047.365, 377.906 1069.204, 405.254 1075.239 C 418.021 1078.056, 442.837 1078.201, 458 1075.546 C 508.291 1066.740, 554.660 1028.375, 596.444 961 C 599.684 955.775, 603.123 950.600, 604.085 949.500 C 606.378 946.880, 632.311 894.796, 634.429 888.558 C 635.788 884.554, 642.575 868.145, 646.034 860.500 C 647.252 857.807, 655.859 831.673, 661.020 815 C 663.318 807.575, 666.091 799.025, 667.182 796 C 668.855 791.361, 674.078 770.044, 679.554 745.500 C 680.291 742.200, 681.840 736.575, 682.998 733 C 684.155 729.425, 686.624 715.873, 688.484 702.884 C 690.344 689.896, 692.557 676.846, 693.401 673.884 C 694.246 670.923, 694.903 666.700, 694.863 664.500 C 694.762 659.057, 696.731 642.046, 698.451 633.500 C 699.226 629.650, 700.389 620.200, 701.036 612.500 C 702.258 597.945, 702.695 593.479, 705.342 568.500 C 707.366 549.392, 708.668 532.012, 710.495 499.691 C 711.298 485.497, 712.194 473.495, 712.487 473.021 C 712.780 472.547, 713.231 461.210, 713.490 447.829 C 714.967 371.274, 721.307 306.129, 729.882 279.392 C 748.666 220.824, 788.369 186.454, 826.781 195.511 C 847.859 200.480, 854.550 213.255, 849.129 238.177 C 844.843 257.882, 851.100 269.391, 870.102 276.754 C 879.686 280.467, 881.917 280.630, 892.127 278.363 C 913.624 273.589, 922.505 258.896, 917.509 236.371 C 914.826 224.275, 910.637 217.096, 896.404 200.207 C 884.567 186.162, 862.147 173.635, 840.500 168.972 C 832.265 167.198, 803.119 165.338, 800.500 166.419";

/**
 * SVG de uma variante do ícone num tamanho. Em 32 px ou menos o path leva o
 * traço da tinta (stroke-width 48 nas unidades do símbolo), que engrossa as
 * pontas; acima disso o preenchimento basta.
 * @param {keyof typeof INTEGRAL_VARIANTS} id variante aprovada
 * @param {number} size lado do ícone em px
 * @returns {string} SVG completo, com fundo transparente fora da placa
 * @example integralSvg('dark-graphite', 16).includes('stroke-width="48"') // true
 */
export function integralSvg(id, size) {
  const colors = INTEGRAL_VARIANTS[id];
  if (!colors) throw new Error(`Variante do ícone desconhecida: ${JSON.stringify(id)}; esperado uma de ${Object.keys(INTEGRAL_VARIANTS).join(', ')}`);
  const symbol = Number((PLATE * SYMBOL_SHARE).toFixed(2));
  const inset = Number(((FRAME - symbol) / 2).toFixed(2));
  const plateInset = (FRAME - PLATE) / 2;
  const stroke = size <= 32 ? ` stroke="${colors.ink}" stroke-width="${SYMBOL_STROKE}" stroke-linejoin="round"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${FRAME} ${FRAME}">
<rect x="${plateInset}" y="${plateInset}" width="${PLATE}" height="${PLATE}" rx="${PLATE_RADIUS}" fill="${colors.plate}"/>
<svg x="${inset}" y="${inset}" width="${symbol}" height="${symbol}" viewBox="${INTEGRAL_VIEWBOX}" overflow="visible">
<path fill="${colors.ink}"${stroke} d="${INTEGRAL_PATH}"/>
</svg>
</svg>
`;
}
