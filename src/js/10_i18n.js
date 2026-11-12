/* =====================================================================
 * Internationalisation.
 *
 * Strategy: German is the canonical source language. Every visible
 * string is wrapped in t('Deutscher Text'). In German mode, t() is
 * a no-op (returns the argument unchanged) -- so the German UI never
 * pays a lookup tax and stays unchanged for our existing code paths.
 *
 * In English mode, t() looks the argument up in I18N_EN. Strings that
 * aren't translated yet just fall through to German, which is a safe
 * default while we expand the table.
 *
 * Language is stored in localStorage and applied at boot. Changing it
 * triggers a page reload, so we don't need to rebuild Blockly's block
 * definitions on the fly.
 * ===================================================================== */

const LANG_KEY = 'pbc.lang';
let LANG = 'de';
try { LANG = localStorage.getItem(LANG_KEY) || 'de'; } catch (e) {}

const I18N_EN = {
  // -- App + toolbar -------------------------------------------------
  'PBC+ Studio': 'PBC+ Studio',
  'Dateien ▾': 'Files ▾',
  'Einstellungen': 'Settings',
  'Zu Text wechseln': 'Switch to text',
  'Zu Blöcken wechseln': 'Switch to blocks',
  '▶ Testen': '▶ Run',
  '■ Stop': '■ Stop',
  'Verbinden': 'Connect',
  'Trennen': 'Disconnect',
  'Konsole leeren': 'Clear console',
  'Soft-Reset': 'Soft reset',
  'NICHT VERBUNDEN': 'NOT CONNECTED',
  'nicht verbunden': 'not connected',
  'Seriell / REPL': 'Serial / REPL',

  // -- Dateien dropdown ----------------------------------------------
  'Neu': 'New',
  'Öffnen…': 'Open…',
  'Speichern': 'Save',
  'Auf den Computer…': 'To this computer…',
  'Impressum': 'Legal notice',
  'Kontakt': 'Contact',
  'Hardware-Wunsch': 'Hardware request',
  'Dir fehlt ein Hardware-Modul (z.B. ein Sensor)? Beschreibe kurz, welches Modul du dir wünschst – am besten mit Name/Typ und einem Link zum Datenblatt, falls du einen hast.':
    "Missing a hardware module (e.g. a sensor)? Briefly describe which module you'd like — ideally with a name/type and a link to the datasheet if you have one.",
  'Schreib mir eine Nachricht. Wenn du eine Antwort möchtest, gib bitte deine E-Mail-Adresse an – sonst kann ich mich nicht zurückmelden.':
    "Send me a message. If you'd like a reply, please provide your e-mail address — otherwise I can't get back to you.",
  'Gewünschtes Modul / Beschreibung': 'Desired module / description',
  'Nachricht': 'Message',
  'Name': 'Name',
  'E-Mail': 'E-mail',
  '(für eine Antwort)': '(for a reply)',
  'Bitte schreibe eine Nachricht.': 'Please write a message.',
  'Keine E-Mail angegeben': 'No e-mail provided',
  'Du hast keine E-Mail-Adresse angegeben. Hast du sie vielleicht vergessen? Ohne E-Mail kann ich dir nicht antworten.':
    "You didn't provide an e-mail address. Did you maybe forget it? Without an e-mail I can't reply to you.",
  'Trotzdem senden': 'Send anyway',
  'Zurück': 'Back',
  'Die E-Mail-Adresse sieht nicht gültig aus.': "That e-mail address doesn't look valid.",
  'Wird gesendet…': 'Sending…',
  'Danke! Deine Nachricht wurde gesendet.': 'Thanks! Your message has been sent.',
  'Senden fehlgeschlagen. Bitte später erneut versuchen.': 'Sending failed. Please try again later.',
  'Senden fehlgeschlagen. Läuft die Seite auf einem Server mit PHP?':
    'Sending failed. Is the page running on a server with PHP?',
  'Senden': 'Send',
  'Bitte bestätigen': 'Please confirm',
  'Flash-Backup erstellen (.uf2)…': 'Create flash backup (.uf2)…',
  'Flash-Backup wird erstellt…': 'Creating flash backup…',
  'Das kann ein paar Minuten dauern. Trenne den PBC+ in dieser Zeit nicht und schließe diesen Tab nicht.':
    'This can take a few minutes. Do not disconnect the PBC+ and do not close this tab.',
  'Starte…': 'Starting…',
  'Hinweis: Die Zeilennummer oben bezieht sich auf den intern umgewandelten Code, nicht auf deine geschriebene Zeile. Nutze die Fehlerart und die Erklärung als Wegweiser.':
    'Note: the line number above refers to the internally transformed code, not the line you wrote. Use the error type and the explanation as your guide.',
  'Wird abgebrochen…': 'Cancelling…',
  'Gelesen:': 'Read:',
  'Blöcke': 'blocks',
  'Fertig! Backup heruntergeladen.': 'Done! Backup downloaded.',
  'Flash-Backup gespeichert': 'Flash backup saved',
  'Backup abgebrochen.': 'Backup cancelled.',
  'Der PBC+ hat nicht reagiert. Läuft gerade ein Programm? Versuche es nach einem Soft-Reset erneut.':
    'The PBC+ did not respond. Is a program running? Try again after a soft reset.',
  'Zeitüberschreitung beim Lesen. Bitte erneut versuchen.':
    'Timed out while reading. Please try again.',
  'Es wurden keine Daten gelesen. Unterstützt diese Firmware uctypes?':
    'No data was read. Does this firmware support uctypes?',
  'Backup fehlgeschlagen:': 'Backup failed:',
  'Der PBC+ hat das Auslesen abgebrochen. Meldung vom Gerät:':
    'The PBC+ aborted the readout. Message from the device:',
  'Verbinde zuerst den echten PBC+ per USB, dann kann das Backup erstellt werden.':
    'Connect the real PBC+ via USB first, then the backup can be created.',
  'Auf den PBC+…': 'To the PBC+…',
  'Bilder verwalten…': 'Manage images…',
  'Hochladen': 'Upload',
  'Datei auf den PBC+…': 'File to PBC+…',

  // -- Categories ----------------------------------------------------
  'Display': 'Display',
  'LEDs': 'LEDs',
  'Sound': 'Sound',
  'Eingabe': 'Input',
  'Sensor': 'Sensor',
  'Sprites': 'Sprites',
  'Turtle': 'Turtle',
  'Konsole': 'Console',
  'Kontrollstrukturen': 'Control',
  'Mathe': 'Math',
  'Variablen': 'Variables',
  'Funktionen': 'Functions',
  'Externe Sensoren': 'External sensors',
  'Sonstiges': 'Other',

  // -- Block labels (sidebar buttons + workspace text) ---------------
  'Bildschirm löschen': 'Clear screen',
  'Bildschirm füllen': 'Fill screen',
  'Pixel': 'Pixel',
  'Linie': 'Line',
  'Rechteck': 'Rectangle',
  'Ellipse': 'Ellipse',
  'Text': 'Text',
  'kleiner Text': 'small text',
  'großer Text': 'big text',
  'Farbe nach Namen': 'Named color',
  'Farbe(r, g, b)': 'Color(r, g, b)',
  'Bildschirm BREITE / HÖHE': 'Screen WIDTH / HEIGHT',
  'Bild anzeigen': 'Show image',
  'Bild laden (PNG)': 'Load image (PNG)',
  'Farbwähler': 'Color picker',
  'LED Rot':   'LED red',
  'LED Gelb':  'LED yellow',
  'LED Grün':  'LED green',
  'RGB-LED':   'RGB LED',
  'RGB-LED aus': 'RGB LED off',
  'Ton':       'Tone',
  'Ton aus':   'Sound off',
  'Knopf A':   'Button A',
  'Knopf B':   'Button B',
  'Joystick oben':   'Joystick up',
  'Joystick unten':  'Joystick down',
  'Joystick links':  'Joystick left',
  'Joystick rechts': 'Joystick right',
  'Joystick Mitte':  'Joystick centre',
  'wurde gedrückt A': 'A pressed',
  'wurde gedrückt B': 'B pressed',
  'Beschleunigung X': 'Acceleration X',
  'Beschleunigung Y': 'Acceleration Y',
  'Beschleunigung Z': 'Acceleration Z',
  'Batterie (V)': 'Battery (V)',
  'falls / sonst': 'if / else',
  'falls': 'if',
  'N-mal wiederholen': 'repeat N times',
  'solange / bis': 'while / until',
  'für i von … bis …': 'for i from … to …',
  'unendlich wiederholen': 'forever',
  'Vergleich = ≠ < >': 'compare = ≠ < >',
  'und / oder': 'and / or',
  'nicht': 'not',
  'Zahl': 'Number',
  'Rechnen + − × ÷ %': 'Math + − × ÷ %',
  'Zufallszahl': 'Random number',
  'Zufallszahl zwischen … und …': 'Random number between … and …',
  'wahr / falsch': 'true / false',
  'warten (ms)': 'wait (ms)',
  'Zeit seit Programmstart (ms)': 'Time since start (ms)',
  'Kommentar': 'Comment',
  'Programm neu starten': 'Restart program',
  'Wert beschränken': 'Clamp value',
  'Wert abbilden': 'Map value',
  'Beim Start': 'On start',
  '+ neues Sprite…': '+ new sprite…',
  '+ neue Funktion…': '+ new function…',
  '+ neue Funktion mit Rückgabe…': '+ new function with return…',
  'gib zurück': 'return',
  'mit Rückgabewert': 'with return value',
  'mit': 'with',
  'Parameter hinzufügen': 'add parameter',
  'Parameter entfernen': 'remove parameter',
  '+ neue lokale Variable…': '+ new local variable…',
  'Name der lokalen Variable?': 'Name of the local variable?',
  'Dieser Name wird in dieser Funktion schon verwendet.':
    'This name is already used in this function.',
  'lokale Variable': 'local variable',
  'wert': 'value',
  'Noch keine Sprites.': 'No sprites yet.',
  'Befehle': 'Commands',
  'zeige Sprite': 'show sprite',
  'verstecke Sprite': 'hide sprite',
  'Sprite setzen auf x/y': 'set sprite to x/y',
  'Sprite versetzen um dx/dy': 'move sprite by dx/dy',
  'Sprite nach x/y gleiten': 'glide sprite to x/y',
  'Sprite um dx/dy gleiten': 'glide sprite by dx/dy',
  'x von Sprite': 'sprite x',
  'y von Sprite': 'sprite y',
  'Sprite berührt Sprite': 'sprite touches sprite',
  'Sprite berührt Rand': 'sprite touches edge',
  'Sprite berührt Farbe': 'sprite touches color',
  // Listen (lists)
  'Listen':                            'Lists',
  '+ neue Liste…':                     '+ new list…',
  'Name der Liste?':                   'Name of the list?',
  'Keine Listen.':                     'No lists.',
  'Liste löschen?':                    'Delete list?',
  'Liste fehlt':                       'List missing',
  'Erstelle erst eine Liste unter "+ neue Liste…".':
    'Create a list first with "+ new list…".',
  'einer Liste':                       'a list',
  'liste':                             'list',
  'element':                           'item',
  'Liste aus Werten':                  'list of values',
  'setze Liste … auf leer':            'set list … to empty',
  'hänge … an Liste an':               'append … to list',
  'Element Nr. … von Liste':           'item no. … of list',
  'setze Element Nr. … auf …':         'set item no. … to …',
  'Länge von Liste':                   'length of list',
  'Liste enthält …?':                  'list contains …?',
  'entferne Element Nr. …':            'remove item no. …',
  'entferne Wert aus Liste':           'remove value from list',
  'für jedes Element in Liste':        'for each item in list',
  'zufälliges Element aus Liste':      'random item of list',
  'Liste (als Wert)':                  'list (as value)',
  'setze Liste %1 auf %2':             'set list %1 to %2',
  'hänge %1 an Liste %2 an':           'append %1 to list %2',
  'Element Nr. %1 von Liste %2':       'item no. %1 of list %2',
  'setze Element Nr. %1 von Liste %2 auf %3':
                                       'set item no. %1 of list %2 to %3',
  'Länge von Liste %1':                'length of list %1',
  'Liste %1 enthält %2 ?':             'list %1 contains %2 ?',
  'entferne Element Nr. %1 aus Liste %2':
                                       'remove item no. %1 from list %2',
  'entferne %1 aus Liste %2':          'remove %1 from list %2',
  'für jedes Element %1 in Liste %2 %3 %4':
                                       'for each item %1 in list %2 %3 %4',
  'zufälliges Element aus Liste %1':   'random item of list %1',
  'Liste %1':                          'list %1',
  'drucke': 'print',
  'leere Zeile drucken': 'print empty line',
  'einlesen (Text)': 'read (text)',
  'einlesen (Zahl)': 'read (number)',

  // -- Block sidebar labels (entries in PBC_BLOCKS still in German) -
  'Texte':                          'Texts',
  'setze … auf …':                  'set … to …',
  'setze Text … auf …':             'set text … to …',
  '+ neue Variable…':               '+ new variable…',
  '+ neuer Text…':                  '+ new text…',
  'Keine Variablen.':               'No variables.',
  'Keine Texte.':                   'No texts.',
  'Name der Variable?':             'Variable name?',
  'Name des Texts?':                'Text name?',
  'wert':                           'value',
  'text':                           'text',
  'Erstelle erst eine Variable unter "+ neue Variable…".':
    'Create a variable first with "+ new variable…".',
  'Erstelle erst einen Text unter "+ neuer Text…".':
    'Create a text first with "+ new text…".',
  'Name der neuen Funktion?':        'Name of the new function?',
  'mein_zeichnen':                  'my_function',
  'meine_methode':                  'my_function',
  'meine_funktion':                 'my_function',
  'Ungültiger Name.':               'Invalid name.',
  'Dateiname?':                     'File name?',
  'Der Emulator kann hier nicht laufen: Der Webserver sendet die nötigen Header nicht (siehe .htaccess). Öffne PBC+ Studio über pbcstudio.de; ein Doppelklick auf die Datei reicht nicht.':
    'The emulator cannot run here: the web server does not send the required headers (see .htaccess). Open PBC+ Studio via pbcstudio.de; double-clicking the file is not enough.',
  'Eine Funktion mit diesem Namen gibt es schon.':
                                    'A function with that name already exists.',
  'Neue Variable':                  'New variable',
  'Neuer Text':                     'New text',
  'Name:':                          'Name:',
  'Startwert (leer = 0):':          'Initial value (empty = 0):',
  'Startwert (leer = leerer Text):':'Initial value (empty = empty text):',
  'Bitte eine Zahl eingeben.':      'Please enter a number.',
  '[Raw-REPL-Prompt nicht gesehen]':
    '[Raw REPL prompt not seen]',
  'Hinweis: Vielleicht läuft gerade ein Programm auf dem PBC+ (z.B. main.py). Drücke "Soft-Reset" im Terminal-Header.':
    'Hint: A program might be running on the PBC+ (e.g. main.py). Press "Soft reset" in the terminal header.',
  'Bild nicht ausgewählt':          'Image not selected',
  'In einem oder mehreren Bild-Blöcken ist noch kein Bild ausgewählt.':
    'One or more image blocks have no image selected yet.',
  'Klicke auf den Bild-Block und wähle eine Datei aus der Liste. Falls die Liste leer ist, lade zuerst über Dateien → Bilder verwalten ein PNG hoch.':
    'Click the image block and pick a file from the list. If the list is empty, first upload a PNG via Files → Manage images.',
  'Sprite-Befehl ohne Sprite':      'Sprite command without sprite',
  'Sprite-Befehl ohne Sprite':      'Sprite command without sprite',
  'Funktionsaufruf ohne Funktion':  'Function call without function',
  'Diese Funktionen werden aufgerufen, aber nicht (mehr) definiert:':
    'These functions are called but not (any longer) defined:',
  'Lege die Funktion neu an, oder wähle im Aufruf eine andere Funktion aus dem Dropdown.':
    'Define the function again, or pick a different one from the call block dropdown.',
  'Endlosschleife ohne Pause':      'Infinite loop without pause',
  'Eine "unendlich wiederholen"-Schleife enthält keinen "warte ... ms"-Block. Das Programm wird das Gerät zu 100% auslasten und reagiert vielleicht nicht mehr auf Stop.':
    'A "repeat forever" loop has no "wait … ms" block in it. The program will peg the device at 100% CPU and may stop responding to Stop.',
  'Empfohlen: füge in der Schleife einen "warte 20 ms"-Block ein.':
    'Recommended: add a "wait 20 ms" block inside the loop.',
  'Trotzdem starten?':              'Start anyway?',
  'Nicht genug Speicher':           'Out of memory',
  'Das Programm hat den Speicher des Geräts überfüllt. Häufige Ursachen:':
    'The program ran the device out of memory. Common causes:',
  'Zu viele Bilder oder Sprites gleichzeitig aktiv.':
    'Too many images or sprites active at the same time.',
  'Sehr lange Listen im Programm.':
    'Very long lists in the program.',
  'Mehrere Canvas-Objekte angelegt (jedes belegt rund 134 KB).':
    'Several canvas objects allocated (each takes about 134 KB).',
  'Probiere weniger Bilder gleichzeitig zu benutzen, oder lege nur ein Canvas an.':
    'Try using fewer images at once, or allocating just one canvas.',
  'Division durch Null':            'Division by zero',
  'Du hast versucht, durch 0 zu teilen oder Modulo 0 zu rechnen. Pass auf, dass der Teiler nicht 0 werden kann – baue zum Beispiel eine "falls"-Abfrage davor ein.':
    'You tried to divide by 0 or modulo by 0. Make sure the divisor cannot be 0 – e.g. guard with an "if" check first.',
  'Listen-Position außerhalb':      'List position out of range',
  'Du hast eine Stelle in einer Liste angesprochen, die es nicht gibt. Listen-Positionen gehen von 0 bis Länge-1. Prüfe mit "Länge der Liste" wie viele Elemente die Liste wirklich hat.':
    'You accessed a position in a list that does not exist. Positions run 0..length-1. Check the list length first.',
  'Eingabe ist keine Zahl':         'Input is not a number',
  'Das Programm hat eine Zahl erwartet, aber etwas anderes bekommen (z.B. Buchstaben). Tippe nur Ziffern ein.':
    'The program expected a number but got something else (e.g. letters). Type digits only.',
  'Ein Wert hatte ein unerwartetes Format. Schau in die rote Fehlermeldung im Terminal, um zu sehen welcher.':
    'A value had an unexpected format. Check the red error message in the terminal to see which.',
  'Unbekannter Name':               'Unknown name',
  'Das Programm kennt den Namen "':
    'The program does not know the name "',
  '" nicht.':                       '".',
  'Das Programm kennt einen Namen nicht.':
    'The program references a name it does not know.',
  'Häufige Ursachen: Variable noch nicht angelegt, Sprite gelöscht, Funktion umbenannt.':
    'Common causes: variable not yet created, sprite deleted, function renamed.',
  'nicht.':                         'not defined.',
  'Endlose Selbst-Aufrufe':         'Endless self-calls',
  'Eine Funktion ruft sich selbst immer wieder auf. Baue eine Abbruch-Bedingung mit "falls" ein, damit der Aufruf-Stapel nicht überläuft.':
    'A function keeps calling itself. Add a termination check with "if" so the call stack does not overflow.',
  'Einrückung stimmt nicht':        'Indentation is off',
  'Python achtet auf die Einrückung (die Leerzeichen am Zeilenanfang). Innerhalb von "falls", Schleifen und Funktionen müssen die Zeilen gleich weit eingerückt sein. Prüfe, ob eine Zeile zu weit links oder rechts steht.':
    'Python cares about indentation (the spaces at the start of a line). Inside "if", loops and functions the lines must be indented the same amount. Check whether a line is too far left or right.',
  'Schreibfehler im Code':          'Typo in the code',
  'Python kann eine Zeile nicht verstehen. Häufige Ursachen: ein fehlender Doppelpunkt ":" am Ende von "falls"/Schleife, eine nicht geschlossene Klammer oder ein fehlendes Anführungszeichen bei einem Text.':
    'Python cannot parse a line. Common causes: a missing colon ":" at the end of an "if"/loop, an unclosed bracket, or a missing quote around a text.',
  'Unbekannte Funktion oder Eigenschaft': 'Unknown function or attribute',
  'Ein Objekt vom Typ "':           'An object of type "',
  '" hat kein "':                   '" has no "',
  'Vermutlich ein Tippfehler im Namen einer Funktion oder Eigenschaft, oder das Objekt ist nicht das, was du denkst.':
    'Probably a typo in a function or attribute name, or the object is not what you think it is.',
  'Falscher Typ':                   'Wrong type',
  'Ein Wert hat den falschen Typ für diese Operation.':
    'A value has the wrong type for this operation.',
  'Du rechnest oder verbindest vermutlich Text mit Zahlen. Wandle Zahlen mit "Text(...)" in Text um, bevor du sie mit + an Text hängst – oder mit "Zahl(...)" andersherum.':
    'You are probably mixing text and numbers. Convert numbers with "str(...)" before joining them to text with +, or with "int(...)"/"float(...)" the other way.',
  'Eine Funktion wurde mit der falschen Anzahl an Werten aufgerufen. Prüfe, wie viele Werte die Funktion erwartet.':
    'A function was called with the wrong number of values. Check how many it expects.',
  'Du hast etwas mit "()" aufgerufen, das keine Funktion ist – vielleicht eine Variable mit gleichem Namen wie eine Funktion.':
    'You called something with "()" that is not a function – maybe a variable that shares a name with a function.',
  'Du hast "[...]" auf etwas angewandt, das keine Liste oder kein Text ist.':
    'You used "[...]" on something that is not a list or text.',
  'Schlüssel nicht gefunden':       'Key not found',
  'Du hast in einem Dictionary einen Schlüssel angesprochen, den es nicht gibt. Prüfe die Schreibweise des Schlüssels, oder ob er überhaupt schon hinzugefügt wurde.':
    'You accessed a dictionary key that does not exist. Check the spelling, or whether it was added at all.',
  'Modul nicht gefunden':           'Module not found',
  'Das Modul "':                    'The module "',
  '" gibt es hier nicht. ':         '" does not exist here. ',
  'Manche Module funktionieren nur auf dem echten PBC+, nicht im Emulator. Prüfe außerdem die Schreibweise nach "import".':
    'Some modules only work on the real PBC+, not in the emulator. Also check the spelling after "import".',
  'Zahl zu groß':                   'Number too large',
  'Eine Zahl ist zu groß geworden für die Berechnung. Das passiert oft bei sehr hohen Potenzen oder einer Schleife, die eine Zahl immer weiter verdoppelt.':
    'A number grew too large for the computation. This often happens with very high powers or a loop that keeps doubling a value.',
  'Verbindung verloren':            'Connection lost',
  'Verbindung zum PBC+ verloren. ↻ klicken oder neu verbinden.':
    'Lost connection to the PBC+. Click ↻ or reconnect.',
  'Ungültiger Name. Erlaubt sind Buchstaben, Ziffern und Unterstriche. Nicht mit einer Ziffer beginnen.':
    'Invalid name. Allowed: letters, digits, underscores. Must not start with a digit.',
  'MicroPython installieren…':      'Install MicroPython…',
  'MicroPython auf den PBC+ installieren':
    'Install MicroPython on the PBC+',
  'Vom Computer…':                  'From computer…',
  'Vom PBC+…':                      'From PBC+…',
  'Dateien auf dem PBC+…':          'Files on the PBC+…',
  'Dateien auf dem PBC+':           'Files on the PBC+',
  'Dateien auf dem':                'Files on the',
  'Bilder auf dem':                 'Images on the',
  'Hier siehst du alle Dateien auf dem Gerät. Du kannst neue Dateien hochladen oder vorhandene löschen.':
    'You see every file on the device here. Upload new files or delete existing ones.',
  'Datei(en) hochladen…':           'Upload file(s)…',
  'Datei(en) oder ZIP hochladen…':  'Upload file(s) or ZIP…',
  'Auf deinem PBC+ ist noch eine ältere Firmware. Block-Projekte erscheinen dort erst nach einem Update im Startmenü: Dateien → MicroPython installieren…':
    'Your PBC+ still has an older firmware. Block projects appear in its launcher only after an update: Files → Install MicroPython…',
  'Block-Projekt (.pbcp)':          'Block project (.pbcp)',
  'Python-Programm (.py)':          'Python program (.py)',
  'startet im Startmenü des PicoBoy und lässt sich in PBC+ Studio wieder als Blöcke öffnen.':
    'starts from the launcher on the PicoBoy and opens as blocks again in PBC+ Studio.',
  'nur der Python-Code, zum Beispiel zum Weiterschreiben im Text-Modus. Lässt sich nicht wieder als Blöcke öffnen.':
    'only the Python code, for example to keep writing in text mode. Does not open as blocks again.',
  'Keine Programme auf dem Gerät.': 'No programs on the device.',
  'Dein Block-Projekt ist auf dem PicoBoy gespeichert. Du startest es im Startmenü (Eintrag mit Blocksymbol) und öffnest es in PBC+ Studio mit „Vom PBC+…“ im Menü Dateien wieder als Blöcke.':
    'Your block project is saved on the PicoBoy. Start it from the launcher (entry with the block icon) and open it as blocks again in PBC+ Studio with “From PBC+…” in the Files menu.',
  'Systemdatei':                    'system file',
  'Name doppelt':                   'duplicate name',
  'Ausgelassen:':                   'Skipped:',
  'Nicht genug Platz:':             'Not enough space:',
  'nötig':                          'needed',
  'frei':                           'free',
  'Lade hoch…':                     'Uploading…',
  'hochgeladen':                    'uploaded',
  'PNG hochladen…':                 'Upload PNG…',
  'ZIP hochladen…':                 'Upload ZIP…',
  'Mehrere PNG-Bilder auf einmal, ohne Bildeditor':
    'Several PNG images at once, without the image editor',
  'ZIP-Datei nicht lesbar:':        'Cannot read ZIP file:',
  'Keine PNG-Bilder in der ZIP-Datei.': 'No PNG images in the ZIP file.',
  'keine ZIP-Datei':                'not a ZIP file',
  'verschlüsselte ZIP-Dateien gehen nicht': 'encrypted ZIP files are not supported',
  'unbekannte Packart':             'unknown compression method',
  'Bilder aus der ZIP-Datei hochgeladen': 'images from the ZIP file uploaded',
  'von':                            'of',
  'Startmenü installieren':         'Install launcher',
  'Startmenü installieren…':        'Install launcher…',
  'Datei vom PBC+ öffnen':          'Open file from PBC+',
  'Keine .py-Dateien auf dem Gerät.':
    'No .py files on the device.',
  'Das Startmenü wird als main.py auf dem PBC+ installiert. Beim nächsten Start zeigt das Gerät die Liste aller Programme.\n\nFalls schon eine main.py existiert, wird sie zu main(2).py (oder main(3).py usw.) umbenannt – nichts geht verloren.\n\nFortfahren?':
    'The launcher will be installed as main.py on the PBC+. At the next boot the device shows the list of all programs.\n\nIf a main.py already exists, it gets renamed to main(2).py (or main(3).py etc.) – nothing is lost.\n\nProceed?',
  'Installation fehlgeschlagen':    'Installation failed',
  'Startmenü installiert. Alte main.py → ':
    'Launcher installed. Old main.py → ',
  'Startmenü installiert':          'Launcher installed',
  'verbinde … mit …':               'join … with …',
  'verbinde %1 mit %2':             'join %1 with %2',
  'Länge von …':                    'length of …',
  'Länge von %1':                   'length of %1',
  'Zeichen … von …':                'character … of …',
  'Zeichen %1 von %2':              'character %1 of %2',
  'Teilstück von … ab … bis …':     'substring of … from … to …',
  'Teilstück von %1 ab %2 bis %3':  'substring of %1 from %2 to %3',
  'in GROSS / klein':               'to UPPER / lower',
  '%1 in %2':                       '%1 to %2',
  'GROSSBUCHSTABEN':                'UPPERCASE',
  'kleinbuchstaben':                'lowercase',
  '… enthält …':                    '… contains …',
  '%1 enthält %2':                  '%1 contains %2',
  'Zeit':                           'Time',
  'warten (Sekunden)':              'wait (seconds)',
  'warte %1 Sekunden':              'wait %1 seconds',
  'Zeit seit Programmstart (Sekunden)': 'time since program start (seconds)',
  'vergangene ms seit …':           'elapsed ms since …',
  'vergangene ms seit %1':          'elapsed ms since %1',
  'Wurzel aus …':                   'square root of …',
  'Wurzel aus %1':                  'square root of %1',
  '… hoch …':                       '… to the power of …',
  '%1 hoch %2':                     '%1 to the power of %2',
  'Betrag von …':                   'absolute value of …',
  'Betrag von %1':                  'absolute value of %1',
  '… runden':                       'round …',
  '%1 runden':                      'round %1',
  'Minimum / Maximum':              'Minimum / Maximum',
  '%1 von %2 und %3':               '%1 of %2 and %3',
  'Minimum':                        'Minimum',
  'Maximum':                        'Maximum',
  'Aktuelles Programm verwerfen und neu beginnen?':
    'Discard the current program and start over?',
  'Aktuelles Programm verwerfen und die Datei laden?':
    'Discard the current program and load the file?',
  'Daten auf dem PBC+':             'Data on the PBC+',
  'Daten auf dem':                  'Data on the',
  'Emulator wird gestartet…':       'Starting emulator…',
  'Dateien verwalten…':             'Manage files…',
  'Keine Dateien auf dem Gerät.':   'No files on the device.',
  'Auflisten fehlgeschlagen.':      'Listing failed.',
  'System':                         'System',
  'Datei löschen':                  'Delete file',
  ' ist eine Systemdatei. Wirklich löschen? Das Gerät kann danach kaputt sein!':
    ' is a system file. Really delete? The device may stop working afterwards!',
  ' wirklich löschen?':             ' really delete?',
  'gelöscht':                       'deleted',
  'Löschen fehlgeschlagen':         'Delete failed',
  'Schließen':                      'Close',
  'In einem oder mehreren Sprite-Befehlen ist kein Sprite ausgewählt.':
    'One or more sprite commands have no sprite selected.',
  'Klicke auf den Befehl-Block und wähle aus dem Dropdown ein Sprite aus, oder lösche den Block.':
    'Click the command block and pick a sprite from the dropdown, or delete the block.',
  'Sprite fehlt':                   'Sprite missing',
  'Erstelle erst ein Sprite über "+ neues Sprite…" in der Sprite-Sidebar.':
    'Create a sprite first via "+ new sprite…" in the sprite sidebar.',
  'Sprite-Bild fehlt':              'Sprite image missing',
  'Diese Sprites haben kein Bild ausgewählt:':
    'These sprites have no image selected:',
  'Öffne den Sprite-Editor und wähle für jeden ein PNG aus.':
    'Open the sprite editor and pick a PNG for each.',
  'Bilder fehlen auf dem PBC+':     'Images missing on the PBC+',
  'Turtle fehlt':                   'Turtle missing',
  'Erstelle erst eine Turtle mit "neue Turtle erstellen".':
    'Create a turtle first using "new turtle".',
  'Neu verbinden (nach Reset am Gerät)':
    'Reconnect (after device reset)',
  'Kein gespeicherter Port – bitte auswählen.':
    'No saved port – please select.',
  'Bild auf Canvas':                'Image on canvas',
  'auf Canvas':                     'on canvas',
  'Hintergrund anlegen / leeren':   'Background create / clear',
  'Hintergrund %1':                 'background %1',
  'anlegen':                        'create',
  'leeren':                         'clear',
  'Name der Turtle?':               'Name of the turtle?',
  'neue Turtle %1 %2':              'new turtle %1 %2',
  'Hintergrund behalten':           'keep background',
  'neuer Hintergrund':              'new background',
  'Neue Turtle':                    'New turtle',
  'Canvas:':                        'Canvas:',
  '(eigenes)':                      '(own)',
  '+ neues Canvas…':                '+ new canvas…',
  'Canvas':                         'Canvas',
  'Name des Canvas?':               'Name of the canvas?',
  'Keine Canvas.':                  'No canvases.',
  'Canvas löschen?':                'Delete canvas?',
  'Canvas fehlt':                   'Canvas missing',
  'Erstelle erst ein Canvas mit "+ neues Canvas…".':
    'Create a canvas first with "+ new canvas…".',
  'hintergrund':                    'background',
  'Befehle':                        'Commands',
  'neue Turtle %1 auf Canvas %2':   'new turtle %1 on canvas %2',
  'Canvas %1':                      'Canvas %1',
  'Canvas zeigen':                  'show canvas',
  'Canvas füllen mit %1':           'fill canvas with %1',
  'Canvas Pixel x %1 y %2 Farbe %3':
    'canvas pixel x %1 y %2 color %3',
  'Canvas Linie von x %1 y %2 bis x %3 y %4 Farbe %5':
    'canvas line from x %1 y %2 to x %3 y %4 color %5',
  'Canvas Rechteck %1 %2x %3 y %4 %5Breite %6 Höhe %7 %8Farbe %9':
    'canvas rectangle %1 %2x %3 y %4 %5width %6 height %7 %8color %9',
  'Canvas Ellipse %1 %2Mitte x %3 y %4 %5Breite %6 Höhe %7 %8Farbe %9':
    'canvas ellipse %1 %2centre x %3 y %4 %5width %6 height %7 %8color %9',
  'Canvas Kreis %1 %2Mitte x %3 y %4 %5Radius %6 %7Farbe %8':
    'canvas circle %1 %2centre x %3 y %4 %5radius %6 %7color %8',
  'kleiner Text auf Canvas':        'small text on canvas',
  'großer Text auf Canvas':         'big text on canvas',
  'Canvas als Sprite-Hintergrund setzen':
    'set canvas as sprite background',
  'Canvas anlegen / leeren':        'Canvas create / clear',
  'Canvas füllen':                  'fill canvas',
  'Pixel auf Canvas':               'Pixel on canvas',
  'Linie auf Canvas':               'Line on canvas',
  'Rechteck auf Canvas':            'Rectangle on canvas',
  'Ellipse auf Canvas':             'Ellipse on canvas',
  'Kreis auf Canvas':               'Circle on canvas',
  'Text auf Canvas':                'Text on canvas',
  'als Sprite-Hintergrund':         'as sprite background',
  'neues Canvas':                   'new canvas',
  'myturtle':                   'myturtle',
  'ist in Python reserviert. Bitte einen anderen Namen wählen.':
    'is reserved in Python. Please choose a different name.',
  'Es gibt Turtle-Befehle für:':    'There are turtle commands for:',
  'Bevor du sie benutzt, musst du sie mit einem "neue Turtle"-Block erstellen.':
    'Before you use it, you have to create it with a "new turtle" block.',
  'Diese Bild-Dateien sind nicht auf dem Gerät:':
    'These image files are not on the device:',
  'Lade sie hoch über Dateien → Bilder verwalten.':
    'Upload them via Files → Manage images.',
  'Erst eine Turtle mit "neue Turtle" erstellen.':
    'Create a Turtle with "new turtle" first.',
  'Lösche erst alle Turtle-Befehle.':
    'Delete the turtle commands first.',
  'Löschen':                        'Delete',
  'Variable löschen?':              'Delete variable?',
  'Text löschen?':                  'Delete text?',
  '"%1" wird gelöscht. Eingebettete Werte bleiben auf der Fläche stehen.':
    '"%1" will be deleted. Embedded values stay on the workspace.',
  'Bitte einen Namen eingeben.':    'Please enter a name.',
  'Bitte ein Bild auswählen (oder eines hochladen).':
                                    'Please choose an image (or upload one).',
  'Der Name':                       'The name',
  'wird schon als Name':            'is already in use as the name of',
  'einer Variable':                 'a variable',
  'eines Texts':                    'a text',
  'einer Funktion':                 'a function',
  'eines Sprites':                  'a sprite',
  'verwendet.':                     '',
  'Status-LED setzen':              'Set status LED',
  'RGB-LED setzen':                 'Set RGB LED',
  'RGB-LED auf Farbe':              'RGB LED to color',
  'Ton für ms abspielen':           'Play tone for ms',
  'Dauerton starten':               'Start tone',
  'Taste gedrückt?':                'Key pressed?',
  'Taste vorher gedrückt?':         'Key pressed earlier?',
  'auf Taste warten':               'Wait for any key',
  'auf bestimmte Taste warten':     'Wait for specific key',
  'auf %1 warten':                  'wait for %1',
  'Beschleunigung X/Y/Z (g oder m/s²)':
                                    'Acceleration X/Y/Z (g or m/s²)',
  'neue Turtle erstellen':          'New turtle',
  'vorwärts':                       'forward',
  'rückwärts':                      'back',
  'links drehen':                   'turn left',
  'rechts drehen':                  'turn right',
  'Stift heben':                    'pen up',
  'Stift senken':                   'pen down',
  'Stiftfarbe setzen':              'set pen color',
  'Position setzen':                'set position',
  'Richtung setzen':                'set heading',
  'zum Ursprung':                   'home',
  'Geschwindigkeit (0=sofort, 1..10+)':
                                    'speed (0=instant, 1..10+)',
  'verstecken':                     'hide',
  'zeigen':                         'show',
  'Leinwand löschen':               'clear canvas',
  'Turtle berührt Farbe':           'turtle touches color',
  'ausgeben':                       'print',
  'Bildschirm füllen mit %1': 'Fill screen with %1',
  'Pixel x %1 y %2 Farbe %3': 'Pixel x %1 y %2 color %3',
  'Linie von x %1 y %2 bis x %3 y %4 Farbe %5':
    'Line from x %1 y %2 to x %3 y %4 color %5',
  '%1 Rechteck x %2 y %3 b %4 h %5 Farbe %6':
    '%1 rectangle x %2 y %3 w %4 h %5 color %6',
  'Ellipse %1 %2Mitte x %3 y %4 %5Breite %6 Höhe %7 %8Farbe %9':
    'Ellipse %1 %2centre x %3 y %4 %5width %6 height %7 %8color %9',
  'Kreis %1 %2Mitte x %3 y %4 %5Radius %6 %7Farbe %8':
    'Circle %1 %2centre x %3 y %4 %5radius %6 %7color %8',
  'Kreis':                             'Circle',
  'kleiner Text %1 an x %2 y %3 Farbe %4':
    'small text %1 at x %2 y %3 color %4',
  'Text %1 an x %2 y %3 Farbe %4':
    'Text %1 at x %2 y %3 color %4',
  'großer Text %1 an x %2 y %3 Farbe %4':
    'big text %1 at x %2 y %3 color %4',
  'Farbe %1':                          'Color %1',
  'Farbe rot %1 grün %2 blau %3':      'Color red %1 green %2 blue %3',
  'setze %1 LED %2':                   'set %1 LED %2',
  'alle Status-LEDs aus':              'turn all status LEDs off',
  'RGB-LED rot %1 grün %2 blau %3':    'RGB LED red %1 green %2 blue %3',
  'RGB-LED auf Farbe %1':              'RGB LED to color %1',
  'Ton %1 Hz für %2 ms':               'Tone %1 Hz for %2 ms',
  'Dauerton %1 Hz starten':            'Start tone %1 Hz',
  'Ton stoppen':                       'Stop tone',
  'wird %1 gedrückt?':                 'is %1 pressed?',
  'wurde %1 seit der letzten Abfrage gedrückt?':
                                       'was %1 pressed since the last check?',
  'auf beliebige Taste warten':        'wait for any key',
  'Beschleunigung %1 in %2':           'Acceleration %1 in %2',
  'zeige Sprite %1':                   'show sprite %1',
  'verstecke Sprite %1':               'hide sprite %1',
  'setze Sprite %1 auf x %2 y %3':     'set sprite %1 to x %2 y %3',
  'versetze Sprite %1 um x %2 y %3':   'move sprite %1 by x %2 y %3',
  'gleite Sprite %1 nach x %2 y %3 in %4 ms':
                                       'glide sprite %1 to x %2 y %3 in %4 ms',
  'gleite Sprite %1 um x %2 y %3 in %4 ms':
                                       'glide sprite %1 by x %2 y %3 in %4 ms',
  'x von Sprite %1':                   'x of sprite %1',
  'y von Sprite %1':                   'y of sprite %1',
  'Sprite %1 berührt Sprite %2':       'sprite %1 touches sprite %2',
  'Sprite %1 berührt Rand':            'sprite %1 touches edge',
  'Sprite %1 berührt Farbe %2':        'sprite %1 touches color %2',
  'warte %1 ms':                       'wait %1 ms',
  '# Kommentar: %1':                   '# Comment: %1',
  '%1 beschränken auf %2 .. %3':       'clamp %1 to %2 .. %3',
  '%1 abbilden von %2 .. %3 auf %4 .. %5':
                                       'map %1 from %2 .. %3 to %4 .. %5',
  'unendlich wiederholen %1 %2':       'repeat forever %1 %2',
  'Beim Start %1 %2':                  'On start %1 %2',
  'neue Turtle %1':                    'new turtle %1',
  '%1 vorwärts %2 Pixel':              '%1 forward %2 pixels',
  '%1 rückwärts %2 Pixel':             '%1 back %2 pixels',
  '%1 links drehen um %2 Grad':        '%1 turn left by %2 deg',
  '%1 rechts drehen um %2 Grad':       '%1 turn right by %2 deg',
  '%1 Stift heben':                    '%1 pen up',
  '%1 Stift senken':                   '%1 pen down',
  '%1 Stiftfarbe auf %2':              '%1 pen color to %2',
  '%1 Position auf x %2 y %3':         '%1 position to x %2 y %3',
  '%1 Richtung auf %2 Grad':           '%1 heading to %2 deg',
  '%1 zurück zum Ursprung':            '%1 back to origin',
  '%1 Geschwindigkeit %2':             '%1 speed %2',
  '%1 verstecken':                     '%1 hide',
  '%1 zeigen':                         '%1 show',
  '%1 Leinwand löschen':               '%1 clear canvas',
  'Turtle %1 berührt Farbe %2':        'turtle %1 touches color %2',
  'ausgeben %1':                       'print %1',
  'leere Zeile ausgeben':              'print empty line',
  'einlesen mit Aufforderung %1':      'read with prompt %1',
  'einlesen als Zahl mit Aufforderung %1':
                                       'read as number with prompt %1',

  // External sensor block text
  'RTC: Uhr stellen %1Jahr %2 Monat %3 Tag %4 %5Stunde %6 Minute %7 Sekunde %8':
    'RTC: set clock %1Year %2 month %3 day %4 %5hour %6 minute %7 second %8',
  'RTC: %1':                           'RTC: %1',
  'SHT40: Temperatur (°C)':            'SHT40: temperature (°C)',
  'SHT40: Feuchte (%)':                'SHT40: humidity (%)',

  // -- Block-internal field labels (set via .appendField in JS) ----
  'Bild':         'Image',
  'anzeigen':     'show',
  'bei x':        'at x',
  'y':            'y',
  'Funktion':      'Function',
  'aufrufen':     'call',
  'Bild laden:':  'Load image:',
  'Definiert eine eigene Funktion, die du unten überall aufrufen kannst.':
    'Defines your own function that you can then call below.',
  'Ruft eine eigene Funktion auf.':
    'Calls your own function.',

  // -- Dropdown option labels ---------------------------------------
  'Rest':     'mod',
  'Jahr':     'Year',
  'Monat':    'Month',
  'Tag':      'Day',
  'Stunde':   'Hour',
  'Minute':   'Minute',
  'Sekunde':  'Second',
  'gefüllt':  'filled',
  'nur Rand': 'outline only',
  '(keine Bilder)': '(no images)',
  'Umriss':   'outline',
  'an':       'on',
  'aus':      'off',
  'Bildschirmbreite': 'screen width',
  'Bildschirmhöhe':   'screen height',
  'Zufallszahl zwischen %1 und %2': 'random number between %1 and %2',
  'rot':      'red',
  'gelb':     'yellow',
  'grün':     'green',
  'blau':     'blue',
  'schwarz':  'black',
  'weiß':     'white',
  'cyan':     'cyan',
  'magenta':  'magenta',
  'oben':     'up',
  'unten':    'down',
  'links':    'left',
  'rechts':   'right',
  'Mitte':    'centre',
  'A':        'A',
  'B':        'B',
  'X':        'X',
  'Y':        'Y',
  'Z':        'Z',

  // -- External sensors ---------------------------------------------
  'PCF8523 (RTC, Echtzeituhr)': 'PCF8523 (RTC, real-time clock)',
  'SHT40 (Temperatur & Feuchte)': 'SHT40 (temperature & humidity)',
  'Adafruit STEMMA QT Echtzeituhr-Breakout, I2C 0x68.':
    'Adafruit STEMMA QT real-time clock breakout, I2C 0x68.',
  'Adafruit STEMMA QT Sensirion Sensor, I2C 0x44.':
    'Adafruit STEMMA QT Sensirion sensor, I2C 0x44.',
  'RTC: Uhr stellen': 'RTC: set clock',
  'RTC: Zeit': 'RTC: time',
  'SHT40: Temperatur (°C)': 'SHT40: temperature (°C)',
  'SHT40: Feuchte (%)':    'SHT40: humidity (%)',

  // -- Modals --------------------------------------------------------
  'Programm öffnen': 'Open program',
  'Lade ein gespeichertes Block- oder Python-Programm.':
    'Load a saved block or Python program.',
  'Vom Computer…': 'From this computer…',
  'Vom PBC+…':     'From the PBC+…',
  'Abbrechen': 'Cancel',
  'Speichern': 'Save',
  'Auf den PBC+ speichern': 'Save to the PBC+',
  'Wähle einen Dateinamen. Oder klicke auf eine vorhandene Datei, um sie zu überschreiben.':
    'Choose a filename. Or click an existing file to overwrite it.',
  'Dateiname:': 'Filename:',
  'Bilder verwalten': 'Manage images',
  'Sprite anlegen': 'Create sprite',
  'Lade…': 'Loading…',

  // -- Settings dialog ----------------------------------------------
  'Aktivierte Sensoren erscheinen als Block-Kategorie „Externe Sensoren“. Der Treiber-Code wird automatisch in dein Programm eingebaut – du musst keine Bibliotheken hochladen.':
    'Enabled sensors appear in the "External sensors" block category. ' +
    'Driver code is added to your program automatically — no library uploads needed.',
  'Sprache': 'Language',
  'Deutsch': 'German',
  'Englisch': 'English',
  'Bei Wechsel wird die Seite neu geladen.':
    'Reloads the page when switched.',
  'Schriftgröße im Texteditor': 'Text editor font size',
  'Gilt für den Python-Editor im Text-Modus.':
    'Applies to the Python editor in text mode.',

  // -- Help pane ----------------------------------------------------
  'Hilfe': 'Help',
  'Schließen': 'Close',
  'Klicke links auf einen Eintrag, um Hilfe und Beispiele zu sehen.':
    'Click an entry on the left to see help and examples.',

  // -- Toasts and inline messages -----------------------------------
  'Erst verbinden.': 'Connect first.',
  'Erst trennen, dann das Ziel wechseln.': 'Disconnect first, then switch target.',
  'Herunterladen:': 'Downloading:',
  'Herunterladen': 'Download',
  'heruntergeladen': 'downloaded',
  'Herunterladen fehlgeschlagen': 'Download failed',
  'Bitte Dateinamen eingeben.': 'Please enter a filename.',
  'Speichern fehlgeschlagen': 'Save failed',
  'Bild speichern': 'Save image',
  'Dateiname:': 'Filename:',
  'Keine Leerzeichen oder /\\\'\"\` erlaubt.':
    'No spaces or /\\\'\"\` characters allowed.',
  'Datei „': 'File "',
  '" existiert bereits auf dem PBC+ und wird überschrieben. Fortfahren?':
    '" already exists on the PBC+ and will be overwritten. Proceed?',
  'Aktuelles Bild verwerfen und neu beginnen?':
    'Discard the current image and start over?',
  'Erst verbinden': 'Connect first',
  'Nicht verbunden': 'Not connected',
  'Nicht verbunden.': 'Not connected.',
  'Bereit.': 'Ready.',
  'Getrennt': 'Disconnected',
  'Kein Code zum Ausführen.': 'Nothing to run.',
  'Dateiname fehlt': 'Filename missing',
  'Einstellungen gespeichert': 'Settings saved',
  'Gespeichert als': 'Saved as',
  'geladen': 'loaded',
  'als Python geladen': 'loaded as Python',
  'gelöscht': 'deleted',
  'auf PBC+ gespeichert': 'saved to PBC+',
  'Speichern fehlgeschlagen': 'Save failed',
  'Löschen fehlgeschlagen': 'Delete failed',
  'Hochladen fehlgeschlagen': 'Upload failed',
  'hochgeladen':             'uploaded',
  'Verbunden':               'Connected',
  'Programm gestoppt':       'Program stopped',
  'Blöcke suchen…':          'Search blocks…',
  'Suche löschen':           'Clear search',
  'Keine passenden Blöcke.': 'No matching blocks.',
  'gestoppt':                'stopped',
  'Stop fehlgeschlagen:':    'Stop failed:',
  'Trennen':                 'Disconnect',
  'verbunden':               'connected',
  'nicht verbunden':         'not connected',
  'Laden fehlgeschlagen':    'Load failed',
  'Datei nicht lesbar:':     'File not readable:',
  'Antwort vom Gerät unverständlich': 'Unrecognised response from device',
  'Verbindung fehlgeschlagen:':  'Connection failed:',
  'Bild konnte nicht geladen werden': "Couldn't load image",
  'PNG-Erzeugung fehlgeschlagen': 'PNG generation failed',
  'Sprite':                  'Sprite',
  'angelegt':                'created',
  'Web Serial nicht unterstützt. Bitte Chrome oder Edge nutzen.':
    'Web Serial not supported. Please use Chrome or Edge.',

  // -- Terminal banner + ANSI-wrapped status messages ---------------
  'PBC+ Studio Terminal': 'PBC+ Studio Terminal',
  'Klicke %1, um einen PBC+ per USB anzuschließen.':
    'Click %1 to connect a PBC+ via USB.',
  '-- verbunden --':              '-- connected --',
  '-- getrennt --':               '-- disconnected --',
  'Testlauf':                     'Test run',
  'Testlauf beendet':             'Test run finished',
  'Stop gesendet':                'Stop sent',
  'Speichern:':                   'Saving:',
  'Hochladen:':                   'Uploading:',
  'fertig':                       'done',
  'Verbindung zum Gerät verloren':'Connection to device lost',
  'keine OK-Quittung':            'no OK acknowledgement',
  // Added with build 137 (English pass over dialogs and messages).
  "Definiert eine Funktion mit Rückgabewert. Ihr Aufruf lässt sich direkt in eine Wert-Lücke ziehen. Mit + fügst du Parameter hinzu.":
    "Defines a function with a return value. Its call fits straight into a value slot. Use + to add parameters.",
  "Definiert eine eigene Funktion. Mit + fügst du Parameter hinzu; rufe sie unten überall auf.":
    "Defines your own function. Use + to add parameters; call it anywhere below.",
  "Liest einen Parameter oder eine lokale Variable der Funktion.":
    "Reads a parameter or a local variable of the function.",
  "Erstellt eine lokale Variable, die nur in dieser Funktion gilt (kein \"global\" nötig).":
    "Creates a local variable that only exists inside this function (no \"global\" needed).",
  "Keine Funktionen.":
    "No functions.",
  "Überschreiben":
    "Overwrite",
  "Bitte zuerst den PBC+ per USB verbinden (Schalter auf PBC+).":
    "Please connect the PBC+ via USB first (switch set to PBC+).",
  "PBC+ → Emulator übertragen":
    "Copy PBC+ → emulator",
  "Emulator → PBC+ übertragen":
    "Copy emulator → PBC+",
  "Dateien auswählen, die vom Gerät in den Emulator kopiert werden.":
    "Choose the files to copy from the device into the emulator.",
  "Dateien auswählen, die aus dem Emulator auf das Gerät kopiert werden.":
    "Choose the files to copy from the emulator onto the device.",
  "Übertragen":
    "Copy",
  "Keine Dateien gefunden.":
    "No files found.",
  "überschreibt":
    "overwrites",
  "Überschreiben bestätigen":
    "Confirm overwrite",
  "Diese Dateien existieren am Ziel bereits und werden überschrieben:":
    "These files already exist at the destination and will be overwritten:",
  "Fortfahren?":
    "Proceed?",
  "Fertig":
    "Done",
  "Datei(en) übertragen":
    "file(s) copied",
  "übertragen":
    "copied",
  "fehlgeschlagen":
    "failed",
  "Zeichen-Position außerhalb":
    "Character position out of range",
  "Du hast ein Zeichen an einer Stelle angesprochen, die es im Text nicht gibt. Positionen gehen von 0 bis Länge-1.":
    "You asked for a character at a position the text does not have. Positions go from 0 to length-1.",
  "Ungültiger Wert":
    "Invalid value",
  "Das gesuchte Element ist nicht in der Liste. Prüfe vorher mit \"in\", ob es darin vorkommt.":
    "The element you are looking for is not in the list. Check first with \"in\" whether it is there.",
  "Die Liste ist leer – davon gibt es kein Minimum oder Maximum.":
    "The list is empty – it has no minimum or maximum.",
  "Ein Wert passt nicht zu dieser Funktion. Schau in die rote Fehlermeldung im Terminal, um zu sehen welcher.":
    "A value does not fit this function. Look at the red error message in the terminal to see which one.",
  "Datei nicht gefunden":
    "File not found",
  "Das Programm wollte eine Datei öffnen, die es nicht gibt. Prüfe den Dateinamen – oder schreibe die Datei zuerst. Ein Bild muss vorher mit „Dateien → Bilder verwalten…“ hochgeladen sein.":
    "The program tried to open a file that does not exist. Check the file name – or write the file first. An image has to be uploaded with “Files → Manage images…” first.",
  "Der Emulator konnte nicht geladen werden":
    "The emulator could not be loaded",
  "Zuerst mit dem Gerät verbinden.":
    "Connect to the device first.",
  "(keine Funktion)":
    "(no function)",
  "Sprite löschen":
    "Delete sprite",
  "Sprite „%1“ löschen?":
    "Delete sprite “%1”?",
  "— Noch keine Bilder hochgeladen —":
    "— No images uploaded yet —",
  "Lade ein Bild über das Menü <em>Dateien ▾ → Bilder verwalten…</em> hoch und versuche es erneut.":
    "Upload an image via <em>Files ▾ → Manage images…</em> and try again.",
  "konnte nicht erstellt werden:":
    "could not be created:",
  "Programme laufen unverändert in einem eigenen Thread, mit so viel Speicher wie auf dem PicoBoy.":
    "Programs run unchanged in their own thread, with as much memory as on the PicoBoy.",
  "Nicht verfügbar: Der Webserver sendet die nötigen Header nicht (siehe .htaccess).":
    "Not available: the web server does not send the required headers (see .htaccess).",
  "Schreibgeschützt. Aktiviere die Bearbeitung, um Python direkt zu ändern.":
    "Read-only. Enable editing to change the Python code directly.",
  "Wenn du jetzt zu den Blöcken zurückwechselst, gehen alle Änderungen am Python-Code verloren. Die Blöcke überschreiben den Editor-Inhalt.\n\nWirklich zurückwechseln?":
    "If you switch back to blocks now, all changes to the Python code are lost. The blocks overwrite the editor content.\n\nReally switch back?",
  "Wenn du die Python-Bearbeitung aktivierst, geht der Weg NUR IN EINE RICHTUNG:\n\n  Blöcke  →  Python (jetzt)\n  Python  →  Blöcke ist NICHT möglich.\n\nDu kannst zwar zurück zu den Blöcken wechseln, aber dann gehen deine Python-Änderungen verloren.\n\nFortfahren?":
    "Enabling Python editing is a ONE-WAY street:\n\n  Blocks  →  Python (now)\n  Python  →  Blocks is NOT possible.\n\nYou can switch back to blocks, but then your Python changes are lost.\n\nProceed?",
  "Python-Bearbeitung aktiv. Zurück zu Blöcken bedeutet Datenverlust.":
    "Python editing active. Going back to blocks loses your changes.",
  "„%1“ wird benutzt, aber nicht importiert. Schreibe oben: import %1":
    "“%1” is used but not imported. Add at the top: import %1",
  "%1 gibt es nicht.":
    "%1 does not exist.",
  "Meintest du %1?":
    "Did you mean %1?",
  "Datei „%1“ wirklich vom PBC+ löschen?":
    "Really delete file “%1” from the PBC+?",
  "Das kann nicht rückgängig gemacht werden.":
    "This cannot be undone.",
  "Noch keine %1-Dateien auf dem Gerät.":
    "No %1 files on the device yet.",
  "„%1“ gibt es schon auf dem PBC+. Überschreiben?":
    "“%1” already exists on the PBC+. Overwrite?",
  "Mini-Sprite":
    "mini sprite",
  "kleines Sprite":
    "small sprite",
  "mittleres Sprite":
    "medium sprite",
  "großes Sprite":
    "large sprite",
  "ganzes Display":
    "whole display",
  "nicht verfügbar":
    "not available",
  "lade MicroPython…":
    "loading MicroPython…",
  "läuft":
    "running",
  "Fehler:":
    "Error:",
  "Noch keine Bilder. Lade welche über „Bilder verwalten…“ hoch oder zeichne welche mit „Bild zeichnen…“.":
    "No images yet. Upload some via “Manage images…” or draw some with “Draw image…”.",
  "„%1“ aus dem Browser löschen?":
    "Delete “%1” from the browser?",
  "Keine PNG-Dateien auf dem Gerät.":
    "No PNG files on the device.",
  "„%1“ wirklich löschen?":
    "Really delete “%1”?",
  "Öffnen":
    "Open",
  "Bild zeichnen…":
    "Draw image…",
  "Hier klicken und Hardware wünschen.":
    "Click here to request hardware.",
  "Dateien auf dem Gerät (nur":
    "Files on the device (only",
  "Hinweis: Vom PBC+ geladene Dateien landen im Text-Modus.":
    "Note: files loaded from the PBC+ open in text mode.",
  "Wähle einen Namen und ein Bild. Das Bild muss schon auf den PBC+ hochgeladen sein (oder per „Bilder verwalten…\").":
    "Choose a name and an image. The image must already be uploaded to the PBC+ (or via “Manage images…”).",
  "Bild:":
    "Image:",
  "Vorhandene Dateien (Klick = übernehmen + überschreiben):":
    "Existing files (click = use name + overwrite):",
  "Bilder auf dem PBC+":
    "Images on the PBC+",
  "Hochgeladene PNG-Dateien kannst du direkt auf dem Display anzeigen lassen (Block":
    "You can show uploaded PNG files directly on the display (block",
  "unter „Display\") oder als Sprite verwenden (Blöcke unter „Sprites\"). Zum Hoch- oder Anzeigen muss das Gerät verbunden sein.":
    "under “Display”) or use them as sprites (blocks under “Sprites”). The device must be connected to upload or show them.",
  "Farbe wählen":
    "Choose colour",
  "Bild bearbeiten und hochladen":
    "Edit and upload image",
  "Noch kein Bild geladen.":
    "No image loaded yet.",
  "Bild von der Festplatte wählen…":
    "Choose image from disk…",
  "Ausgabegröße":
    "Output size",
  "Maximal 240 × 280 (Display-Größe)":
    "At most 240 × 280 (display size)",
  "Seitenverhältnis beibehalten":
    "Keep aspect ratio",
  "Vorschau auf dem Display":
    "Preview on the display",
  "Tipp: Ziehe das blaue Rechteck zum Verschieben, die Ecken zum Verändern der Größe. Das Bild wird beim Hochladen auf die Ausgabegröße skaliert.":
    "Tip: drag the blue rectangle to move it, its corners to resize. The image is scaled to the output size when uploading.",
  "Anderes Bild…":
    "Other image…",
  "Neues Bild zeichnen":
    "Draw new image",
  "Wähle die Größe des Bildes. Sprites sind typisch 16–48 Pixel gross; ein ganzes Display ist 240×280.":
    "Choose the size of the image. Sprites are typically 16–48 pixels; a whole display is 240×280.",
  "Höhe:":
    "Height:",
  "Bild zeichnen":
    "Draw image",
  "Rückgängig":
    "Undo",
  "Stärke":
    "Width",
  "Farbe":
    "Colour",
  "Wie möchtest du dein Programm ausführen?":
    "How do you want to run your program?",
  "PBC+ über USB":
    "PBC+ via USB",
  "Echtes Gerät, am Computer angeschlossen":
    "Real device, connected to the computer",
  "Virtueller PBC+ im Browser, kein Gerät nötig":
    "Virtual PBC+ in the browser, no device needed",
  "Der Emulator führt MicroPython im Browser aus. Manche Funktionen sind eingeschränkt:":
    "The emulator runs MicroPython in the browser. Some functions are limited:",
  "Bilder im Browser":
    "Images in the browser",
  "Diese Bilder sind im Browser gespeichert (nicht auf einem Gerät) und stehen dem Emulator zur Verfügung.":
    "These images are stored in the browser (not on a device) and are available to the emulator.",
  "Ziel wählen: echtes Gerät oder Emulator":
    "Choose target: real device or emulator",
  "Codeansicht ein-/ausblenden":
    "Show/hide code view",
  "Ziehen, um das Terminal größer oder kleiner zu machen":
    "Drag to make the terminal bigger or smaller",
  "Steuerung: Joystick und Tasten antippen oder Pfeile · A · B · Leertaste":
    "Controls: tap the joystick and buttons, or arrows · A · B · space",
  "Ziehen = Gerät kippen, Doppelklick = flach hinlegen":
    "Drag = tilt device, double-click = lay flat",
};

