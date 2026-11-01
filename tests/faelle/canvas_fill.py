import pbc
c = pbc.Canvas(240, 280)
c.fill(pbc.BLUE)
pbc.clear(pbc.RED)
pbc.show(c)
k = pbc.Canvas(100, 50)
try:
    pbc.show(k, 200, 0)
except ValueError as e:
    print("VE", e)
print(c.pixel(5, 5) == pbc.BLUE)
c.ellipse(100, 100, 20, 20, pbc.RED, fill=True)
