#!/bin/bash
# Builds MicroPython 1.29.0 (webassembly port, variant "pbc") for the
# worker emulator and copies micropython.mjs/.wasm next to this script.
# Needs git and docker. Usage: ./bauen.sh [work directory]
set -euo pipefail
HIER="$(cd "$(dirname "$0")" && pwd)"
ARBEIT="${1:-$HIER/.bau}"
mkdir -p "$ARBEIT"
if [ ! -d "$ARBEIT/micropython" ]; then
  git clone --depth 1 --branch v1.29.0 https://github.com/micropython/micropython.git "$ARBEIT/micropython"
  (cd "$ARBEIT/micropython" && git apply "$HIER/pbc.patch")
fi
mkdir -p "$ARBEIT/micropython/ports/webassembly/variants/pbc"
cp "$HIER"/variante/* "$ARBEIT/micropython/ports/webassembly/variants/pbc/"
docker run --rm -u "$(id -u):$(id -g)" -v "$ARBEIT/micropython:/src" -w /src emscripten/emsdk:3.1.74 \
  bash -c "make -C mpy-cross -j8 && make -C ports/webassembly VARIANT=pbc -j8"
cp "$ARBEIT/micropython/ports/webassembly/build-pbc/micropython."{mjs,wasm} "$HIER/"
sha256sum "$HIER/micropython."{mjs,wasm}
