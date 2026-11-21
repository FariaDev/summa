/* `window.desk` no renderer: a API que o `preload.cjs` expõe (#43 fase 3). As
   chamadas devolvem o `Promise` do `ipcRenderer.invoke`; o formato da resposta
   é do handler `ipcMain` do canal. */
import type {DeskApi} from '../preload.cjs';

declare global {
 /* Eventos próprios da Mesa despachados na janela (`detail` é do emissor). */
 interface WindowEventMap {
  'desk-busy': CustomEvent<Record<string, any>>;
  'desk-conferir-absent': CustomEvent<Record<string, any>>;
  'desk-held': CustomEvent<Record<string, any>>;
  'desk-layout-ready': CustomEvent<Record<string, any>>;
  'desk-open-settings': CustomEvent<Record<string, any>>;
  'desk-reader-sheet': CustomEvent<Record<string, any>>;
  'desk-workspace': CustomEvent<Record<string, any>>;
 }
 interface Window {
  desk: DeskApi;
  /* Ganchos de depuração e de teste que os módulos penduram na janela. */
  deskFreeBridge?: DeskApi;
  __deskFreeStudy?: boolean;
  __fitErrors?: string[];
  __materialLastReport?: Record<string, any>;
  materialPrint?: Record<string, any>;
  mesaFigure?: Record<string, any>;
  mesaKeys?: {format(combo: any): string; effective(id: string): any; open(): void; sync(): void};
  mesaLayoutPresets?: Record<string, any>;
  mesaPalette?: Record<string, any>;
  webkitAudioContext?: typeof AudioContext;
 }
}
export {};
