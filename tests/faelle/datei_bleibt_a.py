import os
with open("notiz.txt", "w") as f:
    f.write("Hallo Datei\n")
print([n for n in os.listdir() if n.endswith(".txt")], "tmp" in os.listdir())
