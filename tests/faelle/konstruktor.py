import time

class Uhr:
    def __init__(self, name, start=0):
        self.name = name
        time.sleep_ms(10)
        self.wert = start
        self.einstellen(5)

    def einstellen(self, n):
        time.sleep_ms(10)
        self.wert += n

    def __str__(self):
        return self.name + ":" + str(self.wert)

class Wecker(Uhr):
    def __init__(self, name):
        super().__init__(name, 100)
        self.laut = True

class Stoppuhr(Uhr):
    pass

def mach(n):
    return Uhr("u" + str(n), n)

a = Uhr("a")
print(a, a.wert)
w = Wecker("w")
print(w, w.laut)
s = Stoppuhr("s", 7)
print(s)
liste = [Uhr("x" + str(i), i) for i in range(3)]
print([str(u) for u in liste])
grosse = [mach(i) for i in range(5) if i % 2 == 0]
print(len(grosse), grosse[-1])
def langsam(x):
    time.sleep_ms(5)
    return x * x
print([langsam(i) for i in range(4)], sum([langsam(i) for i in range(3)]))
print(isinstance(w, Uhr), type(a).__name__)
