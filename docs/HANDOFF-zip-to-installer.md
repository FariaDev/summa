# Handoff: switch zip/source installs to the native installer (WIP)

Branch: `devin/1795393242-zip-to-installer` (no PR yet). Delete this file before opening the PR.

## Problem
A 1.3.3 zip user updates to the 1.4.0 zip and stays on zip forever: the updater dispatch in
`desk/update-host.cjs` only sends installed .exe / DMG / AppImage builds to the native updaters.
Nothing offered the installers.

## What is done (commit da10b4a)
- `desk/installer-switch.cjs`: target per OS (`exe` win32 x64, `dmg` darwin arm64 only, since the DMG
  bundles the host Electron; `appimage` linux x64), saves the current `runtimePath`/`vaultPath` into
  `config.json` before anything launches (no data copied; the native build reads the same config dir,
  so the old zip folder must be kept because the runtime still lives there), picks the cached newer
  release or the installed version, downloads + verifies the signed asset, launches it, quits.
  - Windows: Setup `/S /UPDATE` (works for a first install and reopens Summa); releases the
    single-instance lock first and also accepts Setup exit 0 as success.
  - Linux: AppImage into `~/Applications/Summa-x86_64.AppImage` (refuses if it exists), readiness handshake.
  - macOS: `hdiutil attach` + `ditto` into `/Applications/Summa.app` (refuses if it exists / not writable), `open -n`.
- IPC in `update-host.cjs` / `preload.cjs` / `main.cjs`; About row + confirm in `desk/src/installer-switch.mjs`,
  `index.html`, `help-about.css`, both locales.
- Tests: `tests/installer-switch*.test.mjs`, `tests/about-installer-switch-ui.mjs`, named fakes.
- Docs: `docs/agents/release.md`, ADR 0006.

## Verified
- `npm run check`, `npm run typecheck`, `npm run lint` pass.
- Pre-push hook passed (`verify:bend`: artifacts reproducible, all proofs check).

## NOT verified / left to do
1. Run the full suite and the new tests (never completed).
2. Run the About window test and look at the UI (before/after screenshots for the PR).
3. Review the diff (`git diff main...HEAD`); the final review was interrupted.
4. Real end-to-end per OS: zip/source install -> click the About action -> native build installed,
   opens with the same sessions/vault, zip app closed. Linux AppImage rehearsal needs a loopback signed
   release (scratch-only patches: test public key, release URL in `updater-signature.cjs`, tags endpoint
   in `updater-core.cjs`). Windows and macOS need real machines.
5. Open the PR as `SWF(polish|bug): ...` with that evidence; mention in the 1.4.0 release notes
   (PR #187) if it lands before the release.

## Commands to resume
```sh
git fetch origin && git checkout devin/1795393242-zip-to-installer
cd desk && npm ci && npm run setup
npm run check && npm run typecheck && npm run lint
node --test tests/installer-switch.test.mjs tests/installer-switch-host.test.mjs tests/installer-switch-ui.test.mjs
MESA_GATE_CACHE=0 npm test          # Linux: prefix with xvfb-run -a
npm run ui -- about-installer-switch
```
