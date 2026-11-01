import pbc
pbc.clear()
pbc.text12("Hallo",
           20, 20,
           pbc.WHITE)
for i in range(3):
    pbc.fill_rect(10 + 30 * i, 60, 20,
                  20, pbc.RED)
def f():
    pbc.text12("in f", 20,
               120, pbc.YELLOW)
f()
print("ok")