function t(s) {
  if (LANG === 'en') return I18N_EN[s] || s;
  return s;
}

// Localize a structured help value. The help data uses bilingual
// objects of the form { de: '...', en: '...' }: this helper picks
// the right variant for the active language, falling back to German
// if the English translation isn't filled in yet.
//
// For plain strings (no bilingual wrapper), L() also consults
// HELP_LABEL_TRANSLATIONS so labels and section titles can be
// translated without bloating every entry with { de, en } wrappers.
// Long body texts that aren't in the lookup remain in German under
// English mode -- still readable, and translatable incrementally.
function L(v) {
  if (v == null) return v;
  if (typeof v === 'object' && !Array.isArray(v) &&
      (v.de !== undefined || v.en !== undefined)) {
    if (LANG === 'en' && v.en !== undefined) return v.en;
    return v.de !== undefined ? v.de : (v.en || '');
  }
  if (typeof v === 'string' && LANG === 'en' &&
      HELP_LABEL_TRANSLATIONS[v] !== undefined) {
    return HELP_LABEL_TRANSLATIONS[v];
  }
  return v;
}

// German -> English lookup for labels, section titles, button text
// inside the help sidebar. Keep entries here short -- it's for the
// strings shown directly in the left-hand list, not for long topic
// bodies (those are wrapped in { de, en } objects where translated).
const HELP_LABEL_TRANSLATIONS = {
  // Categories
  'Einführung':           'Introduction',
  'Grundlagen':           'Basics',
  'Kontrollstrukturen':   'Control structures',
  'Listen':               'Lists',
  'Funktionen':             'Functions',
  'Zeit':                 'Time',
  'Dateien':              'Files',
  'PBC+ Display':         'PBC+ display',
  'PBC+ Bilder & Sprites':'PBC+ images & sprites',
  'PBC+ Canvas':          'PBC+ canvas',
  'PBC+ Turtle':          'PBC+ turtle',
  'Auf das Canvas zeichnen': 'Drawing on the canvas',
  'PBC+ Eingabe':         'PBC+ input',
  'PBC+ Sensoren':        'PBC+ sensors',
  'PBC+ LEDs & Sound':    'PBC+ LEDs & sound',

  // Section titles
  'Ausgabe und Kommentare':'Output and comments',
  'Werte und Variablen':   'Values and variables',
  'Rechnen & Vergleichen': 'Math & comparison',
  'Verzweigungen':         'Branches',
  'Wiederholungen':        'Loops',
  'Direkt zeichnen':       'Drawing directly',
  'Canvas (Bildpuffer)':   'Canvas (frame buffer)',
  'Bilder anzeigen':       'Showing images',
  'Sprites':               'Sprites',
  'Knöpfe':                'Buttons',
  'Joystick':              'Joystick',
  'Bewegung':              'Motion',
  'Batterie':              'Battery',
  'Status-LEDs':           'Status LEDs',
  'RGB-LED':               'RGB LED',
  'Sound':                 'Sound',

  // Entry labels in HELP_CATEGORIES (these survive even when bodies
  // aren't translated yet)
  'Variablen':                  'Variables',
  'Ganze Zahlen (int)':         'Integers (int)',
  'Kommazahlen (float)':        'Floats (float)',
  'Strings (Texte)':            'Strings (text)',
  'Vergleichen':                'Comparing',
  'Zufall':                     'Random',
  'if':                         'if',
  'if / else':                  'if / else',
  'elif':                       'elif',
  'for-Schleife':               'for-loop',
  'while-Schleife':             'while-loop',
  'break':                      'break',
  'continue':                   'continue',
  'Verschachtelte Schleifen':   'Nested loops',
  'Liste erzeugen':             'Creating a list',
  'Index-Zugriff':              'Index access',
  'Element ändern':             'Changing an element',
  '.append() – anhängen':        '.append() – add to end',
  '.remove() – löschen':         '.remove() – delete',
  'len() – Länge':               'len() – length',
  'Slicing':                    'Slicing',
  'Mit for durchlaufen':        'Iterating with for',
  'Strings sind auch Sequenzen':'Strings are sequences too',
  'def – Funktion definieren':   'def – defining a function',
  'Parameter':                  'Parameters',
  'return – Wert zurückgeben':  'return – returning a value',
  'Mehrere Parameter':          'Multiple parameters',
  'Funktion aus Funktion aufrufen':'Calling a function from a function',
  'import time':                'import time',
  'Farben':                     'Colors',

  // PBC+ display
  'pbc.fill(farbe)':            'pbc.fill(color)',
  'pbc.clear()':                'pbc.clear()',
  'pbc.pixel(x, y, farbe)':     'pbc.pixel(x, y, color)',
  'pbc.line(...)':              'pbc.line(...)',
  'pbc.rect / fill_rect':       'pbc.rect / fill_rect',
  'pbc.ellipse(…, fill)':       'pbc.ellipse(…, fill)',
  'pbc.text12(...)':            'pbc.text12(...)',
  'pbc.WIDTH / pbc.HEIGHT':     'pbc.WIDTH / pbc.HEIGHT',
  'Canvas(breite, höhe)':       'Canvas(width, height)',
  'Auf Canvas zeichnen':        'Drawing on a canvas',
  'pbc.show(canvas, x, y)':     'pbc.show(canvas, x, y)',
  'pbc.load_image(datei)':      'pbc.load_image(file)',
  'pbc.show(bild, x, y)':       'pbc.show(image, x, y)',
  'pbc.sprite(datei)':          'pbc.sprite(file)',
  '.show() / .hide()':          '.show() / .hide()',
  '.set_to(x, y)':              '.set_to(x, y)',
  '.set_by(dx, dy)':            '.set_by(dx, dy)',
  '.glide_to(x, y, ms)':        '.glide_to(x, y, ms)',
  '.glide_by(dx, dy, ms)':      '.glide_by(dx, dy, ms)',
  '.touches(anderer)':          '.touches(other)',
  '.touches_edge()':            '.touches_edge()',
  '.on_color(farbe)':           '.on_color(color)',
  'pbc.pressed_a()':            'pbc.pressed_a()',
  'pbc.pressed_b()':            'pbc.pressed_b()',
  'pbc.was_pressed_a()':        'pbc.was_pressed_a()',
  'pbc.was_pressed_b()':        'pbc.was_pressed_b()',
  'pbc.pressed_up() / _down / _left / _right / _center':
    'pbc.pressed_up() / _down / _left / _right / _center',
  'pbc.was_pressed_up() / _down / _left / _right / _center':
    'pbc.was_pressed_up() / _down / _left / _right / _center',
  'pbc.accel_x()':              'pbc.accel_x()',
  'pbc.accel_y()':              'pbc.accel_y()',
  'pbc.accel_z()':              'pbc.accel_z()',
  'pbc.battery_voltage()':      'pbc.battery_voltage()',
  'pbc.led_red(an)':            'pbc.led_red(on)',
  'pbc.led_yellow(an)':         'pbc.led_yellow(on)',
  'pbc.led_green(an)':          'pbc.led_green(on)',
  'pbc.rgb_led(r, g, b)':       'pbc.rgb_led(r, g, b)',
  'pbc.rgb_led_off()':          'pbc.rgb_led_off()',
  // PBC+ canvas help entries
  'Canvas zeigen':              'Show canvas',
  'Turtle auf das Canvas zeichnen lassen':
    'Have a turtle draw on the canvas',
  'Canvas hinter Sprites zeigen':
    'Show the canvas behind sprites',

  // PBC+ turtle help entries
  'Turtle anlegen':             'Create a turtle',
  '.forward(distanz)':          '.forward(distance)',
  '.back(distanz)':             '.back(distance)',
  '.left(winkel)':              '.left(angle)',
  '.right(winkel)':             '.right(angle)',
  '.penUp() / .penDown()':      '.penUp() / .penDown()',
  '.setPenColor(farbe)':        '.setPenColor(color)',
  '.setPosition(x, y)':         '.setPosition(x, y)',
  '.setDirection(winkel)':      '.setDirection(angle)',
  '.home()':                    '.home()',
  '.speed(0..10)':              '.speed(0..10)',
  '.clear()':                   '.clear()',

  'pbc.tone(freq)':             'pbc.tone(freq)',
  'pbc.no_tone()':              'pbc.no_tone()',
  'Eine Melodie':               'A melody',
  'os.listdir()':               'os.listdir()',
  "open(...,'w') – schreiben":  "open(...,'w') – writing",
  "open(...,'r') – lesen":      "open(...,'r') – reading",
  'with-Block':                 'with-block',
};

