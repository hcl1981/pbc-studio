# MicroPython für den Worker-Emulator

`micropython.mjs` und `micropython.wasm` sind MicroPython 1.29.0 (Port
webassembly) in einer eigenen Variante **pbc**. `build.py` bettet beide
in `dist/index.html` ein. Gebaut mit `./bauen.sh` (Docker-Image
`emscripten/emsdk:3.1.74`).

Warum nicht das fertige Paket `micropython-webassembly-pyscript` vom CDN?
Dessen Speicherbereinigung (`MICROPY_GC_SPLIT_HEAP_AUTO`) räumt nur auf,
wenn MicroPython zu JavaScript zurückkehrt. Im Worker läuft ein Programm
aber am Stück. Der Müll wächst dann, bis der Browser nach etwa 2 GB
abbricht, bei einem Canvas-Spiel nach wenigen Minuten.

Die Variante pbc:

- fester Heap statt wachsendem (Größe legt die IDE fest, wie auf dem Gerät),
- `--spill-pointers`: Zeiger liegen auf dem Schattenstapel, deshalb darf
  die Speicherbereinigung jederzeit laufen (`pbc.patch`), ohne ASYNCIFY,
- Rekursionsgrenze 52 Aufrufe wie auf dem echten PBC+ (gemessen mit `tests/geraet_speicher.py`, `CSTACK_SIZE` 19712 Byte), Meldung „maximum recursion depth exceeded“ wie auf dem Gerät,
- `bytes`/`bytearray` gehen als Kopie (`Uint8Array`) an JavaScript; ein Verweis würde den Puffer festhalten, bis JavaScript ihn freigibt, und das geschieht während eines laufenden Programms nie,
- Funktionsumfang wie die pyscript-Variante (FULL_FEATURES), aber ohne die
  eingefrorenen micropython-lib-Module, die es auf dem PicoBoy auch nicht gibt.
