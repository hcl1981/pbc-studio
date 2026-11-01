# Speichermessung: einmal auf dem PBC+ und einmal im Emulator laufen lassen,
# beide Ausgaben vergleichen.
import gc
import pbc

gc.collect()
print("frei", gc.mem_free() // 1024, "KB, belegt", gc.mem_alloc() // 1024, "KB")

# Groesster einzelner Block (Intervallschachtelung, auf 1 KB genau)
klein, gross = 0, 2048
while gross - klein > 1:
    mitte = (klein + gross) // 2
    try:
        b = bytearray(mitte * 1024)
        del b
        klein = mitte
    except MemoryError:
        gross = mitte
    gc.collect()
print("groesster Block", klein, "KB")

# Wie viele Canvas 240 x 280 passen?
leinwaende = []
try:
    while True:
        leinwaende.append(pbc.Canvas(240, 280))
except MemoryError:
    pass
print("Canvas 240x280:", len(leinwaende))
leinwaende = []
gc.collect()

# Wie tief darf eine Funktion sich selbst aufrufen?
tiefe = 0
def tiefer(n):
    global tiefe
    tiefe = n
    tiefer(n + 1)
try:
    tiefer(1)
except RuntimeError:
    pass
print("Rekursion bis", tiefe)
