// @ts-check
import {t} from './ui-text.mjs';
import {bendList} from './chat/chat-assets.mjs';

/**
 * Os fatos das imagens da bandeja para `core/attachview.bend`: a mesma lista
 * serve à bandeja do tutor (`chat-attachments.mjs`) e à do chat lateral
 * (`sidechat-attach.mjs`), então as duas desenham a miniatura e o × igual.
 * @param {Array<{dataUrl: string, name?: string}>} items imagens na ordem da bandeja
 * @returns {Record<string, any>} lista Bend de `AttachImage`
 * @example imageFacts([{dataUrl: 'data:image/png;base64,AA', name: 'a.png'}]) // Con{head: AttachImage{key: 'img-0', ...}}
 */
export function imageFacts(items) {
  return bendList(items.map((item, at) => ({
    $: 'AttachImage', key: `img-${at}`, dataUrl: item.dataUrl,
    alt: item.name ? t('attach.alt', {name: item.name}) : t('attach.altImage'),
    removeLabel: t('attach.remove', {name: item.name || t('attach.imageWord')}), removeTitle: '', handler: 'RemoveAttachment', lazy: false,
  })));
}
