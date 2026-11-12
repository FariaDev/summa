'use strict';

/* Revert por fronteira do OpenCode (#164): o "tentar de novo" marca a fala do
   aluno, reenvia o mesmo pacote e deixa o `prompt` comitar o revert. Métodos
   instalados no protótipo pelo `opencode-adapter.cjs`; ficam aqui para o
   adaptador continuar abaixo do teto de 500 linhas. */

const {PROMPT_TIMEOUT_MS} = require('./opencode-delivery.cjs');

class OpenCodeRevert {
  /**
   * Marca no OpenCode o ponto de revert antes da fala do aluno (#164). O
   * `prompt` seguinte comita o revert; até lá dá para desfazer com
   * `undoRevert()` sem perder a pergunta nem a resposta antigas.
   * @param {string} messageId id `msg_…` que o servidor deu à fala do aluno
   * @returns {Promise<true>}
   * @example await adapter.stageRevert('msg_abc');
   */
  async stageRevert(messageId) {
    await this.connect();
    const response = await this.http().request('POST', this.route('/revert/stage'), {body: {messageID: messageId}, timeoutMs: PROMPT_TIMEOUT_MS});
    if (!response.ok) {
      throw Object.assign(Error(`O OpenCode não aceitou refazer a última pergunta (HTTP ${response.status}). Nada foi reenviado.`), {notSent: true, status: response.status, code: 'OPENCODE_REVERT_REFUSED'});
    }
    return true;
  }

  /**
   * Desfaz o revert pendente quando o reenvio falhou antes do aceite (#164):
   * o histórico do motor fica como estava (uma pergunta, uma resposta).
   * @returns {Promise<true>}
   * @example await adapter.undoRevert();
   */
  async undoRevert() {
    const response = await this.http().request('DELETE', this.route('/revert'));
    if (!response.ok) {
      throw Object.assign(Error(`O OpenCode não desfez o revert pendente (HTTP ${response.status}). A pergunta antiga pode ter saído do histórico do motor.`), {notSent: true, status: response.status, code: 'OPENCODE_REVERT_UNDO_REFUSED'});
    }
    return true;
  }
}

module.exports = {OpenCodeRevert};
