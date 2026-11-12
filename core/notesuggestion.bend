import Base

# ---------------------------------------------------------------------------
# Nota sugerida pelo tutor (#139): o que NÃO pode quebrar.
#
# A ferramenta `salvar_nota` deixou de gravar direto em `Notas/`: ela cria uma
# sugestão PENDENTE no chat e o aluno decide ali mesmo. A garantia de domínio:
#
#   - toda sugestão nasce `Pending`; o tutor não tem transição para `Saved`;
#   - `startSave` só libera a gravação a partir de `Pending`, e a gravação
#     confirmada vira `Saved` (a mesma sugestão nunca grava duas vezes);
#   - `Dismissed` é terminal: nem `startSave` nem `confirmSave` gravam;
#   - `writeAllowed` só é verdadeiro em `Saved` — o host grava DEPOIS do
#     clique do aluno, nunca no pedido do tutor.
#
# O host guarda o cartão, faz o I/O de `Notas/` e chama `startSave` no clique
# de "Guardar"; aqui ficam só as decisões. O caminho e o conteúdo continuam
# com o `tutornotes.bend` e o funil de gravação do host.
# ---------------------------------------------------------------------------

type NoteStatus is Data:
  NoteStatus.Pending{}
  NoteStatus.Saved{}
  NoteStatus.Dismissed{}

type SaveStart is Data:
  SaveStart.Write{}
  SaveStart.Already{}
  SaveStart.Refused{}

def newSuggestion() -> NoteStatus:
  NoteStatus.Pending{}

def statusName(+status: NoteStatus) -> String:
  match status:
    case NoteStatus.Pending{}:
      "pending"
    case NoteStatus.Saved{}:
      "saved"
    case NoteStatus.Dismissed{}:
      "dismissed"

# O clique "Guardar" começa a gravação; clicar numa nota já guardada ou
# descartada não grava de novo.
def startSave(+status: NoteStatus) -> SaveStart:
  match status:
    case NoteStatus.Pending{}:
      SaveStart.Write{}
    case NoteStatus.Saved{}:
      SaveStart.Already{}
    case NoteStatus.Dismissed{}:
      SaveStart.Refused{}

# Só o host chama depois de gravar o arquivo; a sugestão vira `Saved` uma vez.
def confirmSave(+status: NoteStatus) -> NoteStatus:
  match status:
    case NoteStatus.Pending{}:
      NoteStatus.Saved{}
    case NoteStatus.Saved{}:
      NoteStatus.Saved{}
    case NoteStatus.Dismissed{}:
      NoteStatus.Dismissed{}

# "Descartar" só vale enquanto pendente; nota guardada não volta atrás.
def dismiss(+status: NoteStatus) -> NoteStatus:
  match status:
    case NoteStatus.Pending{}:
      NoteStatus.Dismissed{}
    case NoteStatus.Saved{}:
      NoteStatus.Saved{}
    case NoteStatus.Dismissed{}:
      NoteStatus.Dismissed{}

def writeAllowed(+status: NoteStatus) -> Bool:
  match status:
    case NoteStatus.Pending{}:
      False{}
    case NoteStatus.Saved{}:
      True{}
    case NoteStatus.Dismissed{}:
      False{}
