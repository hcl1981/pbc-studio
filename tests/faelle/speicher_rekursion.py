# Endlose Rekursion endet nach 52 Aufrufen wie auf einem echten PBC+
# (gemessen mit geraet_speicher.py am 14.10.2026).
tiefe = 0
def tiefer(n):
    global tiefe
    tiefe = n
    tiefer(n + 1)
try:
    tiefer(1)
except RuntimeError as e:
    print("Rekursion bis", tiefe, e)
