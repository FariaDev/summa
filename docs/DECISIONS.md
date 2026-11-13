# Mesa de Estudos — decisions and hypotheses

This document separates requirements explicitly chosen by the user from assistant proposals that remain contestable.

Items under **User decisions** are binding. The **Product close (2026-09-06)** supersedes earlier spatial-canvas requirements for the current product. Those earlier choices are kept under **Deferred north star** so they are not silently dropped.

## User decisions

### Product close (2026-09-06)

- **Current product:** Mesa de Estudos + Xournal++, two windows.
- **Mesa de Estudos owns:** two independent PDF readers, local numeric calculator, Pi chat via RPC, course selector, on-demand Xournal++ capture.
- **Xournal++ owns:** Wacom handwriting. Writing does not move into Mesa.
- **Typical layout:** Mesa on the reference display, Xournal++ on the other; tiled on a single MacBook display.
- **Accepted remaining switch:** Mesa ↔ Xournal++. Preview, Finder, Obsidian, and a separate Pi terminal should not be required in the ordinary loop.
- **Inspection:** only when explicitly requested; capture is the visible Xournal++ window, not a lassoed region and not continuous observation.
- **Tutor behaviour in the desk:** keep the existing Pi learning loop (brief verdict, first meaningful error, one next step, pause). Feedback lives in the chat, including rendered Markdown/LaTeX. There is no in-app ink overlay or stroke-level anchor.
- **Persistence:** desk state and the desk’s Pi JSONL live under `desk/.runtime/`. Course sources stay read-only. The Pi session remains the durable conversation record.
- **Next implementation direction:** UI and UX of the shipped desk. Do not start an in-app canvas unless the user reopens this close.

### Core problem and activity

- **Primary pain:** reduce window/application switching during study.
- **Primary course:** Calculus I; other configured courses are also selectable.
- **Primary activity:** exercise-list practice: read a PDF problem, solve it by hand, obtain step-specific feedback.
- **Preferred writing placement:** blank space beside the problem, not directly over the PDF. In the current product that blank space is Xournal++, not a Mesa canvas.

### Input and displays

- **Primary handwriting device:** Wacom tablet on the Mac, used in Xournal++.
- **Secondary attempt source:** paper notebook photographed with an iPhone and sent to the Mac through AirDrop (still valid; not a Mesa feature).
- **Display environments:** sometimes the MacBook display alone; sometimes the MacBook plus an external display.
- **Pi invocation:** hybrid—quick actions for routine checks (`Conferir Xournal++`), keyboard or macOS dictation for precise follow-ups.

### Process preference

- Do not spawn further subagents or initiate broad research without informing the user and obtaining approval.

## Deferred north star

These were user decisions during the 2026-09-04 canvas exploration. They are **not** current product requirements:

- Truly unbounded attempt surface, with no visible paper edges or page breaks, inside the learning app.
- One separate infinite space per exercise rather than one shared plane.
- Spatially anchored marker and margin hint by default; optional tutor overlay with arrows/highlights; optional clean LaTeX correction beside the work.
- Zero OS-level application switches, including the writing surface.
- Lasso of a selected attempt region as the prompt.

Reopen these only if the user explicitly asks to replace Xournal++ with in-app ink.

## Strongly supported product inferences

These follow from the current close but were not each approved as isolated requirements:

- Mesa should preserve the active course, open PDFs, draft, and session across compact and two-display layouts.
- Open PDF paths and pages are linked context when the user includes references; file contents are not dumped into every prompt.
- Capture sends only the visible Xournal++ window; pages off-screen are out of scope.
- Models without vision should not enable **Conferir Xournal++**.
- The desk must not assume a Pi terminal session is already open.

Inferences that belonged to the in-app canvas (immutable ink checkpoints, “what Pi saw” for stroke groups, feedback tied to attempt versions) remain deferred with that north star.

## Historical proposals, not current work

Discovery considered Obsidian + Excalidraw versus a dedicated canvas app (tldraw or similar) versus native-app window embedding. **None of those is the current product.**

What shipped is a dedicated Electron reference desk plus the existing Xournal++ editor, talking to Pi through JSONL RPC. Native-app window embedding was rejected as a foundation and stays rejected.

Suggested canvas contracts (`check(selection, exerciseSpace)`, structured first-error anchors, annotation primitives) are design hypotheses for the deferred north star, not a schema the desk must implement.

## Explicit non-goals for the current product

- In-app handwriting, infinite canvas, or replacing Xournal++.
- Embedding Preview, Obsidian, or other native app windows.
- Permanent mastery, coverage, or progress tracking.
- Automatic promotion of every attempt into Obsidian notes.
- Continuously monitoring the screen or the Xournal++ window.
- Perfect handwriting-to-LaTeX conversion as a prerequisite.
- Replacing every advanced feature of Preview, Xournal++, or Obsidian.
- Building a generic collaborative whiteboard or permanent visual knowledge base.
- A new voice stack; macOS dictation is enough.
- Symbolic algebra in the calculator; it is local numeric evaluation only.
