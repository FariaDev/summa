// @ts-check
/* O CSS do painel de backup é injetado já na partida (#desempenho): outras
   telas usam as classes `.mesa-bkp-*` (o quadro de status do rodapé, as cores
   de erro/sucesso) sem abrir o painel. Só as regras ficam aqui; o módulo
   completo, com os templates e o diálogo, continua sob demanda. */

export const BACKUP_PANEL_CSS_ID = 'mesa-backup-panel-style';
const CSS_ID = BACKUP_PANEL_CSS_ID;

export const BACKUP_PANEL_CSS = `
.mesa-bkp{max-width:720px;width:min(720px,94vw);max-height:min(760px,90vh);padding:0;border:1px solid var(--border-strong,var(--border,#c7c7c7));border-radius:var(--r-md,8px);background:var(--surface,#fff);color:var(--fg,#272727);box-shadow:var(--shadow-pop,0 12px 32px -12px rgb(0 0 0/.35))}
.mesa-bkp::backdrop{background:var(--scrim,rgb(0 0 0/.45))}
.mesa-bkp form{display:flex;flex-direction:column;max-height:min(758px,calc(90vh - 2px));min-height:0;margin:0}
.mesa-bkp .mesa-bkp-head{display:flex;align-items:center;gap:var(--space-4,10px);padding:var(--space-5,12px) 20px;border-bottom:1px solid var(--border,#dadada);flex-shrink:0}
.mesa-bkp .mesa-bkp-head h2{margin:0;font-size:var(--fs-xl,15px);font-weight:600;color:var(--fg-strong,#181818);flex:1}
.mesa-bkp .mesa-bkp-body{display:flex;gap:var(--space-6,16px);min-height:0;padding:var(--space-6,16px) 20px;overflow:auto}
.mesa-bkp .mesa-bkp-nav{display:flex;flex-direction:column;gap:var(--space-0,2px);min-width:148px;flex-shrink:0}
.mesa-bkp .mesa-bkp-nav button{justify-content:flex-start;text-align:left;min-height:30px;padding:0 var(--space-4,10px);border-color:transparent;background:transparent;box-shadow:none;color:var(--muted,#525252)}
.mesa-bkp .mesa-bkp-nav button:hover{background:var(--hover,#eee);color:var(--fg,#272727)}
.mesa-bkp .mesa-bkp-nav button[aria-current="true"]{background:var(--selected,#e8e8e8);color:var(--fg-strong,#181818);font-weight:600}
.mesa-bkp .mesa-bkp-sec{flex:1;min-width:0;display:flex;flex-direction:column;gap:var(--space-5,12px)}
.mesa-bkp h3{margin:0;font-size:var(--fs-md,13px);font-weight:600;color:var(--fg-strong,#181818)}
.mesa-bkp p{margin:0;font-size:var(--fs-sm,12px);line-height:1.5;color:var(--muted,#525252)}
.mesa-bkp .mesa-bkp-field{display:flex;flex-direction:column;gap:var(--space-2,6px);font-size:var(--fs-sm,12px);color:var(--muted,#525252)}
.mesa-bkp .mesa-bkp-row{display:flex;gap:var(--space-3,8px);align-items:center;flex-wrap:wrap}
/* Automático em três linhas (auditoria rodada 4, F4): "a cada … horas",
   "parada há … min" e "guardar … versões" se liam como um bloco só. */
.mesa-bkp .mesa-bkp-auto{flex-direction:column;align-items:flex-start;gap:var(--space-2,6px)}
.mesa-bkp .mesa-bkp-row input[type="text"],.mesa-bkp .mesa-bkp-row input[type="url"]{flex:1;min-width:180px;height:30px;padding:0 9px;border:1px solid var(--border-strong,#c7c7c7);border-radius:var(--r-sm,7px);background:var(--surface,#ffffff);color:var(--fg,#272727)}
.mesa-bkp input[type="number"]{width:88px;height:30px;padding:0 8px;border:1px solid var(--border-strong,#c7c7c7);border-radius:var(--r-sm,7px);background:var(--surface,#ffffff);color:var(--fg,#272727)}
/* B1 (auditoria rodada 8): o desabilitado dos ajustes do automático usa a
   mesma opacidade do button:disabled global (style.css). */
.mesa-bkp input[type="number"]:disabled{opacity:.45;cursor:default}
.mesa-bkp .mesa-bkp-check{display:flex;align-items:center;gap:var(--space-3,8px);min-height:24px;font-size:var(--fs-sm,12px);color:var(--fg,#272727);padding:2px 0}
.mesa-bkp .mesa-bkp-check input{width:auto;margin:0;accent-color:var(--primary,#6d28d9)}
.mesa-bkp .mesa-bkp-status{display:flex;flex-direction:column;gap:var(--space-1,4px);border:1px solid var(--border,#dadada);border-radius:var(--r-md,8px);padding:var(--space-5,12px);background:var(--side,#f4f4f4)}
.mesa-bkp .mesa-bkp-status strong{font-size:var(--fs-sm,12px);color:var(--fg-strong,#181818)}
.mesa-bkp .mesa-bkp-status span{font-size:var(--fs-xs,11px);color:var(--muted,#525252)}
.mesa-bkp .mesa-bkp-error,.mesa-bkp .mesa-bkp-status .mesa-bkp-error,.mesa-bkp .mesa-bkp-actions .mesa-bkp-live.mesa-bkp-error{color:var(--danger-text,#dc2626)}
.mesa-bkp .mesa-bkp-ok,.mesa-bkp .mesa-bkp-status .mesa-bkp-ok,.mesa-bkp .mesa-bkp-actions .mesa-bkp-live.mesa-bkp-ok{color:var(--success-text,#16a34a)}
.mesa-bkp .mesa-bkp-warn,.mesa-bkp .mesa-bkp-status .mesa-bkp-warn,.mesa-bkp .mesa-bkp-actions .mesa-bkp-live.mesa-bkp-warn{color:var(--warn-text,#d97706)}
.mesa-bkp ul.mesa-bkp-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:var(--space-3,8px)}
.mesa-bkp ul.mesa-bkp-list li{display:flex;align-items:center;gap:var(--space-4,10px);border:1px solid var(--border,#dadada);border-radius:var(--r-md,8px);padding:var(--space-4,10px) var(--space-5,12px)}
.mesa-bkp ul.mesa-bkp-list li .mesa-bkp-meta{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.mesa-bkp ul.mesa-bkp-list li .mesa-bkp-meta b{font-size:var(--fs-sm,12px);color:var(--fg-strong,#181818)}
.mesa-bkp ul.mesa-bkp-list li .mesa-bkp-meta span{font-size:var(--fs-2xs,10px);color:var(--faint,#6b6b6b)}
.mesa-bkp .mesa-bkp-preview{display:flex;flex-direction:column;gap:var(--space-2,6px);border:1px solid var(--border,#dadada);border-radius:var(--r-md,8px);padding:var(--space-5,12px);background:var(--side,#f4f4f4);max-height:280px;overflow:auto}
.mesa-bkp .mesa-bkp-preview code{font-family:var(--font-mono,ui-monospace,monospace);font-size:var(--fs-2xs,10px);color:var(--muted,#525252)}
/* #140: a transcrição do pacote é texto de terceiro; a prévia mostra o começo
   e o texto inteiro veio por textContent, então esta caixa é só texto. */
.mesa-bkp .mesa-bkp-import{display:flex;flex-direction:column;gap:var(--space-3,8px);border:1px solid var(--border,#dadada);border-radius:var(--r-md,8px);padding:var(--space-5,12px);background:var(--side,#f4f4f4)}
.mesa-bkp .mesa-bkp-import[hidden]{display:none}
.mesa-bkp .mesa-bkp-import h3{margin:0;font-size:var(--fs-md,13px);font-weight:600;color:var(--fg-strong,#181818)}
.mesa-bkp .mesa-bkp-import p{margin:0;font-size:var(--fs-sm,12px);line-height:1.5;color:var(--muted,#525252)}
.mesa-bkp .mesa-bkp-import .mesa-bkp-import-note{color:var(--warn-text,#d97706)}
.mesa-bkp .mesa-bkp-transcript{display:flex;flex-direction:column;gap:var(--space-1,4px);min-width:0}
.mesa-bkp .mesa-bkp-transcript b{font-size:var(--fs-2xs,10px);color:var(--faint,#6b6b6b);overflow-wrap:anywhere}
.mesa-bkp .mesa-bkp-transcript-text{margin:0;max-height:220px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font-family:var(--font-mono,ui-monospace,monospace);font-size:var(--fs-2xs,10px);line-height:1.45;color:var(--fg,#272727);background:var(--surface,#fff);border:1px solid var(--border,#dadada);border-radius:var(--r-sm,7px);padding:var(--space-4,10px)}
.mesa-bkp .mesa-bkp-transcript .mesa-bkp-warn{font-size:var(--fs-2xs,10px);color:var(--warn-text,#d97706)}
.mesa-bkp .mesa-bkp-actions{display:flex;gap:var(--space-5,12px);justify-content:flex-end;align-items:center;flex-wrap:wrap;min-height:52px;margin:0;padding:0 20px;border-top:1px solid var(--border,#dadada);flex-shrink:0}
.mesa-bkp .mesa-bkp-actions .mesa-bkp-live{margin-right:auto;font-size:var(--fs-sm,12px);color:var(--muted,#525252);min-height:18px}
.mesa-bkp button:not(.icon-btn){min-height:30px;padding:0 12px}
.mesa-bkp button.primary{background:var(--primary,#6d28d9);border-color:var(--primary,#6d28d9);color:var(--primary-fg,#fff)}
.mesa-bkp button.primary:hover{background:var(--primary-hover,#5b21b6);border-color:var(--primary-hover,#5b21b6)}
.mesa-bkp button.mesa-bkp-danger{border-color:color-mix(in oklab,var(--danger,#dc2626) 45%,var(--border,#dadada));color:var(--danger-text,#dc2626)}
.mesa-bkp .mesa-bkp-hidden{display:none !important}
@media (max-width:640px){.mesa-bkp .mesa-bkp-body{flex-direction:column}.mesa-bkp .mesa-bkp-nav{flex-direction:row;overflow:auto}}`;

/**
 * Injeta o CSS do painel uma vez no documento.
 * @param {Document} documento
 * @returns {HTMLElement | null}
 * @example const style = ensureStyles(document);
 */
export function ensureStyles(documento) {
  if (!documento || !documento.head) return null;
  if (documento.getElementById(CSS_ID)) return documento.getElementById(CSS_ID);
  const style = /** @type {HTMLStyleElement} */ (documento.createElement('style'));
  style.id = CSS_ID;
  style.textContent = BACKUP_PANEL_CSS;
  documento.head.appendChild(style);
  return style;
}
