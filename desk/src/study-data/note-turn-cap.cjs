// @ts-check
'use strict';

/* Teto de SUGESTÕES de `salvar_nota` por turno do aluno (auditoria de
   segurança): no máximo 3 notas sugeridas por turno, para material não
   confiável não transformar uma ordem escondida numa enxurrada de cartões. Vale
   para os dois motores porque mora na criação da sugestão (`suggestNote` em
   `card-session.cjs`), antes de o cartão nascer; o clique "Guardar" do aluno
   não passa por teto, porque grava o que já foi sugerido. O host avisa o turno
   novo (`newStudentTurn`) a cada mensagem aceita do aluno
   (`tutor-prompt-host.cjs`), nunca no resultado de cartão. A nota continua sem
   aprovação: mudar isso é decisão do autor.

   Só conta a sugestão validada; a quarta do mesmo turno recebe
   `err.note.turnCap` antes de criar cartão. Turno cancelado não mexe aqui: o
   próximo `newTurn` libera de novo. Não é lei do núcleo Bend (ADR 0003): o
   núcleo prova o invariante do arquivo (fica em `Notas/`, nunca sobrescreve), e
   esta é política de ritmo do host — o número 3 é ajuste, não verdade de
   domínio que a quebra custaria ao aluno. */

const {message} = require('../i18n.mjs');

const MAX_NOTES_PER_TURN = 3;

/**
 * O teto de sugestões do turno, por conversa e época.
 * @param {{max?: number}} [options]
 * @example const cap = createNoteTurnCap(); cap.allows('conversa') // true
 */
function createNoteTurnCap({max = MAX_NOTES_PER_TURN} = {}) {
  let epoch = 0;
  const saved = new Map();
  const keyOf = (scopeKey) => `${scopeKey}#${epoch}`;
  return {
    /** Turno novo do aluno: a próxima rodada volta a ter o teto cheio. */
    newTurn() {
      epoch += 1;
      /* As chaves carregam a época, então o que ficou para trás nunca mais é
         lido; limpar aqui é só não guardar lixo. */
      saved.clear();
    },
    /**
     * Diz se cabe mais uma sugestão neste turno e conversa, sem contar ainda.
     * @param {string} scopeKey conversa atual (a época do turno fica aqui dentro)
     */
    allows(scopeKey) {
      return (saved.get(keyOf(scopeKey)) || 0) < max;
    },
    /**
     * Conta uma sugestão que acabou de nascer no turno e conversa.
     * @param {string} scopeKey conversa atual (a época do turno fica aqui dentro)
     */
    record(scopeKey) {
      saved.set(keyOf(scopeKey), (saved.get(keyOf(scopeKey)) || 0) + 1);
    },
  };
}

/**
 * O erro que o modelo recebe ao passar do teto: marcado para o catálogo, na
 * língua do tutor, mandando contar ao aluno o que não foi salvo.
 * @param {number} [max]
 */
function turnCapError(max = MAX_NOTES_PER_TURN) {
  return Error(message('err.note.turnCap', {max}));
}

module.exports = {MAX_NOTES_PER_TURN, createNoteTurnCap, turnCapError};
