// @ts-check
import {t} from './ui-text.mjs';

/* Interruptor "Buscar também na escrita à mão" das Configurações, em Recursos
   da mesa. Liga a ponte com o Ambitus (`ambitus-ink-set`): ligado, o Ambitus
   manda as páginas com tinta e o modelo da pessoa devolve o texto para a busca.
   Vale na hora, fora do Salvar do diálogo, porque o main confere o modelo antes
   de gravar e pode recusar. O markup mora aqui pelo mesmo motivo da
   `settings-reading.mjs`: o `index.html` legado só encolhe. */

const INK_CONTROLS = `
<div class="set-group" id="ambitus-ink">
 <label class="set-check"><input type="checkbox" id="cfg-ambitus-ink" aria-describedby="ambitus-ink-note"><span data-i18n="settings.ambitusInk">Buscar também na escrita à mão</span></label>
 <p class="fine" id="ambitus-ink-note" data-i18n="settings.ambitusInk.note">O Ambitus manda as páginas com tinta ao seu modelo para virar texto na busca. Modelos gratuitos ou sem visão não são usados.</p>
 <p class="fine set-error" id="ambitus-ink-error" role="alert" hidden></p>
</div>`;

/** Chave do aviso para o motivo de não ligar. @param {string|null|undefined} reason @returns {string} */
export function inkReasonKey(reason) {
  if (reason === 'claude-unavailable') return 'settings.ambitusInk.claude';
  if (reason === 'no-vision' || reason === 'free') return 'settings.ambitusInk.noVision';
  if (reason === 'no-model') return 'settings.ambitusInk.noModel';
  return 'settings.ambitusInk.failed';
}

/**
 * Insere o interruptor depois do último grupo de Recursos da mesa, uma vez só.
 * @param {Document} [doc]
 * @returns {boolean} true quando o markup entrou agora
 * @example mountInkSettings()
 */
export function mountInkSettings(doc = document) {
  const section = doc.querySelector('#settings-sec-mesa');
  const groups = section?.querySelectorAll(':scope > .set-group');
  const last = groups?.[groups.length - 1];
  if (!section || !last || section.querySelector('#cfg-ambitus-ink')) return false;
  last.insertAdjacentHTML('afterend', INK_CONTROLS);
  return true;
}

/**
 * Liga o interruptor ao main. `refresh` repinta pelo estado salvo (ao abrir as
 * Configurações); a mudança chama `set` e, recusada, volta a caixa e diz o motivo.
 * @param {{status: () => Promise<{enabled: boolean, reason: string|null}>,
 *   set: (payload: {on: boolean}) => Promise<{ok: boolean, reason?: string}>}} deps
 * @param {Document} [doc]
 * @returns {{refresh: () => Promise<void>}}
 * @example const ink = initInkSettings({status: () => window.desk.ambitusInkStatus(), set: p => window.desk.ambitusInkSet(p)});
 */
export function initInkSettings({status, set}, doc = document) {
  const box = /** @type {HTMLInputElement|null} */ (doc.querySelector('#cfg-ambitus-ink'));
  const error = /** @type {HTMLElement|null} */ (doc.querySelector('#ambitus-ink-error'));
  /** @param {string} key */
  const showError = (key) => {
    if (!error) return;
    error.textContent = key ? t(key) : '';
    error.hidden = !key;
  };
  async function refresh() {
    if (!box) return;
    try {
      const now = await status();
      box.checked = !!now.enabled;
      showError(now.enabled && now.reason ? inkReasonKey(now.reason) : '');
    } catch { showError(''); }
  }
  box?.addEventListener('change', async () => {
    const on = box.checked;
    box.disabled = true;
    showError('');
    try {
      const result = await set({on});
      if (!result.ok) {
        box.checked = !on;
        showError(inkReasonKey(result.reason));
      }
    } catch {
      box.checked = !on;
      showError('settings.ambitusInk.failed');
    } finally { box.disabled = false; }
  });
  return {refresh};
}
