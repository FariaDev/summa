# Summa — comece aqui

Mesa de referências local (Electron) para estudar ao lado do Xournal++. O código
está em `desk/` (app), `core/` (núcleo Bend) e `visual-check/` (helper de captura
no macOS).

## Estado atual

- O motor visível é o **OpenCode** (`desk/visible-engines.cjs`). O código do
  Claude Code continua no repositório para testes e sessões antigas; o Pi foi
  aposentado e sessões JSONL antigas abrem só para leitura ([`CONTEXT.md`](../CONTEXT.md)).
- Dois leitores de PDF independentes, tutor, calculadora, GeoGebra e a aba
  **Livre** para estudo avulso, na mesma janela.
- O Xournal++ (ou o programa escolhido no Conferir) continua sendo o editor de
  escrita. A Mesa não implementa canvas de tinta.
- Os PDFs e materiais de curso são abertos somente para leitura.
- O tutor responde no loop: veredito breve, primeiro erro ou lacuna que importa,
  menor próximo passo que destrava, e a vez volta ao aluno
  (`desk/templates/TUTOR.md`).
- O login do provedor acontece dentro do app, e a conta fica no motor.
  **Relatar um problema** monta um relatório limpo e leva à issue no
  repositório público `FariaDev/summa`.
- O problema original era a troca de janelas e a transferência manual de
  contexto; a mesa junta os PDFs da matéria, a calculadora e o tutor numa janela
  só, e a troca Mesa ↔ Xournal++ é aceita. O loop comum não deve pedir apps
  extras (Preview, Finder, Obsidian ou um terminal do tutor).
- A mesa é memória de trabalho temporária, não um sistema de gestão de
  conhecimento.

## Leia a seguir

1. [`AGENTS.md`](../AGENTS.md) — regras, portões e onde mora cada camada.
2. [`agents/mapa.md`](agents/mapa.md) — mapa de features (núcleo → artefato →
   aplicador → IPC → testes).
3. [`../desk/README.md`](../desk/README.md) — como o app funciona por dentro.
4. [`../CONTEXT.md`](../CONTEXT.md) e [`adr/`](adr/) — vocabulário e decisões.

## Documentos vivos × registro histórico

| Vivos | Histórico |
|---|---|
| `AGENTS.md`, `CONTEXT.md`, `docs/START-HERE.md`, `docs/agents/*.md`, `README.md`, `README.en.md`, `desk/README.md`, `desk/SETUP.md`, `core/README.md`, `visual-check/README.md`, `desk/UI-PORT.md` | arquivos datados em `docs/` (`STATUS-*`, `PLANO-*`, `REVIEW-*`, `RESILIENCE-*`, `RELEASE-0.5.0.md`, `PI-*`), `docs/RESEARCH.md`, `docs/DECISIONS.md` e tudo em `docs/reviews/` |

O histórico registra o que foi decidido, medido ou tentado; **não descreve o
estado atual**. Não edite nem mova esses arquivos: eles explicam porquês. Se um
fato do presente só aparecer lá, confira no código antes de usá-lo.

## Identidade da sessão original

- Sessão original do Pi: `01a06d32-3955-7236-9171-2f0a5f5ad486`, formato Pi
  JSONL v3, iniciada em `2026-09-04T16:13:23.158Z`.
- Fechamento do produto em `2026-09-06`: mesa de duas janelas aceita; canvas
  dentro do app adiado.
- Decisões que continuam: o Xournal++ (ou outro programa) é o editor de escrita;
  a Mesa não tem canvas de tinta; fontes de curso são só leitura; o tutor
  mantém o loop acima.

A sessão original é registro histórico; não descreve o produto de hoje.

## Próximos passos

O produto não está em descoberta. O canvas dentro do app segue adiado e o
próximo trabalho é de UI/UX da Mesa, com escopo explícito; o Xournal++ continua o
editor de escrita e as fontes de curso continuam só leitura.
