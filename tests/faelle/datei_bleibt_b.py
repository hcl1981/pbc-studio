import os
with open("notiz.txt") as f:
    print(f.read().strip())
print("notiz.txt" in os.listdir(), "stern.png" in os.listdir())
os.remove("notiz.txt")
print("notiz.txt" in os.listdir())
