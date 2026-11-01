// PicoBoy Studio: like the pyscript variant, but with a fixed heap that
// is collected during long synchronous runs (Web Worker emulator).
#define MICROPY_CONFIG_ROM_LEVEL                (MICROPY_CONFIG_ROM_LEVEL_FULL_FEATURES)
#define MICROPY_PY_WEAKREF                      (1)
#define MICROPY_PBC_SPILL_POINTERS              (1)
