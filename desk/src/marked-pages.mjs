// @ts-check
/* Marcas do tutor no chat (#113): quando uma chamada de `ler_pdf` tem
   `marcas`, o PNG que o motor recebe também vira imagem visível do turno do
   aluno. Este módulo é a fonte única do formato — os adaptadores dos dois
   motores guardam os blocos de imagem, o serviço nativo injeta a mensagem de
   exibição e o renderer/exportação leem o mesmo marcador. */

const MARK_PREFIX = 'mesa-pdf-mark';
/* A chamada que gerou a imagem viaja no `source` porque o descritor normaliza
   as mensagens e só conserva string ali (#113): o id é a âncora para o
   histórico reinserir a página depois da mesma chamada. */
const CALL_SUFFIX = '#call=';

/** @param {unknown} file @returns {string} */
function baseName(file) {
  return String(file || '').split(/[\\/]/).pop() || '';
}

/**
 * O marcador guardado em `source` da parte de imagem. O descritor só aceita
 * string em `source`; o renderer e a exportação o traduzem no idioma da tela.
 * @param {number} page @param {string} file @param {string} [toolCallId]
 * @returns {string}
 * @example markSource(3, 'Aula.pdf') // 'mesa-pdf-mark:3:Aula.pdf'
 */
export function markSource(page, file, toolCallId = '') {
  const base = `${MARK_PREFIX}:${Number(page) || 1}:${baseName(file)}`;
  return toolCallId ? `${base}${CALL_SUFFIX}${encodeURIComponent(toolCallId)}` : base;
}

/**
 * Lê o marcador de uma imagem; `null` para imagem comum (anexo do aluno).
 * @param {unknown} source
 * @returns {{page: number, file: string}|null}
 * @example markOf('mesa-pdf-mark:3:Aula.pdf') // {page: 3, file: 'Aula.pdf'}
 */
