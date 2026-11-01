import time
def doppel(x):
    time.sleep_ms(1)
    return x * 2
class P:
    def wert(self):
        time.sleep_ms(1)
        return 7
print(doppel(doppel(1)), doppel(3) + doppel(4) * 2)
print("Text doppel(3) und .wert()")  # doppel(9)
p = P()
print(p.wert() + doppel(p.wert()), str(doppel(5)))
w = [doppel(i) for i in range(3)]
print(w, max(doppel(2), doppel(3)))
