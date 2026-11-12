// GERADO de core/notesuggestion.bend por `bun core/build.mjs` — não editar à mão.
// core/notesuggestion.bend
function str_out(s) {
  return s.replace(/\uDC00[^]{3}/gu, "�");
}
function run_loop(r) {
  while (r !== null && typeof r === "object" && r.$ === "$JMP") {
    r = r.f(r.x);
  }
  return r;
}
function run_lib(f, n) {
  return (...a) => a.length < n ? run_lib((...b) => f(...a, ...b), n - a.length) : run_loop(f(...a));
}
var $0eff = Object.create(null);
var io_file_append = new Set;
function $newSuggestion() {
  return { $: "NoteStatus.Pending" };
}
function $statusName(_status_0) {
  if (_status_0.$ === "NoteStatus.Pending") {
    return "pending";
  } else if (_status_0.$ === "NoteStatus.Saved") {
    return "saved";
  } else {
    return "dismissed";
  }
}
function $startSave(_status_0) {
  if (_status_0.$ === "NoteStatus.Pending") {
    return { $: "SaveStart.Write" };
  } else if (_status_0.$ === "NoteStatus.Saved") {
    return { $: "SaveStart.Already" };
  } else {
    return { $: "SaveStart.Refused" };
  }
}
function $confirmSave(_status_0) {
  if (_status_0.$ === "NoteStatus.Pending") {
    return { $: "NoteStatus.Saved" };
  } else if (_status_0.$ === "NoteStatus.Saved") {
    return { $: "NoteStatus.Saved" };
  } else {
    return { $: "NoteStatus.Dismissed" };
  }
}
function $dismiss(_status_0) {
  if (_status_0.$ === "NoteStatus.Pending") {
    return { $: "NoteStatus.Dismissed" };
  } else if (_status_0.$ === "NoteStatus.Saved") {
    return { $: "NoteStatus.Saved" };
  } else {
    return { $: "NoteStatus.Dismissed" };
  }
}
function $writeAllowed(_status_0) {
  if (_status_0.$ === "NoteStatus.Pending") {
    return false;
  } else if (_status_0.$ === "NoteStatus.Saved") {
    return true;
  } else {
    return false;
  }
}
var notesuggestion_default = {
  newSuggestion: run_lib(() => run_loop($newSuggestion()), 0),
  statusName: run_lib((a0) => str_out(run_loop($statusName(a0))), 1),
  startSave: run_lib((a0) => run_loop($startSave(a0)), 1),
  confirmSave: run_lib((a0) => run_loop($confirmSave(a0)), 1),
  dismiss: run_lib((a0) => run_loop($dismiss(a0)), 1),
  writeAllowed: run_lib((a0) => run_loop($writeAllowed(a0)), 1)
};
export {
  notesuggestion_default as default
};