export function markOf(source) {
  const match = new RegExp(`^${MARK_PREFIX}:(\\d+):(.*)$`).exec(String(source || ''));
  if (!match) return null;
  return {page: Number(match[1]), file: match[2].replace(/#call=[^#]*$/, '')};
}

/** O id da chamada guardado no `source`; '' quando a marca não o tem. */
function markCallOf(source) {
  const text = String(source || '');
  if (!markOf(text)) return '';
  const at = text.lastIndexOf(CALL_SUFFIX);
  if (at < 0) return '';
  try {
    return decodeURIComponent(text.slice(at + CALL_SUFFIX.length));
  } catch {
    return '';
  }
}

/* O mesmo `source` com a chamada anexada (sem repetir se já veio). */
function withMarkCall(source, toolCallId) {
  const base = String(source || '').replace(/#call=[^#]*$/, '');
  return toolCallId ? `${base}${CALL_SUFFIX}${encodeURIComponent(toolCallId)}` : base;
}

/**
 * O nome que o modelo vê muda por motor (`ler_pdf`, `mesa_ler_pdf`,
 * `mcp__mesa__ler_pdf`), mas todos terminam em `ler_pdf`.
 * @param {unknown} name @returns {boolean}
 */
export function isPdfReadTool(name) {
  return /(?:^|_)ler_pdf$/.test(String(name || ''));
}

/**
 * Blocos de imagem de um resultado de ferramenta. O MCP entrega
 * `{type:'image', data, mimeType}`; o histórico do Claude entrega a forma do
 * SDK (`{type:'image', source:{type:'base64', media_type, data}}`).
 * @param {unknown} content
 * @returns {Array<{data: string, mimeType: string, page?: number, file?: string}>}
 */
export function imageBlocksOf(content) {
  if (!Array.isArray(content)) return [];
  const out = [];
  for (const part of content) {
    if (!part || part.type !== 'image') continue;
    const nested = part.source && typeof part.source === 'object' ? part.source : null;
    const data = typeof (nested ? nested.data : part.data) === 'string' ? (nested ? nested.data : part.data) : '';
    if (!data) continue;
    const mime = String((nested ? nested.media_type || nested.mimeType : part.mimeType || part.mime) || 'image/png');
    out.push({
      data,
      mimeType: mime,
      ...(Number.isInteger(part.page) && part.page > 0 ? {page: part.page} : {}),
      ...(typeof part.file === 'string' && part.file ? {file: part.file} : {}),
    });
  }
  return out;
}

/**
 * As imagens que o aluno deve ver: só de `ler_pdf` com `marcas`. A página sai
 * do bloco (quando o motor preserva) ou do `pagina` da chamada mais o índice.
 * @param {{name?: unknown, args?: unknown, images?: unknown}} event
 * @returns {Array<{data: string, mimeType: string, page: number, file: string, source: string}>}
 * @example markedImagesOf({name: 'mesa_ler_pdf', args: {marcas: [{}], pagina: 2, caminho: '/c/Aula.pdf'}, images: [{data: '…'}]})
 */
export function markedImagesOf(event) {
  if (!event || !isPdfReadTool(event.name)) return [];
  const args = event.args && typeof event.args === 'object' ? /** @type {Record<string, unknown>} */ (event.args) : {};
  if (!Array.isArray(args.marcas) || !args.marcas.length) return [];
  const blocks = Array.isArray(event.images) ? event.images : [];
  const first = Number.isInteger(Number(args.pagina)) && Number(args.pagina) > 0 ? Number(args.pagina) : 1;
  const file = baseName(args.caminho);
  return blocks
    .filter((image) => image && typeof image.data === 'string' && image.data)
    .map((image, index) => {
      const page = Number.isInteger(image.page) && image.page > 0 ? image.page : first + index;
      const name = typeof image.file === 'string' && image.file ? image.file : file;
      return {
        data: image.data,
        mimeType: typeof image.mimeType === 'string' && image.mimeType ? image.mimeType : 'image/png',
        page,
        file: name,
        source: markSource(page, name),
      };
    });
}

/**
 * A mensagem de exibição que carrega a página marcada. É uma mensagem própria,
 * logo depois da chamada, para o histórico reconstruir o mesmo turno do vivo.
 * `toolCallId` é a chamada de `ler_pdf` que gerou a imagem: é a âncora para
 * reinseri-la depois da mesma chamada no histórico do servidor.
 * @param {Array<{data: string, mimeType: string, source: string}>} images
 * @param {number} [at]
 * @param {string} [toolCallId]
 * @returns {{role: 'assistant', content: Array<{type: 'image', data: string, mimeType: string, source: string}>, timestamp?: number, toolCallId?: string}}
 * @example markedImageMessage([{data: '…', mimeType: 'image/png', source: 'mesa-pdf-mark:2:Aula.pdf'}], Date.now(), 'call_1')
 */
export function markedImageMessage(images, at, toolCallId = '') {
  const call = typeof toolCallId === 'string' ? toolCallId : '';
  return {
    role: 'assistant',
    content: images.map((image) => ({type: 'image', data: image.data, mimeType: image.mimeType, source: withMarkCall(image.source, call)})),
    ...(Number.isFinite(at) && at > 0 ? {timestamp: at} : {}),
    ...(call ? {toolCallId: call} : {}),
  };
}

/** @typedef {{toolCallId?: unknown, timestamp?: unknown, content?: unknown}} LooseMessage */
/** @typedef {{type?: unknown, source?: unknown, id?: unknown}} LoosePart */

/* A chamada da mensagem marcada: o campo (na memória) ou o id guardado no
   `source` (o descritor normalizado só conserva o segundo). */
/** @param {LooseMessage} message @param {string[]} sources @returns {string} */
function markedMessageCall(message, sources) {
  if (typeof message?.toolCallId === 'string' && message.toolCallId) return message.toolCallId;
  for (const source of sources) {
    const call = markCallOf(source);
    if (call) return call;
  }
  return '';
}

/* Fontes marcadas de uma mensagem; vazio quando não é página marcada. */
/** @param {LooseMessage} message @returns {string[]} */
function markedSourcesOf(message) {
  if (!Array.isArray(message?.content)) return [];
  const out = [];
  for (const raw of message.content) {
    const part = /** @type {LoosePart} */ (raw);
    if (part?.type !== 'image') continue;
    const mark = markOf(part.source);
    if (mark) out.push(String(part.source));
  }
  return out;
}

/**
 * Histórico do servidor + as páginas marcadas que só o descritor local tem.
 * O servidor é a base: do descritor saem SÓ as mensagens com `source` marcado,
 * cada uma logo depois da mensagem que declara o `toolCall` do mesmo
 * `toolCallId` (sem âncora, no fim). Sem marca no descritor devolve o próprio
 * histórico do servidor, sem mexer em nada.
 * @param {unknown[]} native
 * @param {unknown[]} prior
 * @returns {unknown[]}
 * @example reinsertMarkedImages([{role: 'assistant', content: [{type: 'toolCall', id: 'call_1'}]}], [{role: 'assistant', toolCallId: 'call_1', content: [{type: 'image', source: 'mesa-pdf-mark:2:Aula.pdf'}]}])
 */
export function reinsertMarkedImages(native, prior) {
  const list = /** @type {LooseMessage[]} */ (Array.isArray(native) ? native : []);
  /** @type {LooseMessage[]} */
  const marked = [];
  const seen = new Set();
  for (const raw of Array.isArray(prior) ? prior : []) {
    const message = /** @type {LooseMessage} */ (raw);
    const sources = markedSourcesOf(message);
    if (!sources.length) continue;
    const call = markedMessageCall(message, sources);
    /* Descritores anteriores a esta correção não guardam o id da chamada: o
       carimbo separa duas marcas da mesma página sem duplicar ao reabrir. */
    const key = `${call}|${sources.join(',')}|${call ? '' : (message.timestamp ?? '')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    marked.push(message);
  }
  if (!marked.length) return list;
  const out = [...list];
  const tail = [];
  for (const message of marked) {
    const sources = markedSourcesOf(message);
    const call = markedMessageCall(message, sources);
    const at = call ? out.findLastIndex((item) => Array.isArray(item?.content) && item.content.some((part) => part?.type === 'toolCall' && String(part.id ?? '') === call)) : -1;
    if (at < 0) {
      tail.push(message);
      continue;
    }
    out.splice(at + 1, 0, message);
  }
  out.push(...tail);
  return out;
}
