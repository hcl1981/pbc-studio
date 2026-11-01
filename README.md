# PBC+ Studio

Programmierumgebung im Browser für den PicoBoy Color Plus: Blöcke und Python,
mit Emulator und Übertragung per USB. Online unter <https://pbcstudio.de>.

Die Tests unter `tests/` erwarten daneben die Ordner `showcase_bloecke/` und
`dokumentation/`, die nicht zu diesem Repository gehören. `kontakt.php` für das
Kontaktformular liegt nur auf dem Webspace.

Ergebnis ist wieder **eine einzige Datei**, die auf den Webspace kommt.

## Hochladen

```
python3 build.py          # erzeugt dist/index.html, dist/.htaccess, dist/pbcp.png
```

`index.html` und `.htaccess` aus `dist/` in den Webspace legen (neben
`micropythonPBCP.uf2`, `kontakt.php` und `pbcp.png`, dem Platinenfoto des
Emulators, das dort schon liegt; `dist/pbcp.png` ist dieselbe Datei). Die `.htaccess` setzt zwei HTTP-Header
(Cross-Origin-Opener-Policy, Cross-Origin-Embedder-Policy). **Der Emulator
braucht sie**; ohne sie (lokal geöffnete Datei, anderer Server) meldet er
das im Terminal und unter **Einstellungen → Emulator**. Der Rest der IDE
(Blöcke, Editor, PicoBoy per USB) funktioniert auch ohne. Bei STRATO kann die
`.htaccess` einige Minuten brauchen, bis sie wirkt.

Lokal ansehen mit Emulator: `node vorschau.mjs`, dann <http://localhost:8080>.

Die Datei ist etwa 1,7 MB groß, davon 0,6 MB das eingebettete MicroPython.
Die `.htaccess` lässt sie komprimiert ausliefern.

## Was neu ist

| Punkt | Inhalt |
|---|---|
| 1 Tests | `tests/`: Randfälle mit Sollausgabe (`faelle/`), Editor, Stop, Kopfleiste, Zeilen-Links, Terminal-Trenner, Lage der Emulator-Anzeige bei Windows-Skalierung, alle Hilfe-Beispiele, auf Wunsch alle Programme beider Bücher; außerdem die Seite ohne Header. `tests/alle.sh` (schnell) bzw. `tests/alle.sh voll` |
| 2 Neuer Emulator | Ersetzt den alten vollständig. MicroPython läuft in einem Web Worker. `time.sleep`, `input()`, `wait_for_button()` warten wirklich; das Programm wird **nicht** umgeschrieben (keine Grenzen bei `lambda`, `sorted(key=…)`, Rekursion, `import pbc as …`). Bildschirm, Tasten, Sensor und Stop über gemeinsamen Speicher; Stop beendet auch Schleifen ohne Pause sofort. |
| 3 Neigungssensor | Neigungsfeld unter dem Emulator (erscheint nur, wenn das Programm `accel_…` benutzt): Punkt ziehen = kippen, Doppelklick = flach. |
| 4 Dateinamen | **Dateien → Auf den Computer…** fragt nach dem Namen; geöffnete Dateinamen werden übernommen (auch für **Auf den PBC+…**) und stehen im Browser-Tab. |
| 5 Editor | Fehlerzeile wird markiert und angesprungen, „line N“ im Terminal ist anklickbar; Vervollständigung nach `pbc.`, `turtle.`, `time.` … und für Turtles/Sprites/Canvas (Strg+Leertaste); Vorprüfung vor jedem Start: fehlende Imports, unbekannte Namen mit „Meintest du …?“. |
| 6 Speicher | Fester Heap wie auf dem Gerät (ein Programm findet ≈ 450–490 KB frei, drei Canvas passen, ein viertes nicht). `MemoryError` kommt in der Zeile, die zu viel anlegt, mit der Meldung des Geräts. |
| 7 Dateien im Emulator | Programme laufen im Ordner `/flash`; was sie mit `open()` schreiben, bleibt nach dem Neuladen erhalten und steht in **Dateien verwalten…**; `os.listdir()` zeigt nur die Dateien des „Geräts“. |
| 8 Aufbau | Quelltext in Modulen (`src/`), `build.py` setzt sie zu einer Datei zusammen. |
| 9 Turtle berührt Farbe | Prüft bei schräger Fahrt neben dem Punkt 3 Pixel voraus auch dessen zwei Nachbarn zur Turtle hin; sonst rutscht sie durch eine schräg gekreuzte 1-Pixel-Linie (Spiele wie Tron). Firmware `turtle.py` gleich geändert. |
| 10 Turtle auf eigenem Hintergrund | Eine Turtle auf einem vorher bemalten Canvas („Hintergrund behalten“) zeigt ihn vollständig; vorher prüfte der Emulator nur Stichproben und löschte den Schirm, wenn nur dünne Linien (z. B. ein 1-Pixel-Rahmen) darauf waren. |
| 11 ZIP mit Bildern | **Dateien → Bilder verwalten… → ZIP hochladen…** lädt alle PNGs einer ZIP-Datei ohne Bildeditor hoch, in den Emulator oder aufs Gerät (Ordner in der ZIP werden ignoriert, andere Dateien übersprungen). Am Ende steht „n von m Bilder … hochgeladen“ im Terminal (Build 123). |
| 12 Meldungen vor Dialogen | Kurze Meldungen (unten eingeblendet) liegen jetzt **vor** offenen Dialogen; vorher blitzten sie hinter z. B. „Bilder verwalten“ nur kurz durch (Build 124). |
| 13 Stopp ohne Fehlermeldung | ■ Stopp während **▶ Testen** auf dem PicoBoy zeigt keinen roten KeyboardInterrupt-Traceback und keinen Fehlerhinweis mehr; der Ton wird danach unsichtbar abgeschaltet statt Code ins Terminal zu tippen (Build 125). |

Der Emulator bringt sein eigenes MicroPython 1.29.0 mit (Variante „pbc“,
eingebettet in die Datei, siehe `micropython/README.md`); vom CDN wird nichts
mehr geladen. Das fertige CDN-Paket eignet sich nicht: Es räumt den Speicher
während eines laufenden Programms nie auf.

Der alte Emulator (Programme in async-Code umschreiben) ist entfernt.

Außerdem: Umbenennung `__pbc_init__` → `__init__` in
Fehlermeldungen (fehlte im Original).

## Aufbau von `src/`

```
head.html style.css body.html tail.html   Seitengerüst
js/NN_*.js        Hauptskript, in Namensreihenfolge zusammengesetzt
                  (c0…c5 = Emulator, darin c3 = Steuerung des Workers)
py/*.py           MicroPython-Module des Emulators (pbc, turtle)
geteilt/*.js      Schriften und Zeichenbefehle des Workers
worker/*.js       der Emulator-Worker
htaccess          die Header für den neuen Emulator
pbcp.png          Platinenfoto des Emulators (wird nach dist/ kopiert)
```

`micropython/` enthält das MicroPython des neuen Emulators samt Bauanleitung
(`bauen.sh`, braucht Docker).

## Lizenz

GPL-3.0 (`LICENSE`), verwendete Software und Bedingung zur Urhebernennung in `NOTICE.md`.
