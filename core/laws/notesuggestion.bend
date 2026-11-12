import Base
import ../notesuggestion.bend as N

# ---------------------------------------------------------------------------
# Contrato da nota sugerida pelo tutor (#139). Prefixo `ns_`.
#
# A lei fixa o invariante que a #139 pediu: NADA é gravado em `Notas/` sem o
# clique do aluno. A sugestão nasce `Pending` (`writeAllowed` falso); só
# `confirmSave` a torna `Saved`, e `Saved` é o único estado que libera a
# gravação. `startSave` a partir de `Saved` é `Already` (não grava de novo) e a
# partir de `Dismissed` é `Refused`; `dismiss` só muda uma sugestão pendente.
#
# O que não cabe aqui: o caminho e o conteúdo (lei em `tutornotes.bend`), o
# I/O de `O_EXCL`/realpath, o cartão em disco e a interface.
# ---------------------------------------------------------------------------

def startName(r: N.SaveStart) -> String:
  match r:
    case N.SaveStart.Write{}:
      "write"
    case N.SaveStart.Already{}:
      "already"
    case N.SaveStart.Refused{}:
      "refused"

def nameOf(status: N.NoteStatus) -> String:
  N.statusName(status)

# ---------- a sugestão nasce pendente e não grava ----------

law ns_new_is_pending:
  {nameOf(N.newSuggestion()) == "pending" : String}

law ns_pending_does_not_write:
  {N.writeAllowed(N.newSuggestion()) == False{} : Bool}

law ns_pending_starts_write:
  {startName(N.startSave(N.newSuggestion())) == "write" : String}

# ---------- só o confirmar (depois do clique) libera a gravação ----------

def saved() -> N.NoteStatus:
  N.confirmSave(N.newSuggestion())

law ns_confirm_pending_saves:
  {nameOf(saved()) == "saved" : String}

law ns_saved_writes:
  {N.writeAllowed(saved()) == True{} : Bool}

law ns_saved_never_writes_again:
  {startName(N.startSave(saved())) == "already" : String}

law ns_confirm_saved_keeps:
  {nameOf(N.confirmSave(saved())) == "saved" : String}

# ---------- descartar é terminal ----------

def dismissed() -> N.NoteStatus:
  N.dismiss(N.newSuggestion())

law ns_dismiss_pending_dismisses:
  {nameOf(dismissed()) == "dismissed" : String}

law ns_dismiss_does_not_write:
  {N.writeAllowed(dismissed()) == False{} : Bool}

law ns_dismissed_refuses_save:
  {startName(N.startSave(dismissed())) == "refused" : String}

law ns_confirm_dismissed_keeps:
  {nameOf(N.confirmSave(dismissed())) == "dismissed" : String}

# ---------- guardar não volta atrás ----------

law ns_dismiss_saved_keeps:
  {nameOf(N.dismiss(saved())) == "saved" : String}

law ns_saved_still_writes:
  {N.writeAllowed(N.dismiss(saved())) == True{} : Bool}
