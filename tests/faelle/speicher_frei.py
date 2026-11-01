# A program finds about as much free memory as on the PicoBoy (~448 KB,
# a little more in the emulator), and the garbage of a long run is
# collected (10 MB in total here).
import gc
gc.collect()
frei = gc.mem_free() // 1024
print("frei ok" if frei >= 440 else "frei " + str(frei))
print("wie Geraet" if frei <= 500 else "ohne Grenze")
for i in range(100):
    x = bytes(100000)
del x
gc.collect()
print("nach Muell ok" if gc.mem_free() // 1024 >= frei - 5 else "Muell bleibt liegen")
