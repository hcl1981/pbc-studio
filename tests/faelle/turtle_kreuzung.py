# "berührt Farbe" must notice a slanted crossing of a 1-px trail:
# two diagonal lines can cross without sharing a pixel.
import pbc
from turtle import Turtle

t = Turtle()
t.speed(0)
t.hide()
verfehlt = 0
n = 0
for wa in range(5, 180, 20):
    for wb in range(15, 360, 40):
        if abs((wb - wa) % 180) < 25 or abs((wb - wa) % 180) > 155:
            continue
        t.clear()
        t.setPenColor(pbc.RED)
        t.penUp(); t.setPosition(0.3, 0.6); t.setDirection(wa); t.penDown()
        t.forward(50); t.back(100)
        t.penUp(); t.setPosition(0, 0); t.setDirection(wb); t.back(30)
        t.setPenColor(pbc.CYAN); t.penDown()
        getroffen = False
        for _ in range(60):
            t.forward(1)
            if t.on_color(pbc.RED):
                getroffen = True
                break
        n += 1
        if not getroffen:
            verfehlt += 1
print("Kreuzungen", n, "verfehlt", verfehlt)
