import pbc
import time
leinwaende = []
for i in range(4):
    leinwaende.append(pbc.Canvas(240, 280))
    time.sleep_ms(10)
    print(i + 1, "Canvas ok")
