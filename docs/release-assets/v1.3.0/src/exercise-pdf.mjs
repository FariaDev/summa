/* PDFs de exemplo das capturas do README da 1.3.0 (#21). O conteúdo é
   inventado para a imagem: nada aqui vem de PDF, sessão ou material de curso de
   ninguém. As fontes são as Helvetica/Times embutidas do PDF, para o arquivo
   abrir igual em qualquer máquina sem depender de fonte instalada. */
import fs from 'node:fs';

/** Escapa o que quebra uma string literal de PDF. @param {unknown} value @returns {string} */
function pdfText(value){
  return String(value).replace(/[\\()]/g, '\\$&');
}

/**
 * Um trecho de texto posicionado na página.
 * @param {{x?: number, y: number, size?: number, font?: 'F1'|'F2'|'F3', text: string}} line
 * @returns {string} operador de texto do PDF
 */
function textOp({x = 64, y, size = 11, font = 'F1', text}){
  return `BT /${font} ${size} Tf ${x} ${y} Td (${pdfText(text)}) Tj ET`;
}

/**
 * Monta um PDF A4 com as páginas dadas.
 * @param {string[][]} pages operadores de texto por página
 * @returns {Buffer}
 * @example buildPdf([[textOp({y: 780, text: 'Oi'})]])
 */
