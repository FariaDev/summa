#!/bin/bash
set -euo pipefail
image=$(realpath "$1")
state=$(mktemp -d)
export HOME="$state/home" XDG_DATA_HOME="$state/share"
export LEARNING_DESK_RUNTIME="$state/runtime" LEARNING_VAULT="$state/vault"
mkdir -p "$HOME" "$LEARNING_DESK_RUNTIME" "$LEARNING_VAULT"
"$image" >"$state/output.log" 2>&1 &
pid=$!
trap 'kill "$pid" 2>/dev/null || true; rm -rf "$state"' EXIT
for ((attempt=0; attempt<60; attempt++)); do
  kill -0 "$pid" || { cat "$state/output.log"; exit 1; }
  if xwininfo -root -tree | grep -q '"Summa'; then
    test -s "$LEARNING_DESK_RUNTIME/desk.log"
    test -s "$XDG_DATA_HOME/applications/summa.desktop"
    cat "$LEARNING_DESK_RUNTIME/desk.log"
    xwininfo -root -tree | grep '"Summa'
    echo 'AppImage: janela, log e integração desktop conferidos'
    exit 0
  fi
  sleep 1
done
cat "$state/output.log"
echo 'AppImage: janela não abriu no prazo' >&2
exit 1