if (typeof Blockly === 'undefined') {
  bootError(
    "Blockly konnte nicht geladen werden. Prüfe deine Internet-" +
    "verbindung oder ob der Browser Skripte von cdnjs.cloudflare.com " +
    "blockiert.\n\nFalls du die Datei per file:// öffnest, achte " +
    "darauf, dass Chrome nicht im Offline-Modus läuft."
  );
  throw new Error('Blockly missing');
}

// Locate the Python generator. Blockly 12.x exposes it as
//   window.python.pythonGenerator
// (when loaded via the python.min.js script tag). Fall back to
// older shapes just in case.
const PY = (window.python && window.python.pythonGenerator)
        || (window.Blockly && window.Blockly.Python)
        || null;
if (!PY) {
  bootError(
    "Der Python-Generator wurde nicht gefunden. Erwartet wird " +
    "<code>window.python.pythonGenerator</code> (Blockly 12.x) " +
    "oder <code>Blockly.Python</code> (älter). " +
    "Gefundene Globale beginnend mit 'python' oder 'Blockly': " +
    Object.keys(window).filter(k => /^(python|Blockly)/.test(k)).join(', ')
  );
  throw new Error('Python generator missing');
}

// Force the Python generator to use 4-space indentation. Blockly's
// default is 2 spaces, which conflicts with our CodeMirror config
// (indentUnit:4) -- without this, code looks "shallower" in block
// mode than in text mode, and the smart-Backspace / Enter handlers
// in the editor don't line up with what the generator produces.
//
// Both spellings exist depending on Blockly version, set both for
// safety.
PY.INDENT = '    ';
if ('indent' in PY) PY.indent = '    ';
if (typeof Terminal === 'undefined') {
  bootError("xterm.js konnte nicht geladen werden. Prüfe deine Internetverbindung.");
  throw new Error('xterm missing');
}

if (typeof CodeMirror === 'undefined') {
  bootError("CodeMirror konnte nicht geladen werden. Prüfe deine Internetverbindung.");
  throw new Error('CodeMirror missing');
}

