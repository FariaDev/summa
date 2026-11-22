/* A Mesa só consulta elementos HTML (o SVG chega montado em `innerHTML` e é
   tratado como nó opaco). Sem isto, cada `querySelector` precisaria de um
   cast para `HTMLElement` antes de `.hidden`, `.dataset` ou `.focus()`.
   Estas sobrecargas entram antes das da lib.dom (#43 fase 3). */
declare global {
 interface ParentNode {
  querySelector<E extends Element = HTMLElement>(selectors: string): E | null;
  querySelectorAll<E extends Element = HTMLElement>(selectors: string): NodeListOf<E>;
 }
 interface Element {
  closest<E extends Element = HTMLElement>(selectors: string): E | null;
 }
}
export {};