function buildPdf(pages){
  const objects = [
    '<</Type/Catalog/Pages 2 0 R>>',
    '<</Type/Pages/Kids[#KIDS#]/Count #COUNT#>>',
    '<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding/WinAnsiEncoding>>',
    '<</Type/Font/Subtype/Type1/BaseFont/Helvetica-Bold/Encoding/WinAnsiEncoding>>',
    '<</Type/Font/Subtype/Type1/BaseFont/Times-Roman/Encoding/WinAnsiEncoding>>',
  ];
  const pageRefs = [];
  for(const ops of pages){
    const pageId = objects.length + 1;
    const contentId = pageId + 1;
    pageRefs.push(`${pageId} 0 R`);
    const stream = ops.join('\n');
    objects.push(`<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Resources<</Font<</F1 3 0 R/F2 4 0 R/F3 5 0 R>>>>/Contents ${contentId} 0 R>>`);
    objects.push(`<</Length ${Buffer.byteLength(stream, 'latin1')}>>\nstream\n${stream}\nendstream`);
  }
  objects[1] = objects[1].replace('#KIDS#', pageRefs.join(' ')).replace('#COUNT#', String(pages.length));
  let out = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(out, 'latin1'));
    out += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const startxref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${startxref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

const EXERCISES = {
  pt: [
    [
      textOp({y: 780, size: 22, font: 'F2', text: 'Lista de exercícios'}),
      textOp({y: 754, size: 12, text: 'Cálculo I · Derivadas'}),
      textOp({y: 712, size: 10, text: 'Nome: ____________________   Turma: ________   Data: __/__/______'}),
      textOp({y: 668, size: 12, text: '1. Calcule a derivada de f(x) = 3x² - 5x + 2.'}),
      textOp({y: 638, size: 12, text: '2. Derive g(x) = sen(x)·cos(x) usando a regra do produto.'}),
      textOp({y: 608, size: 12, text: '3. Encontre a equação da reta tangente a y = x³ no ponto (2, 8).'}),
      textOp({y: 578, size: 12, text: '4. A posição de uma partícula é s(t) = t³ - 6t² + 9t, em metros e segundos.'}),
      textOp({y: 558, size: 12, text: '   Em que instantes a velocidade é zero?'}),
      textOp({y: 528, size: 12, text: '5. Use a regra da cadeia em h(x) = (2x + 1)^5.'}),
      textOp({y: 498, size: 12, text: '6. Calcule a derivada de y = ln(x² + 1).'}),
      textOp({y: 468, size: 12, text: '7. Determine os pontos críticos de f(x) = x⁴ - 4x².'}),
      textOp({y: 438, size: 12, text: '8. Aplique a regra do quociente em q(x) = (x² + 1)/(x - 1).'}),
      textOp({y: 398, size: 11, font: 'F3', text: 'Dica: confira cada passo antes de seguir para a próxima questão.'}),
    ],
    [
      textOp({y: 780, size: 20, font: 'F2', text: 'Lista de exercícios · continuação'}),
      textOp({y: 736, size: 12, text: '9. Mostre que a derivada de tan(x) é sec²(x).'}),
      textOp({y: 706, size: 12, text: '10. Um tanque recebe água a 3 L/min. O volume é V(t) = 3t + 20.'}),
      textOp({y: 686, size: 12, text: '    Qual é a taxa de variação do volume no instante t = 5 min?'}),
      textOp({y: 656, size: 12, text: '11. Ache a derivada de f(x) = e^(2x)·sen(x).'}),
      textOp({y: 626, size: 12, text: '12. Esboce o gráfico de f(x) = x³ - 3x e marque os intervalos de crescimento.'}),
      textOp({y: 586, size: 12, font: 'F2', text: 'Desafio.'}),
      textOp({y: 566, size: 12, text: 'Mostre que a derivada de arcsen(x) é 1/√(1 - x²).'}),
      textOp({y: 516, size: 14, font: 'F2', text: 'Gabarito parcial'}),
      textOp({y: 490, size: 10, text: "1. f'(x) = 6x - 5        2. g'(x) = cos²(x) - sen²(x)"}),
      textOp({y: 470, size: 10, text: "3. y - 8 = 12(x - 2)        4. v(t) = 3t² - 12t + 9; t = 1 s e t = 3 s"}),
      textOp({y: 450, size: 10, text: "5. h'(x) = 10(2x + 1)^4        6. y' = 2x/(x² + 1)"}),
      textOp({y: 430, size: 10, text: "7. x = -√2, 0 e √2        8. q'(x) = (x² - 2x - 1)/(x - 1)²"}),
    ],
  ],
  en: [
    [
      textOp({y: 780, size: 22, font: 'F2', text: 'Problem set'}),
      textOp({y: 754, size: 12, text: 'Calculus I · Derivatives'}),
      textOp({y: 712, size: 10, text: 'Name: ____________________   Class: ________   Date: __/__/______'}),
      textOp({y: 668, size: 12, text: '1. Find the derivative of f(x) = 3x² - 5x + 2.'}),
      textOp({y: 638, size: 12, text: '2. Differentiate g(x) = sin(x)·cos(x) with the product rule.'}),
      textOp({y: 608, size: 12, text: '3. Find the tangent line to y = x³ at the point (2, 8).'}),
      textOp({y: 578, size: 12, text: '4. A particle position is s(t) = t³ - 6t² + 9t, in meters and seconds.'}),
      textOp({y: 558, size: 12, text: '   When is the velocity zero?'}),
      textOp({y: 528, size: 12, text: '5. Use the chain rule on h(x) = (2x + 1)^5.'}),
      textOp({y: 498, size: 12, text: '6. Find the derivative of y = ln(x² + 1).'}),
      textOp({y: 468, size: 12, text: '7. Find the critical points of f(x) = x⁴ - 4x².'}),
      textOp({y: 438, size: 12, text: '8. Apply the quotient rule to q(x) = (x² + 1)/(x - 1).'}),
      textOp({y: 398, size: 11, font: 'F3', text: 'Check each step before moving to the next problem.'}),
    ],
    [
      textOp({y: 780, size: 20, font: 'F2', text: 'Problem set · continued'}),
      textOp({y: 736, size: 12, text: '9. Show that the derivative of tan(x) is sec²(x).'}),
      textOp({y: 706, size: 12, text: '10. A tank receives water at 3 L/min. Its volume is V(t) = 3t + 20.'}),
      textOp({y: 686, size: 12, text: '    What is the rate of change of the volume at t = 5 min?'}),
      textOp({y: 656, size: 12, text: '11. Differentiate f(x) = e^(2x)·sin(x).'}),
      textOp({y: 626, size: 12, text: '12. Sketch the graph of f(x) = x³ - 3x and mark the growth intervals.'}),
      textOp({y: 586, size: 12, font: 'F2', text: 'Challenge.'}),
      textOp({y: 566, size: 12, text: 'Show that the derivative of arcsin(x) is 1/√(1 - x²).'}),
      textOp({y: 516, size: 14, font: 'F2', text: 'Answer key'}),
      textOp({y: 490, size: 10, text: "1. f'(x) = 6x - 5        2. g'(x) = cos²(x) - sin²(x)"}),
      textOp({y: 470, size: 10, text: "3. y - 8 = 12(x - 2)        4. v(t) = 3t² - 12t + 9; t = 1 s and t = 3 s"}),
      textOp({y: 450, size: 10, text: "5. h'(x) = 10(2x + 1)^4        6. y' = 2x/(x² + 1)"}),
      textOp({y: 430, size: 10, text: "7. x = -√2, 0 and √2        8. q'(x) = (x² - 2x - 1)/(x - 1)²"}),
    ],
  ],
};

const FORMULAS = {
  pt: [
    textOp({y: 780, size: 22, font: 'F2', text: 'Formulário'}),
    textOp({y: 754, size: 12, text: 'Derivadas'}),
    textOp({y: 706, size: 14, font: 'F2', text: 'Regras básicas'}),
    textOp({y: 678, size: 12, text: "(x^n)' = n x^(n-1)"}),
    textOp({y: 654, size: 12, text: "(sen x)' = cos x"}),
    textOp({y: 630, size: 12, text: "(cos x)' = -sen x"}),
    textOp({y: 606, size: 12, text: "(tan x)' = sec² x"}),
    textOp({y: 582, size: 12, text: "(e^x)' = e^x"}),
    textOp({y: 558, size: 12, text: "(ln x)' = 1/x"}),
    textOp({y: 514, size: 14, font: 'F2', text: 'Regras de combinação'}),
    textOp({y: 486, size: 12, text: "(f + g)' = f' + g'"}),
    textOp({y: 462, size: 12, text: "(fg)' = f'g + fg'"}),
    textOp({y: 438, size: 12, text: "(f/g)' = (f'g - fg')/g²"}),
    textOp({y: 414, size: 12, text: "(f(g(x)))' = f'(g(x))·g'(x)"}),
    textOp({y: 370, size: 14, font: 'F2', text: 'Identidades úteis'}),
    textOp({y: 342, size: 12, text: 'sen² x + cos² x = 1'}),
    textOp({y: 318, size: 12, text: '1 + tan² x = sec² x'}),
    textOp({y: 294, size: 12, text: 'sen(2x) = 2 sen x cos x'}),
    textOp({y: 270, size: 12, text: 'cos(2x) = cos² x - sen² x'}),
  ],
  en: [
    textOp({y: 780, size: 22, font: 'F2', text: 'Formula sheet'}),
    textOp({y: 754, size: 12, text: 'Derivatives'}),
    textOp({y: 706, size: 14, font: 'F2', text: 'Basic rules'}),
    textOp({y: 678, size: 12, text: "(x^n)' = n x^(n-1)"}),
    textOp({y: 654, size: 12, text: "(sin x)' = cos x"}),
    textOp({y: 630, size: 12, text: "(cos x)' = -sin x"}),
    textOp({y: 606, size: 12, text: "(tan x)' = sec² x"}),
    textOp({y: 582, size: 12, text: "(e^x)' = e^x"}),
    textOp({y: 558, size: 12, text: "(ln x)' = 1/x"}),
    textOp({y: 514, size: 14, font: 'F2', text: 'Combination rules'}),
    textOp({y: 486, size: 12, text: "(f + g)' = f' + g'"}),
    textOp({y: 462, size: 12, text: "(fg)' = f'g + fg'"}),
    textOp({y: 438, size: 12, text: "(f/g)' = (f'g - fg')/g²"}),
    textOp({y: 414, size: 12, text: "(f(g(x)))' = f'(g(x))·g'(x)"}),
    textOp({y: 370, size: 14, font: 'F2', text: 'Useful identities'}),
    textOp({y: 342, size: 12, text: 'sin² x + cos² x = 1'}),
    textOp({y: 318, size: 12, text: '1 + tan² x = sec² x'}),
    textOp({y: 294, size: 12, text: 'sin(2x) = 2 sin x cos x'}),
    textOp({y: 270, size: 12, text: 'cos(2x) = cos² x - sin² x'}),
  ],
};

/**
 * Grava a lista de exercícios e o formulário de exemplo na pasta da matéria.
 * @param {string} folder pasta que a captura usa como matéria
 * @param {'pt'|'en'} lang idioma do conteúdo
 * @returns {{list: string, formula: string}} caminhos dos dois PDFs
 * @example writeSampleMaterials('/tmp/calc', 'pt')
 */
export function writeSampleMaterials(folder, lang){
  /* Nome na língua da captura: a aba mostra o arquivo. */
  const list = `${folder}/${lang === 'en' ? 'problem-set' : 'lista-derivadas'}.pdf`;
  const formula = `${folder}/${lang === 'en' ? 'formula-sheet' : 'formulario-derivadas'}.pdf`;
  fs.writeFileSync(list, buildPdf(EXERCISES[lang]));
  fs.writeFileSync(formula, buildPdf([FORMULAS[lang]]));
  return {list, formula};
}
