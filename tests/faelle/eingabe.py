import pbc
t = input("Wort: ").upper()
print(t, "input(x) bleibt")
# input( im Kommentar
n = int(input("Zahl: ")) + len(input('noch eins: '))
print(n)
pbc.rgb_led(300, -5, 128)
try:
    pbc.tone(466.5)
except TypeError as e:
    print("TypeError", e)
print("abc"[5])
