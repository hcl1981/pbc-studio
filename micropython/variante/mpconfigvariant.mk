JSFLAGS += -s ALLOW_MEMORY_GROWTH
# Every pointer held in a local is spilled to the shadow stack, so the GC
# finds all roots by scanning that stack alone (no ASYNCIFY needed).
JSFLAGS += -s BINARYEN_EXTRA_PASSES=--spill-pointers
LDFLAGS += -Os

FROZEN_MANIFEST ?= variants/manifest.py
JSFLAGS += -s STACK_SIZE=1048576
