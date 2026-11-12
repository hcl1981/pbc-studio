/* =====================================================================
 * Help content for the text-mode sidebar.
 *
 * Structure:
 *   HELP_CATEGORIES = [{ key, label, icon, sections: [...] }]
 *   each section = { title?, entries: [{ id, label, content }] }
 *   content = { kind: 'intro' | 'topic',
 *               body: '...html...',
 *               signature?: '...',
 *               example?: '...python...',
 *               insert?: '...python snippet for "Einfügen" button...' }
 *
 * When the user clicks an entry, the help panel on the right shows
 * the content. For 'topic' entries with an `insert` snippet the
 * panel offers a button to drop that snippet at the cursor.
 * ===================================================================== */

const HELP_CATEGORIES = [
  {
    key: 'intro', label: { de: 'Einführung', en: 'Introduction' }, icon: '🧭',
    sections: [{ entries: [
      { id: 'intro-what',
        label: { de: 'Was ist Python?', en: 'What is Python?' },
        content: { kind: 'intro', body: {
          de: `<p>Python ist eine <b>Programmiersprache</b>. Mit ihr schreibst du Anweisungen,
        die ein Computer ausführt. Python gibt es auf vielen Geräten – auf normalen
        Computern, auf Handys, auf Servern im Internet, und auch auf kleinen Mikrocontrollern
        wie dem PBC+.</p>
        <p>Python gilt als <b>einfache Sprache zum Einsteigen</b>: die Regeln sind übersichtlich,
        viele Aufgaben gehen mit wenigen Zeilen, und man muss sich am Anfang nicht um
        Themen wie Datentypen oder Speicherverwaltung kümmern. Deshalb wird Python oft als
        erste Sprache gelernt. Auch große Firmen wie Google, Netflix oder die NASA nutzen
        Python für ihre Programme.</p>
        <p>Ein Python-Programm ist im Grunde eine Textdatei mit der Endung <code>.py</code>.
        In dieser Datei stehen Zeilen – jede Zeile ist eine Anweisung. Der Computer liest
        die Datei von oben nach unten und führt die Anweisungen der Reihe nach aus.</p>`,
          en: `<p>Python is a <b>programming language</b>. You use it to write instructions
        that a computer carries out. Python runs on many kinds of devices — desktop
        computers, phones, internet servers, and even small microcontrollers like the
        PBC+.</p>
        <p>Python is considered an <b>easy language for beginners</b>: the rules are
        manageable, many tasks take only a few lines, and you don't have to worry about
        topics like data types or memory management at first. That's why it's often
        taught as a first language. Big companies like Google, Netflix and NASA use
        Python too.</p>
        <p>A Python program is essentially a text file ending in <code>.py</code>.
        It contains lines — each line is an instruction. The computer reads the file
        top to bottom and runs the instructions in order.</p>`,
        } } },

      { id: 'intro-flow',
        label: { de: 'So läuft ein Programm', en: 'How a program runs' },
        content: { kind: 'intro', body: {
          de: `<p>Ein Programm läuft <b>sequenziell</b> ab: Zeile für Zeile, von oben nach unten.
        Was zuerst dasteht, passiert zuerst. Was darunter steht, passiert danach.</p>

        <pre><code>print("Eins")
print("Zwei")
print("Drei")</code></pre>

        <p>Dieses Programm gibt nacheinander „Eins", „Zwei", „Drei" aus – nie in anderer
        Reihenfolge.</p>

        <p>Du kannst diesen geradlinigen Ablauf mit <b>Kontrollstrukturen</b> beeinflussen:</p>
        <ul>
          <li><b>Verzweigung</b> (<code>if</code>): manche Zeilen überspringen, wenn eine
            Bedingung nicht stimmt.</li>
          <li><b>Wiederholung</b> (<code>for</code>, <code>while</code>): einen Block mehrfach
            ausführen.</li>
          <li><b>Funktionen</b> (<code>def</code>): einen benannten Block bauen, der von
            woanders gerufen werden kann.</li>
        </ul>

        <p>Ohne diese Hilfen würdest du jede Zeile genau einmal ausführen – mit ihnen kannst
        du komplexe Abläufe steuern.</p>`,
          en: `<p>A program runs <b>sequentially</b>: line by line, top to bottom. What's
        written first happens first. What's written below happens after.</p>

        <pre><code>print("One")
print("Two")
print("Three")</code></pre>

        <p>This program prints "One", "Two", "Three" in that order — never differently.</p>

        <p>You can change the straight-line flow with <b>control structures</b>:</p>
        <ul>
          <li><b>Branching</b> (<code>if</code>): skip some lines if a condition isn't met.</li>
          <li><b>Looping</b> (<code>for</code>, <code>while</code>): run a block multiple times.</li>
          <li><b>Functions</b> (<code>def</code>): build a named block that can be called from
            elsewhere.</li>
        </ul>

        <p>Without these tools you'd run each line exactly once — with them you can build
        complex flows.</p>`,
        } } },

      { id: 'intro-first',
        label: { de: 'Mein erstes Programm', en: 'My first program' },
        content: { kind: 'intro', body: {
          de: `<p>Hier ist ein vollständiges kleines Programm für den PBC+. Es löscht den
        Bildschirm und schreibt einen Gruß darauf.</p>

        <pre><code>import pbc

pbc.clear()
pbc.text12("Hallo PBC+!", 60, 130, pbc.WHITE)</code></pre>

        <p>Was passiert hier Zeile für Zeile:</p>
        <ol>
          <li><code>import pbc</code> – lädt das PBC+-Modul, das uns Befehle für Display,
            Knöpfe, LEDs usw. gibt.</li>
          <li><code>pbc.clear()</code> – malt den Bildschirm schwarz.</li>
          <li><code>pbc.text12(...)</code> – schreibt den Text an Position (60, 130) in Weiß.</li>
        </ol>

        <p>Klicke auf <b>▶ Testen</b> in der Werkzeugleiste, um das Programm auf dem PBC+
        auszuführen.</p>`,
          en: `<p>Here is a complete tiny program for the PBC+. It clears the screen and
        writes a greeting on it.</p>

        <pre><code>import pbc

pbc.clear()
pbc.text12("Hello PBC+!", 60, 130, pbc.WHITE)</code></pre>

        <p>What happens line by line:</p>
        <ol>
          <li><code>import pbc</code> – loads the PBC+ module that gives us commands for the
            display, buttons, LEDs and so on.</li>
          <li><code>pbc.clear()</code> – paints the screen black.</li>
          <li><code>pbc.text12(...)</code> – writes the text at position (60, 130) in white.</li>
        </ol>

        <p>Click <b>▶ Run</b> in the toolbar to run the program on the PBC+.</p>`,
        },
        insert: {
          de: 'import pbc\n\npbc.clear()\npbc.text12("Hallo PBC+!", 60, 130, pbc.WHITE)\n',
          en: 'import pbc\n\npbc.clear()\npbc.text12("Hello PBC+!", 60, 130, pbc.WHITE)\n',
        } } },
    ] }],
  },

  // ============================== GRUNDLAGEN ===========================
  {
    key: 'basics', label: { de: 'Grundlagen', en: 'Basics' }, icon: '🐍',
    sections: [
      { title: { de: 'Ausgabe und Kommentare', en: 'Output and comments' },
        intro: { kind: 'intro', body: {
          de: `<p>Zwei kleine Werkzeuge, die du in fast jedem Programm benutzen wirst:</p>
          <ul>
            <li><b>print(…)</b> schreibt etwas in die <b>Konsole</b> – das schwarze Feld
              unten in der IDE. Das ist die einfachste Art, sich anzuschauen, was dein
              Programm gerade tut, und das wichtigste Werkzeug zur Fehlersuche.</li>
            <li><b># Kommentare</b> sind Notizen für Menschen. Der Computer ignoriert
              sie. Du schreibst sie für dich selbst und für andere, die deinen Code
              später lesen müssen.</li>
          </ul>`,
          en: `<p>Two little tools you'll use in almost every program:</p>
          <ul>
            <li><b>print(…)</b> writes something to the <b>console</b> – the black panel
              at the bottom of the IDE. This is the simplest way to see what your
              program is doing, and the most important debugging tool.</li>
            <li><b># Comments</b> are notes for humans. The computer ignores them. You
              write them for yourself and for others who'll read your code later.</li>
          </ul>`,
        } },
        entries: [
        { id: 'basics-print', label: { de: 'print(…)', en: 'print(…)' },
          content: { kind: 'topic',
          body: { de: `<p>Schreibt etwas in die <b>Konsole</b> (das schwarze Feld unten in der IDE).
          Eines der häufigsten Werkzeuge zum Debugging – „mal schauen was hier drinsteht".</p>`,
                  en: `<p>Writes something to the <b>console</b> (the black panel at the bottom
          of the IDE). One of the most common debugging tools – "let's see what's in here".</p>` },
          signature: { de: 'print(wert)', en: 'print(value)' },
          example: { de: 'print("Hallo")\nprint(42)\nprint("Ergebnis:", 2 + 3)',
                     en: 'print("Hello")\nprint(42)\nprint("Result:", 2 + 3)' },
          insert: { de: 'print("Hallo")\n', en: 'print("Hello")\n' } } },

        { id: 'basics-comment', label: { de: '# Kommentar', en: '# Comment' },
          content: { kind: 'topic',
          body: { de: `<p>Alles nach einem <code>#</code> wird vom Computer ignoriert. Kommentare
          sind Notizen für Menschen, die deinen Code lesen – oder für dich selbst in einer
          Woche, wenn du nicht mehr weißt was du gemeint hast.</p>`,
                  en: `<p>Everything after a <code>#</code> is ignored by the computer.
          Comments are notes for humans reading your code – or for yourself a week
          from now, when you no longer remember what you meant.</p>` },
          example: { de: '# Das hier ist eine Notiz\npunkte = 0   # Spielstand beginnt bei 0',
                     en: '# This is a note\nscore = 0   # game score starts at 0' },
          insert: '# ' } },
      ] },
      { title: { de: 'Werte und Variablen', en: 'Values and variables' },
        intro: { kind: 'intro', body: {
          de: `<p>Eine <b>Variable</b> ist ein Name, unter dem du einen Wert speicherst.
          Stell dir eine Schublade vor, auf der ein Schild klebt – das Schild ist der Name,
          in der Schublade liegt der Wert.</p>

          <pre><code>alter = 12
name = "Mia"
pi = 3.14</code></pre>

          <p>Über den Namen kommst du später wieder an den Wert. Variablen können
          verschiedene <b>Datentypen</b> enthalten:</p>
          <ul>
            <li><b>Ganzzahlen</b> (<code>int</code>): <code>42</code>, <code>-7</code>, <code>0</code></li>
            <li><b>Kommazahlen</b> (<code>float</code>): <code>3.14</code>, <code>-0.5</code></li>
            <li><b>Texte</b> (<code>str</code>): <code>"Hallo"</code>, <code>'Welt'</code></li>
            <li><b>Wahrheitswerte</b> (<code>bool</code>): <code>True</code> oder <code>False</code></li>
          </ul>

          <p>Du kannst Variablen jederzeit ändern, indem du ihnen einen neuen Wert
          zuweist – auch einen ganz anderen Typ.</p>`,
          en: `<p>A <b>variable</b> is a name under which you store a value. Picture a
          drawer with a label stuck on it – the label is the name, the value lives
          inside.</p>

          <pre><code>age = 12
name = "Mia"
pi = 3.14</code></pre>

          <p>Through the name you can get back to the value later. Variables can hold
          different <b>data types</b>:</p>
          <ul>
            <li><b>Integers</b> (<code>int</code>): <code>42</code>, <code>-7</code>, <code>0</code></li>
            <li><b>Floating-point numbers</b> (<code>float</code>): <code>3.14</code>, <code>-0.5</code></li>
            <li><b>Strings</b> (<code>str</code>): <code>"Hello"</code>, <code>'World'</code></li>
            <li><b>Boolean values</b> (<code>bool</code>): <code>True</code> or <code>False</code></li>
          </ul>

          <p>You can change variables at any time by assigning a new value – even of a
          completely different type.</p>`,
        } },
        entries: [
        { id: 'basics-var', label: { de: 'Variablen', en: 'Variables' },
          content: { kind: 'topic',
          body: { de: `<p>Eine Variable speichert einen Wert unter einem Namen. Du schreibst
          <code>name = wert</code>, danach steht der Wert in der Variable.</p>
          <p>Namen müssen mit einem Buchstaben anfangen, dürfen Buchstaben/Zahlen/Unterstriche
          enthalten und keine Leerzeichen.</p>`,
                  en: `<p>A variable stores a value under a name. You write
          <code>name = value</code>, and the value is then in the variable.</p>
          <p>Names must start with a letter and can contain letters, digits and
          underscores. No spaces allowed.</p>` },
          example: { de: 'alter = 12\nname = "Mia"\npunkte = alter * 10',
                     en: 'age = 12\nname = "Mia"\nscore = age * 10' },
          insert: { de: 'name = wert\n', en: 'name = value\n' } } },

        { id: 'basics-int', label: { de: 'Ganze Zahlen (int)', en: 'Integers (int)' },
          content: { kind: 'topic',
          body: { de: `<p>Ganzzahlen – ohne Komma. Mit ihnen rechnest du genau wie auf Papier.</p>`,
                  en: `<p>Whole numbers – no decimal point. You do arithmetic with them just
          like on paper.</p>` },
          example: 'a = 5\nb = -3\nc = a + b\nprint(c)   # 2' } },

        { id: 'basics-float', label: { de: 'Kommazahlen (float)', en: 'Floats (float)' },
          content: { kind: 'topic',
          body: { de: `<p>Zahlen mit Nachkommastellen. Python nutzt einen <b>Punkt</b> als
          Dezimaltrennzeichen, nicht ein Komma.</p>`,
                  en: `<p>Numbers with decimal places. Python uses a <b>dot</b> as the decimal
          separator, not a comma.</p>` },
          example: { de: 'pi = 3.14\nradius = 1.5\nflaeche = pi * radius * radius',
                     en: 'pi = 3.14\nradius = 1.5\narea = pi * radius * radius' } } },

        { id: 'basics-str', label: { de: 'Strings (Texte)', en: 'Strings (text)' },
          content: { kind: 'topic',
          body: { de: `<p>Texte stehen in Anführungszeichen – entweder einfache <code>'…'</code> oder
          doppelte <code>"…"</code>. Mit <code>+</code> kannst du Texte verbinden.
          Eine Zahl wird mit <code>str(zahl)</code> in einen Text umgewandelt.</p>`,
                  en: `<p>Text goes in quotes – either single <code>'…'</code> or double
          <code>"…"</code>. With <code>+</code> you can join strings. Convert a number
          to a string with <code>str(number)</code>.</p>` },
          example: { de: 'name = "Mia"\ngruss = "Hallo " + name\nalter = 12\nprint(name + " ist " + str(alter))',
                     en: 'name = "Mia"\ngreet = "Hello " + name\nage = 12\nprint(name + " is " + str(age))' } } },

        { id: 'basics-str-len', label: { de: 'Länge: len(text)', en: 'Length: len(text)' },
          content: { kind: 'topic',
          body: { de: `<p><code>len(text)</code> gibt die Anzahl der Zeichen eines Textes
          zurück – inklusive Leerzeichen.</p>`,
                  en: `<p><code>len(text)</code> returns the number of characters in a string –
          spaces included.</p>` },
          signature: { de: 'len(text) → Zahl', en: 'len(text) → number' },
          example: { de: 'wort = "Hallo"\nprint(len(wort))      # 5\nprint(len("PBC+ Studio"))  # 11',
                     en: 'word = "Hello"\nprint(len(word))      # 5\nprint(len("PBC+ Studio"))  # 11' } } },

        { id: 'basics-str-index', label: { de: 'Zeichen an Position: text[i]', en: 'Character at position: text[i]' },
          content: { kind: 'topic',
          body: { de: `<p>Mit <code>text[i]</code> holst du ein einzelnes Zeichen. Die
          Zählung beginnt bei <code>0</code>: das erste Zeichen ist <code>text[0]</code>.
          Mit negativem Index zählst du von hinten: <code>text[-1]</code> ist das letzte
          Zeichen.</p>`,
                  en: `<p>Use <code>text[i]</code> to get a single character. Counting starts
          at <code>0</code>: the first character is <code>text[0]</code>. A negative index
          counts from the end: <code>text[-1]</code> is the last character.</p>` },
          signature: { de: 'text[index] → Zeichen', en: 'text[index] → character' },
          example: { de: 'wort = "Hallo"\nprint(wort[0])    # H\nprint(wort[1])    # a\nprint(wort[-1])   # o',
                     en: 'word = "Hello"\nprint(word[0])    # H\nprint(word[1])    # e\nprint(word[-1])   # o' } } },

        { id: 'basics-str-slice', label: { de: 'Teilstück: text[a:b]', en: 'Substring: text[a:b]' },
          content: { kind: 'topic',
          body: { de: `<p><code>text[a:b]</code> schneidet ein Teilstück heraus – ab
          Position <code>a</code> bis <b>vor</b> Position <code>b</code>. Die Stelle
          <code>b</code> gehört also nicht mehr dazu.</p>`,
                  en: `<p><code>text[a:b]</code> cuts out a substring – from position
          <code>a</code> up to but <b>not including</b> position <code>b</code>.</p>` },
          signature: { de: 'text[von:bis] → Text', en: 'text[from:to] → text' },
          example: { de: 'wort = "Programmieren"\nprint(wort[0:4])   # Prog\nprint(wort[4:8])   # ramm',
                     en: 'word = "Programming"\nprint(word[0:4])   # Prog\nprint(word[4:8])   # ramm' } } },

        { id: 'basics-str-case', label: { de: 'GROSS / klein', en: 'UPPER / lower' },
          content: { kind: 'topic',
          body: { de: `<p><code>.upper()</code> macht alle Buchstaben groß,
          <code>.lower()</code> alle klein. Der Text selbst ändert sich nicht – du bekommst
          einen neuen Text zurück.</p>`,
                  en: `<p><code>.upper()</code> makes every letter uppercase, <code>.lower()</code>
          makes them lowercase. The original text is unchanged – you get a new string back.</p>` },
          signature: { de: 'text.upper() / text.lower() → Text', en: 'text.upper() / text.lower() → text' },
          example: { de: 'name = "Mia"\nprint(name.upper())   # MIA\nprint(name.lower())   # mia',
                     en: 'name = "Mia"\nprint(name.upper())   # MIA\nprint(name.lower())   # mia' } } },

        { id: 'basics-str-in', label: { de: 'enthält: teil in text', en: 'contains: part in text' },
          content: { kind: 'topic',
          body: { de: `<p>Mit <code>in</code> prüfst du, ob ein Text einen anderen enthält.
          Das Ergebnis ist <code>True</code> oder <code>False</code> – gut für
          <code>if</code>-Bedingungen.</p>`,
                  en: `<p>With <code>in</code> you check whether one text contains another. The
          result is <code>True</code> or <code>False</code> – handy for <code>if</code>
          conditions.</p>` },
          signature: { de: 'teil in text → True / False', en: 'part in text → True / False' },
          example: { de: 'satz = "Hallo Welt"\nprint("Welt" in satz)   # True\nprint("xyz" in satz)    # False\nif "Hallo" in satz:\n    print("gefunden!")',
                     en: 'line = "Hello World"\nprint("World" in line)  # True\nprint("xyz" in line)    # False\nif "Hello" in line:\n    print("found!")' } } },
      ] },
      { title: { de: 'Rechnen & Vergleichen', en: 'Math & comparison' },
        intro: { kind: 'intro', body: {
          de: `<p>Mit <b>Operatoren</b> kannst du Werte zusammenrechnen oder
          miteinander vergleichen. Drei Gruppen sind besonders wichtig:</p>
          <ul>
            <li><b>Arithmetische Operatoren</b> (<code>+ - * /</code>) rechnen mit Zahlen
              und liefern wieder eine Zahl.</li>
            <li><b>Vergleichs-Operatoren</b> (<code>== != &lt; &gt;</code>) prüfen zwei
              Werte und liefern <code>True</code> oder <code>False</code>. Damit
              entscheidest du in <code>if</code>-Bedingungen.</li>
            <li><b>Logische Operatoren</b> (<code>and</code>, <code>or</code>,
              <code>not</code>) verknüpfen mehrere Wahrheitswerte zu einem.</li>
          </ul>

          <p>Achtung beim Zuweisen und Vergleichen: <code>=</code> weist zu
          (<code>x = 5</code> bedeutet „ab jetzt steht 5 in x"), <code>==</code>
          vergleicht (<code>x == 5</code> bedeutet „ist x gleich 5?").</p>`,
          en: `<p>With <b>operators</b> you can combine values or compare them. Three
          groups matter most:</p>
          <ul>
            <li><b>Arithmetic operators</b> (<code>+ - * /</code>) work on numbers and
              produce a number.</li>
            <li><b>Comparison operators</b> (<code>== != &lt; &gt;</code>) check two
              values and produce <code>True</code> or <code>False</code>. You use them
              inside <code>if</code> conditions.</li>
            <li><b>Logical operators</b> (<code>and</code>, <code>or</code>,
              <code>not</code>) combine several boolean values into one.</li>
          </ul>

          <p>Mind the difference: <code>=</code> is assignment (<code>x = 5</code> means
          "from now on x holds 5"); <code>==</code> is a comparison (<code>x == 5</code>
          asks "is x equal to 5?").</p>`,
        } },
        entries: [
        { id: 'basics-arith', label: { de: '+ − × ÷', en: '+ − × ÷' },
          content: { kind: 'topic',
          body: { de: `<p>Grundrechenarten: <code>+</code> Addition, <code>-</code> Subtraktion,
          <code>*</code> Multiplikation, <code>/</code> Division.</p>
          <p>Achtung: <code>10 / 3</code> gibt <code>3.333…</code> (Kommazahl).
          Wenn du nur den ganzzahligen Teil willst, nimm <code>10 // 3</code> – das
          ergibt <code>3</code>.</p>`,
                  en: `<p>Basic arithmetic: <code>+</code> add, <code>-</code> subtract,
          <code>*</code> multiply, <code>/</code> divide.</p>
          <p>Watch out: <code>10 / 3</code> gives <code>3.333…</code> (a float). If you
          only want the integer part, use <code>10 // 3</code> – that's <code>3</code>.</p>` },
          example: { de: 'a = 7 + 3        # 10\nb = 7 - 3        # 4\nc = 7 * 3        # 21\nd = 7 / 3        # 2.333...\ne = 7 // 3       # 2\nf = 7 % 3        # 1 (Rest)\ng = 2 ** 8       # 256 (Potenz)',
                     en: 'a = 7 + 3        # 10\nb = 7 - 3        # 4\nc = 7 * 3        # 21\nd = 7 / 3        # 2.333...\ne = 7 // 3       # 2\nf = 7 % 3        # 1 (remainder)\ng = 2 ** 8       # 256 (power)' } } },

        { id: 'basics-compare', label: { de: 'Vergleichen', en: 'Comparing' },
          content: { kind: 'topic',
          body: { de: `<p>Vergleichs-Operatoren liefern einen Wahrheitswert: <code>True</code> oder
          <code>False</code>. Achtung: das Gleichheits-Zeichen für Vergleich ist
          <code>==</code> (zwei Gleichheitszeichen). Ein einzelnes <code>=</code> ist eine
          <i>Zuweisung</i>, kein Vergleich.</p>`,
                  en: `<p>Comparison operators yield a boolean: <code>True</code> or
          <code>False</code>. Watch out: the equality test uses <code>==</code> (two
          equals signs). A single <code>=</code> is <i>assignment</i>, not comparison.</p>` },
          example: '5 == 5    # True\n5 != 4    # True\n5 < 10    # True\n5 >= 5    # True' } },

        { id: 'basics-bool', label: { de: 'and / or / not', en: 'and / or / not' },
          content: { kind: 'topic',
          body: { de: `<p>Mit <code>and</code>, <code>or</code> und <code>not</code> verbindest du
          mehrere Wahrheitswerte. <code>and</code> braucht beide Seiten True,
          <code>or</code> reicht eine, <code>not</code> dreht True ↔ False um.</p>`,
                  en: `<p>With <code>and</code>, <code>or</code> and <code>not</code> you combine
          booleans. <code>and</code> needs both sides True, <code>or</code> needs only
          one, <code>not</code> flips True ↔ False.</p>` },
          example: 'x = 5\n(x > 0) and (x < 10)   # True\n(x < 0) or (x > 100)   # False\nnot (x == 5)           # False' } },

        { id: 'basics-random', label: { de: 'Zufall', en: 'Random numbers' },
          content: { kind: 'topic',
          body: { de: `<p>Das Modul <code>random</code> erzeugt Zufallszahlen. Vorher mit
          <code>import random</code> laden.</p>
          <p><code>randint(a, b)</code> gibt eine Zufallszahl von <code>a</code> bis
          <code>b</code> (beide einschließlich). <code>choice(liste)</code> wählt ein
          zufälliges Element aus einer Liste.</p>`,
                  en: `<p>The <code>random</code> module produces random numbers. Load it
          first with <code>import random</code>.</p>
          <p><code>randint(a, b)</code> returns a random integer from <code>a</code> to
          <code>b</code> (both inclusive). <code>choice(list)</code> picks a random
          element from a list.</p>` },
          example: { de: 'import random\n\nwurf = random.randint(1, 6)\nfarbe = random.choice(["rot", "grün", "blau"])',
                     en: 'import random\n\nroll = random.randint(1, 6)\ncolor = random.choice(["red", "green", "blue"])' },
          insert: { de: 'import random\n\nzahl = random.randint(1, 10)\n',
                    en: 'import random\n\nnumber = random.randint(1, 10)\n' } } },

        { id: 'basics-pow', label: { de: 'Potenz: a ** b', en: 'Power: a ** b' },
          content: { kind: 'topic',
          body: { de: `<p>Mit <code>**</code> rechnest du Potenzen: <code>a ** b</code> ist
          „a hoch b". <code>2 ** 3</code> ist also <code>2·2·2 = 8</code>.</p>`,
                  en: `<p><code>**</code> raises to a power: <code>a ** b</code> is "a to the
          power of b". So <code>2 ** 3</code> is <code>2·2·2 = 8</code>.</p>` },
          signature: { de: 'a ** b → Zahl', en: 'a ** b → number' },
          example: { de: 'print(2 ** 3)     # 8\nprint(10 ** 2)    # 100\nflaeche = 5 ** 2  # Quadrat: 25',
                     en: 'print(2 ** 3)     # 8\nprint(10 ** 2)    # 100\narea = 5 ** 2     # square: 25' } } },

        { id: 'basics-sqrt', label: { de: 'Wurzel: math.sqrt(x)', en: 'Square root: math.sqrt(x)' },
          content: { kind: 'topic',
          body: { de: `<p>Die Quadratwurzel steckt im Modul <code>math</code>. Vorher mit
          <code>import math</code> laden. <code>math.sqrt(x)</code> gibt die Wurzel von
          <code>x</code> zurück.</p>`,
                  en: `<p>The square root lives in the <code>math</code> module. Load it first
          with <code>import math</code>. <code>math.sqrt(x)</code> returns the root of
          <code>x</code>.</p>` },
          signature: { de: 'math.sqrt(x) → Zahl', en: 'math.sqrt(x) → number' },
          example: { de: 'import math\n\nprint(math.sqrt(9))    # 3.0\nprint(math.sqrt(2))    # 1.414...',
                     en: 'import math\n\nprint(math.sqrt(9))    # 3.0\nprint(math.sqrt(2))    # 1.414...' },
          insert: { de: 'import math\n', en: 'import math\n' } } },

        { id: 'basics-abs', label: { de: 'Betrag: abs(x)', en: 'Absolute value: abs(x)' },
          content: { kind: 'topic',
          body: { de: `<p><code>abs(x)</code> gibt den Betrag zurück – also den Wert ohne
          Vorzeichen. Aus <code>-7</code> wird <code>7</code>. Praktisch, um Abstände zu
          berechnen.</p>`,
                  en: `<p><code>abs(x)</code> returns the absolute value – the value without
          its sign. <code>-7</code> becomes <code>7</code>. Handy for computing
          distances.</p>` },
          signature: { de: 'abs(x) → Zahl', en: 'abs(x) → number' },
          example: { de: 'print(abs(-7))       # 7\nprint(abs(3))        # 3\nabstand = abs(a - b) # immer positiv',
                     en: 'print(abs(-7))       # 7\nprint(abs(3))        # 3\ndistance = abs(a - b) # always positive' } } },

        { id: 'basics-round', label: { de: 'Runden: round(x)', en: 'Rounding: round(x)' },
          content: { kind: 'topic',
          body: { de: `<p><code>round(x)</code> rundet auf eine ganze Zahl. Mit einem zweiten
          Wert rundest du auf Nachkommastellen: <code>round(x, 1)</code> auf eine Stelle.</p>`,
                  en: `<p><code>round(x)</code> rounds to a whole number. With a second value you
          round to decimal places: <code>round(x, 1)</code> to one decimal.</p>` },
          signature: { de: 'round(x) / round(x, stellen) → Zahl', en: 'round(x) / round(x, places) → number' },
          example: { de: 'print(round(3.7))       # 4\nprint(round(3.14159, 2)) # 3.14',
                     en: 'print(round(3.7))       # 4\nprint(round(3.14159, 2)) # 3.14' } } },

        { id: 'basics-minmax', label: { de: 'Minimum / Maximum', en: 'Minimum / Maximum' },
          content: { kind: 'topic',
          body: { de: `<p><code>min(a, b)</code> gibt den kleineren der beiden Werte zurück,
          <code>max(a, b)</code> den größeren. Praktisch, um z.&nbsp;B. einen Wert in
          Grenzen zu halten.</p>`,
                  en: `<p><code>min(a, b)</code> returns the smaller of two values,
          <code>max(a, b)</code> the larger. Handy for keeping a value within bounds.</p>` },
          signature: { de: 'min(a, b) / max(a, b) → Zahl', en: 'min(a, b) / max(a, b) → number' },
          example: { de: 'print(min(3, 8))   # 3\nprint(max(3, 8))   # 8\n# Wert zwischen 0 und 100 halten:\nx = max(0, min(100, x))',
                     en: 'print(min(3, 8))   # 3\nprint(max(3, 8))   # 8\n# keep a value between 0 and 100:\nx = max(0, min(100, x))' } } },
      ] },
    ],
  },

  // ============================== KONTROLLSTRUKTUREN ===================
  {
    key: 'control', label: 'Kontrollstrukturen', icon: '🔀',
    intro: { kind: 'intro', body: {
      de: `<p>Normalerweise läuft ein Programm <b>von oben nach unten</b>. Mit Kontroll-
      strukturen kannst du diesen Ablauf steuern: bestimmte Zeilen nur unter
      Bedingungen ausführen (<b>Verzweigung</b>), oder einen Block <b>wiederholen</b>.</p>
      <p>In Python werden Blöcke durch <b>Einrückung</b> gekennzeichnet. Was zum
      gleichen Block gehört, beginnt mit der gleichen Anzahl Leerzeichen am
      Zeilenanfang – standardmäßig 4. Die IDE übernimmt das automatisch, wenn du
      nach einem <code>:</code> Enter drückst.</p>`,
      en: `<p>Normally a program runs <b>top to bottom</b>. With control structures
      you can change that flow: run some lines only under a condition
      (<b>branching</b>), or <b>repeat</b> a block.</p>
      <p>In Python, blocks are marked by <b>indentation</b>. Everything in the same
      block starts with the same number of leading spaces – 4 by convention. The
      IDE handles that automatically when you press Enter after a <code>:</code>.</p>`,
    } },
    sections: [
      { title: 'Verzweigungen',
        intro: { kind: 'intro', body: {
          de: `<p>Eine <b>Verzweigung</b> entscheidet während des Programmlaufs, welcher
          Code-Block ausgeführt wird – abhängig davon, ob eine Bedingung wahr oder
          falsch ist.</p>

          <pre><code>if alter >= 18:
    print("Du bist erwachsen.")
else:
    print("Du bist noch jung.")</code></pre>

          <p>Mit <code>if</code> formulierst du die Bedingung. Mit <code>else</code>
          gibst du eine Alternative an, falls die Bedingung nicht erfüllt ist. Wenn du
          mehrere Möglichkeiten hintereinander prüfen willst, hängst du mit
          <code>elif</code> weitere Bedingungen dran.</p>

          <p>Die Bedingungen sind meist Vergleiche (<code>x &gt; 0</code>,
          <code>name == "Mia"</code>) oder logische Verknüpfungen davon mit
          <code>and</code> / <code>or</code>.</p>`,
          en: `<p>A <b>branch</b> decides at runtime which code block to execute –
          depending on whether a condition is true or false.</p>

          <pre><code>if age >= 18:
    print("You are an adult.")
else:
    print("You are still young.")</code></pre>

          <p>With <code>if</code> you state the condition. With <code>else</code> you
          give an alternative for when the condition isn't met. If you want to check
          several possibilities in a row, chain them with <code>elif</code>.</p>

          <p>Conditions are usually comparisons (<code>x &gt; 0</code>,
          <code>name == "Mia"</code>) or logical combinations thereof with
          <code>and</code> / <code>or</code>.</p>`,
        } },
        entries: [
        { id: 'control-if', label: 'if', content: { kind: 'topic',
          body: { de: `<p>Führt einen Block nur aus, wenn die Bedingung wahr ist.</p>`,
                  en: `<p>Runs a block only if the condition is true.</p>` },
          signature: { de: 'if bedingung:\n    anweisung',
                       en: 'if condition:\n    statement' },
          example: { de: 'alter = 14\nif alter >= 12:\n    print("Du darfst rein.")',
                     en: 'age = 14\nif age >= 12:\n    print("You may enter.")' },
          insert: { de: 'if bedingung:\n    \n',
                    en: 'if condition:\n    \n' } } },

        { id: 'control-ifelse', label: 'if / else', content: { kind: 'topic',
          body: { de: `<p>Mit <code>else</code> gibst du einen Alternativ-Block an, der ausgeführt
          wird wenn die Bedingung <i>nicht</i> erfüllt ist.</p>`,
                  en: `<p>With <code>else</code> you give an alternative block that runs if
          the condition is <i>not</i> met.</p>` },
          example: { de: 'punkte = 7\nif punkte > 10:\n    print("Super!")\nelse:\n    print("Weiter üben.")',
                     en: 'score = 7\nif score > 10:\n    print("Great!")\nelse:\n    print("Keep practising.")' },
          insert: { de: 'if bedingung:\n    \nelse:\n    \n',
                    en: 'if condition:\n    \nelse:\n    \n' } } },

        { id: 'control-elif', label: 'elif', content: { kind: 'topic',
          body: { de: `<p>Mit <code>elif</code> (engl. „else if") kannst du mehrere Bedingungen
          hintereinander prüfen. Sobald eine zutrifft, wird ihr Block ausgeführt und der
          Rest übersprungen.</p>`,
                  en: `<p>With <code>elif</code> ("else if") you check several conditions in
          a row. As soon as one matches, its block runs and the rest are skipped.</p>` },
          example: { de: 'note = 2\nif note == 1:\n    print("sehr gut")\nelif note == 2:\n    print("gut")\nelif note == 3:\n    print("befriedigend")\nelse:\n    print("üben!")',
                     en: 'grade = 2\nif grade == 1:\n    print("excellent")\nelif grade == 2:\n    print("good")\nelif grade == 3:\n    print("ok")\nelse:\n    print("practise!")' } } },
      ] },
      { title: 'Wiederholungen',
        intro: { kind: 'intro', body: {
          de: `<p>Mit <b>Schleifen</b> führst du einen Code-Block mehrfach aus. Python
          kennt zwei Hauptformen:</p>
          <ul>
            <li><b>for-Schleife</b>: läuft durch eine Sequenz (eine Liste, eine
              <code>range(…)</code>, ein String). Du weißt zu Beginn wieviele
              Schritte es werden.</li>
            <li><b>while-Schleife</b>: wiederholt, <i>solange</i> eine Bedingung
              wahr ist. Praktisch wenn die Anzahl der Wiederholungen vom Inhalt
              abhängt.</li>
          </ul>

          <p>Mit <code>break</code> springst du sofort aus der Schleife raus, mit
          <code>continue</code> überspringst du den Rest der aktuellen Runde und
          machst mit dem nächsten Durchlauf weiter.</p>

          <p>Schleifen können <b>verschachtelt</b> sein – eine Schleife innerhalb
          einer anderen. Die innere läuft komplett durch für jeden Schritt der
          äußeren.</p>`,
          en: `<p>With <b>loops</b> you run a block several times. Python has two main
          forms:</p>
          <ul>
            <li><b>for loop</b>: runs through a sequence (a list, a <code>range(…)</code>,
              a string). You know up front how many steps there'll be.</li>
            <li><b>while loop</b>: repeats <i>as long as</i> a condition is true. Useful
              when the number of repetitions depends on the data.</li>
          </ul>

          <p>With <code>break</code> you exit the loop immediately, with
          <code>continue</code> you skip the rest of the current iteration and go
          to the next one.</p>

          <p>Loops can be <b>nested</b> – one loop inside another. The inner loop
          runs in full for every step of the outer one.</p>`,
        } },
        entries: [
        { id: 'control-for', label: 'for-Schleife', content: { kind: 'topic',
          body: { de: `<p>Wiederholt einen Block für jedes Element einer Sequenz. Am häufigsten:
          eine bestimmte Anzahl von Wiederholungen mit <code>range(n)</code>.</p>
          <p><code>range(10)</code> liefert die Zahlen 0, 1, 2, …, 9 (also 10 Schritte,
          aber von 0 anfangend).</p>`,
                  en: `<p>Repeats a block for each element of a sequence. Most commonly:
          a fixed number of iterations using <code>range(n)</code>.</p>
          <p><code>range(10)</code> produces the numbers 0, 1, 2, …, 9 (so 10 steps,
          starting from 0).</p>` },
          example: { de: 'for i in range(5):\n    print("Hallo", i)\n\n# Über eine Liste laufen:\nfor name in ["Anna", "Ben", "Cleo"]:\n    print(name)',
                     en: 'for i in range(5):\n    print("Hello", i)\n\n# Iterate over a list:\nfor name in ["Anna", "Ben", "Cleo"]:\n    print(name)' },
          insert: 'for i in range(10):\n    \n' } },

        { id: 'control-while', label: 'while-Schleife', content: { kind: 'topic',
          body: { de: `<p>Wiederholt einen Block, <b>solange</b> eine Bedingung wahr ist.
          Achtung: wenn die Bedingung niemals falsch wird, läuft die Schleife endlos!</p>`,
                  en: `<p>Repeats a block <b>as long as</b> a condition is true.
          Beware: if the condition never becomes false, the loop runs forever!</p>` },
          example: { de: 'punkte = 0\nwhile punkte < 10:\n    punkte = punkte + 1\nprint("Fertig:", punkte)',
                     en: 'score = 0\nwhile score < 10:\n    score = score + 1\nprint("Done:", score)' },
          insert: { de: 'while bedingung:\n    \n',
                    en: 'while condition:\n    \n' } } },

        { id: 'control-break', label: 'break', content: { kind: 'topic',
          body: { de: `<p>Beendet die aktuelle Schleife sofort, auch wenn die Bedingung noch wahr
          wäre. Praktisch zum vorzeitigen Aussteigen, sobald ein gesuchter Wert gefunden
          wurde.</p>`,
                  en: `<p>Exits the current loop immediately, even if the condition would
          still be true. Useful for bailing out as soon as you've found what you
          were looking for.</p>` },
          example: { de: 'for i in range(100):\n    if i * i > 50:\n        print("Erste Zahl mit Quadrat > 50:", i)\n        break',
                     en: 'for i in range(100):\n    if i * i > 50:\n        print("First number with square > 50:", i)\n        break' } } },

        { id: 'control-continue', label: 'continue', content: { kind: 'topic',
          body: { de: `<p>Überspringt den Rest der aktuellen Schleifen-Runde und macht direkt mit
          der nächsten weiter.</p>`,
                  en: `<p>Skips the rest of the current iteration and jumps straight to
          the next one.</p>` },
          example: { de: 'for i in range(10):\n    if i % 2 == 0:\n        continue       # gerade Zahlen überspringen\n    print(i)',
                     en: 'for i in range(10):\n    if i % 2 == 0:\n        continue       # skip even numbers\n    print(i)' } } },

        { id: 'control-nested', label: 'Verschachtelte Schleifen', content: { kind: 'topic',
          body: { de: `<p>Eine Schleife in einer anderen Schleife. Die innere läuft komplett
          durch für jeden einzelnen Schritt der äußeren. Klassisches Beispiel: ein
          Quadrat mit Pixeln zeichnen.</p>`,
                  en: `<p>A loop inside another loop. The inner one runs to completion for
          each step of the outer one. Classic example: drawing a square of pixels.</p>` },
          example: 'for y in range(10):\n    for x in range(10):\n        print(x, y)' } },
      ] },
    ],
  },

  // ============================== LISTEN ===============================
  {
    key: 'data', label: 'Listen', icon: '📦',
    intro: { kind: 'intro', body: {
      de: `<p>Eine <b>Liste</b> (in anderen Sprachen oft <i>Array</i> genannt) ist eine
      geordnete Sammlung von mehreren Werten unter einem einzigen Namen. Praktisch
      wenn du nicht eine einzelne Zahl, sondern viele auf einmal speichern willst.</p>

      <pre><code>punkte = [12, 8, 15, 9]
namen = ["Anna", "Ben", "Cleo"]
gemischt = ["Mia", 7, True]</code></pre>

      <p>Listen werden mit eckigen Klammern <code>[…]</code> geschrieben, die Elemente
      durch Kommas getrennt. Sie können beliebig viele Elemente haben (auch null) und
      unterschiedliche Datentypen mischen.</p>

      <p>Jedes Element hat einen <b>Index</b> – seine Position in der Liste. Das erste
      Element hat Index <code>0</code> (nicht 1!), das zweite <code>1</code>, und so
      weiter.</p>`,
      en: `<p>A <b>list</b> (often called an <i>array</i> in other languages) is an
      ordered collection of multiple values under a single name. Handy when you
      don't want to store just one number but many at once.</p>

      <pre><code>scores = [12, 8, 15, 9]
names = ["Anna", "Ben", "Cleo"]
mixed = ["Mia", 7, True]</code></pre>

      <p>Lists use square brackets <code>[…]</code>, elements separated by commas.
      They can have any number of elements (including none) and can mix different
      types.</p>

      <p>Each element has an <b>index</b> – its position in the list. The first
      element has index <code>0</code> (not 1!), the second <code>1</code>, and so
      on.</p>`,
    } },
    sections: [{ entries: [
      { id: 'data-create', label: 'Liste erzeugen', content: { kind: 'topic',
        body: { de: `<p>Eine Liste schreibst du in eckigen Klammern, Elemente durch Komma
        getrennt. Eine leere Liste ist <code>[]</code>.</p>`,
                en: `<p>You write a list in square brackets, elements separated by commas.
        An empty list is <code>[]</code>.</p>` },
        example: { de: 'leer = []\nzahlen = [1, 2, 3, 4, 5]\nnamen = ["Mia", "Ben"]',
                   en: 'empty = []\nnumbers = [1, 2, 3, 4, 5]\nnames = ["Mia", "Ben"]' },
        insert: { de: 'liste = []\n', en: 'my_list = []\n' } } },

      { id: 'data-index', label: 'Index-Zugriff', content: { kind: 'topic',
        body: { de: `<p>Mit <code>liste[i]</code> kommst du an das Element an Position
        <code>i</code>. Negative Indizes zählen vom Ende: <code>liste[-1]</code> ist das
        letzte Element.</p>`,
                en: `<p>With <code>list[i]</code> you access the element at position
        <code>i</code>. Negative indices count from the end: <code>list[-1]</code> is
        the last element.</p>` },
        example: { de: 'namen = ["Anna", "Ben", "Cleo"]\nprint(namen[0])     # Anna\nprint(namen[2])     # Cleo\nprint(namen[-1])    # Cleo',
                   en: 'names = ["Anna", "Ben", "Cleo"]\nprint(names[0])     # Anna\nprint(names[2])     # Cleo\nprint(names[-1])    # Cleo' } } },

      { id: 'data-modify', label: 'Element ändern', content: { kind: 'topic',
        body: { de: `<p>Du kannst ein Element direkt an seinem Index überschreiben.</p>`,
                en: `<p>You can overwrite an element directly by index.</p>` },
        example: { de: 'punkte = [10, 20, 30]\npunkte[1] = 99\nprint(punkte)   # [10, 99, 30]',
                   en: 'scores = [10, 20, 30]\nscores[1] = 99\nprint(scores)   # [10, 99, 30]' } } },

      { id: 'data-append', label: '.append() – anhängen', content: { kind: 'topic',
        body: { de: `<p>Fügt ein neues Element am <b>Ende</b> der Liste hinzu.</p>`,
                en: `<p>Adds a new element to the <b>end</b> of the list.</p>` },
        example: { de: 'aufgaben = []\naufgaben.append("Hausaufgaben")\naufgaben.append("Zimmer aufräumen")\nprint(aufgaben)',
                   en: 'todos = []\ntodos.append("homework")\ntodos.append("tidy room")\nprint(todos)' } } },

      { id: 'data-remove', label: '.remove() – löschen', content: { kind: 'topic',
        body: { de: `<p>Entfernt das erste Vorkommen eines Werts aus der Liste.</p>`,
                en: `<p>Removes the first occurrence of a value from the list.</p>` },
        example: { de: 'tiere = ["Hund", "Katze", "Maus"]\ntiere.remove("Katze")\nprint(tiere)   # ["Hund", "Maus"]',
                   en: 'animals = ["dog", "cat", "mouse"]\nanimals.remove("cat")\nprint(animals)   # ["dog", "mouse"]' } } },

      { id: 'data-len', label: 'len() – Länge', content: { kind: 'topic',
        body: { de: `<p>Gibt die Anzahl der Elemente in der Liste zurück.</p>`,
                en: `<p>Returns the number of elements in the list.</p>` },
        example: { de: 'namen = ["Anna", "Ben", "Cleo"]\nprint(len(namen))   # 3',
                   en: 'names = ["Anna", "Ben", "Cleo"]\nprint(len(names))   # 3' } } },

      { id: 'data-slice', label: 'Slicing', content: { kind: 'topic',
        body: { de: `<p>Mit <code>liste[start:ende]</code> bekommst du einen <b>Ausschnitt</b>
        der Liste. <code>start</code> ist eingeschlossen, <code>ende</code> ist
        ausgeschlossen.</p>`,
                en: `<p>With <code>list[start:end]</code> you get a <b>slice</b> of the
        list. <code>start</code> is included, <code>end</code> is excluded.</p>` },
        example: { de: 'zahlen = [10, 20, 30, 40, 50]\nprint(zahlen[1:4])   # [20, 30, 40]\nprint(zahlen[:2])    # [10, 20]\nprint(zahlen[3:])    # [40, 50]',
                   en: 'numbers = [10, 20, 30, 40, 50]\nprint(numbers[1:4])   # [20, 30, 40]\nprint(numbers[:2])    # [10, 20]\nprint(numbers[3:])    # [40, 50]' } } },

      { id: 'data-loop', label: 'Mit for durchlaufen', content: { kind: 'topic',
        body: { de: `<p>Die <code>for</code>-Schleife geht jedes Element einer Liste der Reihe
        nach durch.</p>`,
                en: `<p>The <code>for</code> loop visits each element of a list in
        order.</p>` },
        example: { de: 'tiere = ["Hund", "Katze", "Maus"]\nfor tier in tiere:\n    print("Ich mag:", tier)',
                   en: 'animals = ["dog", "cat", "mouse"]\nfor a in animals:\n    print("I like:", a)' },
        insert: { de: 'for element in liste:\n    \n',
                  en: 'for element in my_list:\n    \n' } } },

      { id: 'data-strings', label: 'Strings sind auch Sequenzen', content: { kind: 'topic',
        body: { de: `<p>Auch Texte (Strings) lassen sich wie Listen behandeln: jeder Buchstabe
        hat einen Index, und du kannst mit <code>for</code> über die Buchstaben laufen.</p>`,
                en: `<p>Text (strings) behave like lists too: each character has an index
        and you can iterate over the characters with <code>for</code>.</p>` },
        example: { de: 'wort = "Hallo"\nprint(wort[0])   # H\nprint(len(wort)) # 5\nfor zeichen in wort:\n    print(zeichen)',
                   en: 'word = "Hello"\nprint(word[0])   # H\nprint(len(word)) # 5\nfor ch in word:\n    print(ch)' } } },
    ] }],
  },

  // ============================== METHODEN =============================
  {
    key: 'methods', label: 'Funktionen', icon: '🛠️',
    intro: { kind: 'intro', body: {
      de: `<p>Eine <b>Funktion</b> ist ein benannter Codeblock, den du immer wieder
      aufrufen kannst. Statt den gleichen Code an zehn Stellen zu kopieren, schreibst
      du ihn einmal als Funktion und rufst ihn wo immer du ihn brauchst.</p>

      <p>Eigene Funktionen helfen dir, deinen Code lesbar zu halten – ein guter Name
      sagt schon was passiert. Statt zwanzig Zeilen am Stück steht in deinem
      Hauptprogramm dann nur <code>zeichne_gegner()</code> – und das ist viel
      leichter zu verstehen.</p>

      <p>Funktionen können <b>Parameter</b> entgegennehmen (Werte, mit denen sie
      arbeiten) und einen <b>Rückgabewert</b> liefern (ein Ergebnis, das die Funktion
      zurückgibt).</p>`,
      en: `<p>A <b>function</b> is a named block of code you can call again and
      again. Instead of copying the same code in ten places, you write it once as a
      function and call it wherever you need it.</p>

      <p>Your own functions help keep code readable – a good name already says what's
      happening. Instead of twenty lines in a row, your main program just says
      <code>draw_enemy()</code> – much easier to understand.</p>

      <p>Functions can take <b>parameters</b> (values to work with) and produce a
      <b>return value</b> (a result the function gives back).</p>`,
    } },
    sections: [{ entries: [
      { id: 'methods-def', label: 'def – Funktion definieren', content: { kind: 'topic',
        body: { de: `<p>Mit <code>def name():</code> definierst du eine neue Funktion. Der Block
        darunter ist ihr Inhalt. Die Funktion wird beim Definieren <b>noch nicht ausgeführt</b>
        – sie wartet, bis du sie aufrufst.</p>`,
                en: `<p>With <code>def name():</code> you define a new function. The block
        below is its body. The function is <b>not yet executed</b> when defined – it
        waits until you call it.</p>` },
        example: { de: 'def begruessen():\n    print("Hallo!")\n    print("Schön dich zu sehen.")\n\n# Aufruf:\nbegruessen()\nbegruessen()',
                   en: 'def greet():\n    print("Hello!")\n    print("Good to see you.")\n\n# Call:\ngreet()\ngreet()' },
        insert: { de: 'def funktionsname():\n    \n',
                  en: 'def function_name():\n    \n' } } },

      { id: 'methods-params', label: 'Parameter', content: { kind: 'topic',
        body: { de: `<p>Eine Funktion kann Werte entgegennehmen. Die Werte schreibst du in die
        Klammern beim Aufruf, und in der Funktionen-Definition gibst du ihnen Namen.</p>`,
                en: `<p>A function can take values. You write the values in the brackets
        when calling, and in the function definition you give them names.</p>` },
        example: { de: 'def begruessen(name):\n    print("Hallo " + name + "!")\n\nbegruessen("Mia")\nbegruessen("Ben")',
                   en: 'def greet(name):\n    print("Hello " + name + "!")\n\ngreet("Mia")\ngreet("Ben")' },
        insert: { de: 'def funktionsname(parameter):\n    \n',
                  en: 'def function_name(parameter):\n    \n' } } },

      { id: 'methods-return', label: 'return – Wert zurückgeben', content: { kind: 'topic',
        body: { de: `<p>Mit <code>return</code> liefert eine Funktion ein Ergebnis zurück.
        Den Wert kannst du dann in einer Variable speichern oder direkt weiterverwenden.</p>`,
                en: `<p>With <code>return</code> a function produces a result. You can store
        that value in a variable or use it directly.</p>` },
        example: { de: 'def quadrat(zahl):\n    return zahl * zahl\n\nergebnis = quadrat(5)\nprint(ergebnis)         # 25\nprint(quadrat(10) + 1)  # 101',
                   en: 'def square(n):\n    return n * n\n\nresult = square(5)\nprint(result)           # 25\nprint(square(10) + 1)   # 101' } } },

      { id: 'methods-multi', label: 'Mehrere Parameter', content: { kind: 'topic',
        body: { de: `<p>Eine Funktion kann beliebig viele Parameter haben, durch Komma getrennt.</p>`,
                en: `<p>A function can take any number of parameters, separated by commas.</p>` },
        example: { de: 'def addiere(a, b):\n    return a + b\n\nprint(addiere(3, 4))   # 7',
                   en: 'def add(a, b):\n    return a + b\n\nprint(add(3, 4))   # 7' } } },

      { id: 'methods-call', label: 'Funktion aus Funktion aufrufen', content: { kind: 'topic',
        body: { de: `<p>Innerhalb einer Funktion kannst du andere Funktionen aufrufen. So baust
        du dein Programm aus kleinen, wiederverwendbaren Bausteinen auf.</p>`,
                en: `<p>Inside a function you can call other functions. This lets you build
        your program from small, reusable building blocks.</p>` },
        example: { de: 'def quadrat(x):\n    return x * x\n\ndef summe_der_quadrate(a, b):\n    return quadrat(a) + quadrat(b)\n\nprint(summe_der_quadrate(3, 4))   # 9 + 16 = 25',
                   en: 'def square(x):\n    return x * x\n\ndef sum_of_squares(a, b):\n    return square(a) + square(b)\n\nprint(sum_of_squares(3, 4))   # 9 + 16 = 25' } } },
    ] }],
  },

  // ============================== ZEIT ==================================
  {
    key: 'time', label: 'Zeit', icon: '⏱️',
    intro: { kind: 'intro', body: {
      de: `<p>Manchmal soll dein Programm <b>warten</b>, bevor es weitermacht – etwa zwischen
      zwei Animations-Frames, oder um einem Schüler Zeit zum Lesen zu geben. Manchmal
      willst du <b>messen</b>, wieviel Zeit vergangen ist – für Stoppuhren oder
      Bestzeiten.</p>
      <p>Beides erledigt das Standard-Modul <code>time</code>. Du lädst es einmal mit
      <code>import time</code> am Anfang deines Programms.</p>`,
      en: `<p>Sometimes your program needs to <b>wait</b> before going on – between two
      animation frames, or to give a student time to read. Sometimes you want to
      <b>measure</b> how much time has passed – for stopwatches or best times.</p>
      <p>The standard module <code>time</code> handles both. Load it once with
      <code>import time</code> at the top of your program.</p>`,
    } },
    sections: [{ entries: [
      { id: 'time-import', label: 'import time', content: { kind: 'topic',
        body: { de: `<p>Lädt das Zeit-Modul. Muss vor der ersten Verwendung einmal in deiner
        Datei stehen, üblicherweise ganz oben bei den anderen Imports.</p>`,
                en: `<p>Loads the time module. Must appear once in your file before first
        use, usually at the top with the other imports.</p>` },
        example: { de: 'import time\n\nprint("Start")\ntime.sleep(2)\nprint("Zwei Sekunden später")',
                   en: 'import time\n\nprint("Start")\ntime.sleep(2)\nprint("Two seconds later")' },
        insert: 'import time\n' } },

      { id: 'time-sleep', label: 'time.sleep(s)', content: { kind: 'topic',
        body: { de: `<p>Pausiert das Programm für <code>s</code> Sekunden. Kann auch eine
        Kommazahl sein: <code>time.sleep(0.5)</code> wartet eine halbe Sekunde.</p>`,
                en: `<p>Pauses the program for <code>s</code> seconds. Can be a float:
        <code>time.sleep(0.5)</code> waits half a second.</p>` },
        signature: { de: 'time.sleep(sekunden)', en: 'time.sleep(seconds)' },
        example: 'import time\nfor i in range(3):\n    print(i)\n    time.sleep(1)' } },

      { id: 'time-sleep_ms', label: 'time.sleep_ms(ms)', content: { kind: 'topic',
        body: { de: `<p>Pausiert in <b>Millisekunden</b> (1/1000 Sekunde). Praktisch für kurze
        Pausen in Animationen – <code>time.sleep_ms(50)</code> ergibt etwa 20 Frames pro
        Sekunde.</p>`,
                en: `<p>Pauses in <b>milliseconds</b> (1/1000 second). Handy for short
        pauses in animations – <code>time.sleep_ms(50)</code> gives about 20 frames
        per second.</p>` },
        signature: { de: 'time.sleep_ms(millisekunden)', en: 'time.sleep_ms(milliseconds)' },
        example: 'import time\nfor x in range(240):\n    pbc.clear()\n    pbc.fill_rect(x, 100, 20, 20, pbc.RED)\n    time.sleep_ms(20)' } },

      { id: 'time-ticks', label: 'time.ticks_ms()', content: { kind: 'topic',
        body: { de: `<p>Gibt die Anzahl der Millisekunden seit Programmstart zurück. Praktisch
        für Stoppuhren oder um zu messen, wie lange etwas dauert.</p>`,
                en: `<p>Returns the number of milliseconds since the program started. Handy
        for stopwatches or to measure how long something takes.</p>` },
        signature: 'time.ticks_ms() → int',
        example: { de: 'import time\n\nstart = time.ticks_ms()\n# ... irgendwas tun ...\nfor i in range(10000):\n    pass\nende = time.ticks_ms()\nprint("Hat", ende - start, "ms gedauert")',
                   en: 'import time\n\nstart = time.ticks_ms()\n# ... do something ...\nfor i in range(10000):\n    pass\nend = time.ticks_ms()\nprint("Took", end - start, "ms")' } } },

      { id: 'time-ticks-diff', label: 'time.ticks_diff(…)', content: { kind: 'topic',
        body: { de: `<p>Berechnet die vergangene Zeit zwischen zwei <code>ticks_ms()</code>-Messungen:
        <code>time.ticks_diff(jetzt, start)</code> gibt die Millisekunden dazwischen zurück.
        Das ist die <b>richtige</b> Art, eine Dauer zu messen – ein einfaches
        <code>jetzt - start</code> kann sich verrechnen, wenn der Zähler überläuft.</p>
        <p>Typisches Muster: einmal die Startzeit merken, dann in einer Schleife
        prüfen, ob genug Zeit vergangen ist (Stoppuhr, Timeout, „alle 2 Sekunden").</p>`,
                en: `<p>Computes the elapsed time between two <code>ticks_ms()</code> readings:
        <code>time.ticks_diff(now, start)</code> returns the milliseconds in between. This is
        the <b>correct</b> way to measure a duration – a plain <code>now - start</code> can
        miscalculate when the counter wraps around.</p>
        <p>Typical pattern: remember the start time once, then check inside a loop whether
        enough time has passed (stopwatch, timeout, "every 2 seconds").</p>` },
        signature: { de: 'time.ticks_diff(jetzt, start) → ms', en: 'time.ticks_diff(now, start) → ms' },
        example: { de: 'import time\n\nstart = time.ticks_ms()\nwhile True:\n    vergangen = time.ticks_diff(time.ticks_ms(), start)\n    if vergangen > 2000:   # 2 Sekunden\n        print("Zeit ist um!")\n        break',
                   en: 'import time\n\nstart = time.ticks_ms()\nwhile True:\n    elapsed = time.ticks_diff(time.ticks_ms(), start)\n    if elapsed > 2000:   # 2 seconds\n        print("Time is up!")\n        break' } } },
    ] }],
  },

  // ============================== DATEIEN ===============================
  {
    key: 'files', label: 'Dateien', icon: '💾',
    intro: { kind: 'intro', body: {
      de: `<p>Mit Python kannst du Dateien auf dem Speicher des Geräts lesen und
      schreiben – das funktioniert auf einem PC genauso wie auf dem PBC+. Praktisch
      für <b>Highscores</b>, <b>Konfigurationen</b>, oder einfach um Daten zwischen
      Programmstarts zu behalten.</p>
      <p>Auf dem PBC+ landen die Dateien im internen Flash-Speicher. Jede
      Schreiboperation belastet ihn ein wenig – wenn du jede Sekunde speicherst,
      lieber zwischenspeichern und nur am Ende schreiben.</p>`,
      en: `<p>With Python you can read and write files on the device's storage – this
      works the same on a PC as on the PBC+. Useful for <b>high scores</b>,
      <b>configurations</b>, or simply to keep data across program runs.</p>
      <p>On the PBC+, files live in the internal flash memory. Each write wears it
      out a little – if you save every second, better cache in memory and only
      write at the end.</p>`,
    } },
    sections: [{ entries: [
      { id: 'files-listdir', label: 'os.listdir()', content: { kind: 'topic',
        body: { de: `<p>Zeigt eine Liste aller Dateien im aktuellen Verzeichnis. Vor der
        ersten Verwendung <code>import os</code>.</p>`,
                en: `<p>Returns a list of all files in the current directory. Add
        <code>import os</code> before first use.</p>` },
        signature: { de: "os.listdir('/') → liste", en: "os.listdir('/') → list" },
        example: "import os\nfor name in os.listdir('/'):\n    print(name)",
        insert: "import os\nfor name in os.listdir('/'):\n    print(name)\n" } },

      { id: 'files-write', label: "open(...,'w') – schreiben", content: { kind: 'topic',
        body: { de: `<p>Öffnet eine Datei zum <b>Schreiben</b>. Achtung: bestehender Inhalt
        wird überschrieben. Mit <code>with</code> wird die Datei automatisch wieder
        geschlossen, auch wenn etwas schiefgeht.</p>
        <p>Für mehrere Zeilen rufst du <code>f.write(...)</code> einfach mehrfach
        auf – jede Zeile muss am Ende ein <code>\\n</code> haben, sonst landet alles
        in einer einzigen langen Zeile. Mit <code>f.writelines(liste)</code> kannst
        du auch eine Liste von Strings in einem Rutsch schreiben.</p>
        <p>Statt <code>'w'</code> kannst du auch <code>'a'</code> nutzen
        („append") – damit wird an die Datei <b>angehängt</b>, anstatt sie zu
        überschreiben.</p>`,
                en: `<p>Opens a file for <b>writing</b>. Watch out: existing content is
        overwritten. <code>with</code> auto-closes the file when done, even if
        something goes wrong.</p>
        <p>For several lines, just call <code>f.write(...)</code> several times –
        each line needs a <code>\\n</code> at the end, otherwise everything ends
        up on one long line. With <code>f.writelines(list)</code> you can write
        a list of strings in one go.</p>
        <p>Instead of <code>'w'</code> you can use <code>'a'</code>
        ("append") – this <b>appends</b> to the file instead of overwriting it.</p>` },
        example: { de: "# Eine Zeile schreiben\nwith open('highscore.txt', 'w') as f:\n    f.write(str(punkte))\n\n# Mehrere Zeilen schreiben\nnamen = [\"Anna\", \"Ben\", \"Cleo\"]\nwith open('namen.txt', 'w') as f:\n    for name in namen:\n        f.write(name + \"\\n\")\n\n# An eine Datei anhängen (nicht überschreiben)\nwith open('logbuch.txt', 'a') as f:\n    f.write(\"Neuer Eintrag\\n\")",
                   en: "# Write a single line\nwith open('highscore.txt', 'w') as f:\n    f.write(str(score))\n\n# Write multiple lines\nnames = [\"Anna\", \"Ben\", \"Cleo\"]\nwith open('names.txt', 'w') as f:\n    for name in names:\n        f.write(name + \"\\n\")\n\n# Append to a file (don't overwrite)\nwith open('logbook.txt', 'a') as f:\n    f.write(\"New entry\\n\")" },
        insert: { de: "with open('datei.txt', 'w') as f:\n    f.write('...')\n",
                  en: "with open('file.txt', 'w') as f:\n    f.write('...')\n" } } },

      { id: 'files-read', label: "open(...,'r') – lesen", content: { kind: 'topic',
        body: { de: `<p>Öffnet eine Datei zum <b>Lesen</b>. <code>f.read()</code> liest die
        ganze Datei als einen einzigen String. Für zeilenweises Lesen ist <code>for
        zeile in f</code> die bequemste Form – Python gibt dir die Datei Zeile für
        Zeile, ohne dass du alles auf einmal in den Speicher laden musst.</p>
        <p>Achtung: jede Zeile endet mit einem <code>\\n</code>-Zeichen. Mit
        <code>zeile.strip()</code> entfernst du es (und sonstige Leerräume).</p>`,
                en: `<p>Opens a file for <b>reading</b>. <code>f.read()</code> reads the
        whole file as one string. For line-by-line reading, <code>for line in f</code>
        is the most convenient form – Python hands you the file one line at a time
        without loading everything into memory at once.</p>
        <p>Watch out: each line ends with a <code>\\n</code> character. Use
        <code>line.strip()</code> to remove it (and other whitespace).</p>` },
        example: { de: "# Ganze Datei einlesen\nwith open('highscore.txt', 'r') as f:\n    text = f.read()\nbestzeit = int(text)\n\n# Mehrere Zeilen einlesen\nwith open('namen.txt', 'r') as f:\n    for zeile in f:\n        name = zeile.strip()\n        print(\"Hallo\", name)",
                   en: "# Read whole file\nwith open('highscore.txt', 'r') as f:\n    text = f.read()\nbest = int(text)\n\n# Read multiple lines\nwith open('names.txt', 'r') as f:\n    for line in f:\n        name = line.strip()\n        print(\"Hello\", name)" },
        insert: { de: "with open('datei.txt', 'r') as f:\n    for zeile in f:\n        zeile = zeile.strip()\n        \n",
                  en: "with open('file.txt', 'r') as f:\n    for line in f:\n        line = line.strip()\n        \n" } } },

      { id: 'files-readlines', label: { de: 'Zeile für Zeile lesen', en: 'Reading line by line' }, content: { kind: 'topic',
        body: { de: `<p>Statt die ganze Datei mit <code>f.read()</code> auf einmal zu lesen,
        kannst du mit <code>for zeile in f:</code> jede Zeile einzeln durchgehen. Das
        spart Speicher bei großen Dateien und ist meistens auch praktischer.</p>
        <p>Jede Zeile enthält das Zeilenumbruch-Zeichen <code>\\n</code> am Ende –
        mit <code>.strip()</code> wirst du es los.</p>`,
                en: `<p>Instead of reading the whole file at once with <code>f.read()</code>,
        you can iterate over each line with <code>for line in f:</code>. This saves
        memory for big files and is usually more convenient too.</p>
        <p>Each line still contains the newline character <code>\\n</code> at the end –
        use <code>.strip()</code> to remove it.</p>` },
        example: { de: "# Eine Datei mit Namen, eine pro Zeile\nwith open('namen.txt', 'r') as f:\n    for zeile in f:\n        name = zeile.strip()\n        print(\"Hallo,\", name)",
                   en: "# A file with names, one per line\nwith open('names.txt', 'r') as f:\n    for line in f:\n        name = line.strip()\n        print(\"Hello,\", name)" },
        insert: { de: "with open('datei.txt', 'r') as f:\n    for zeile in f:\n        zeile = zeile.strip()\n        \n",
                  en: "with open('file.txt', 'r') as f:\n    for line in f:\n        line = line.strip()\n        \n" } } },

      { id: 'files-with', label: 'with-Block', content: { kind: 'topic',
        body: { de: `<p>Der <code>with</code>-Block sorgt dafür, dass die Datei automatisch
        geschlossen wird, sobald der Block endet. Ohne <code>with</code> müsstest du
        <code>f.close()</code> selbst aufrufen – und wenn dazwischen ein Fehler passiert,
        wird die Datei nie geschlossen.</p>`,
                en: `<p>The <code>with</code> block makes sure the file is closed
        automatically as soon as the block ends. Without <code>with</code> you'd have
        to call <code>f.close()</code> yourself – and if an error happens in between,
        the file would never be closed.</p>` },
        example: { de: "# Empfohlen:\nwith open('daten.txt', 'r') as f:\n    inhalt = f.read()\n\n# Funktioniert auch, aber riskanter:\nf = open('daten.txt', 'r')\ninhalt = f.read()\nf.close()",
                   en: "# Recommended:\nwith open('data.txt', 'r') as f:\n    content = f.read()\n\n# Also works, but riskier:\nf = open('data.txt', 'r')\ncontent = f.read()\nf.close()" } } },
    ] }],
  },

  // ============================== PBC+ DISPLAY ==========================
  {
    key: 'display', label: 'PBC+ Display', icon: '🎨',
    sections: [
      { title: 'Direkt zeichnen',
        intro: { kind: 'intro', body: {
          de: `<p>Das Display des PBC+ ist <b>240 Pixel breit und 280 Pixel hoch</b>. Die
          obere linke Ecke hat die Koordinaten <code>(0, 0)</code>. X wächst nach rechts,
          Y wächst nach unten.</p>

          <p>Es gibt zwei Wege, etwas auf den Bildschirm zu bringen:</p>
          <ul>
            <li><b>Direkt zeichnen</b>: Du rufst <code>pbc.fill</code>, <code>pbc.pixel</code>
              usw. auf, und die Zeichnung erscheint sofort am Display.</li>
            <li><b>Auf eine Canvas zeichnen</b>: Du bereitest dein Bild im Speicher vor und
              zeigst es mit einem einzigen <code>pbc.show()</code> komplett an. Das
              verhindert Flackern bei Animationen.</li>
          </ul>

          <p>Für einfache Programme reicht direktes Zeichnen. Sobald du Animationen oder
          schnelle Bewegungen hast, lohnt sich die Canvas.</p>`,
          en: `<p>The PBC+ display is <b>240 pixels wide and 280 pixels tall</b>. The
          top-left corner is at coordinates <code>(0, 0)</code>. X grows to the right,
          Y grows downwards.</p>

          <p>There are two ways to put something on the screen:</p>
          <ul>
            <li><b>Drawing directly</b>: you call <code>pbc.fill</code>, <code>pbc.pixel</code>
              etc., and the drawing appears on the display immediately.</li>
            <li><b>Drawing on a canvas</b>: you build your image in memory and then show
              it all at once with a single <code>pbc.show()</code>. This avoids flicker
              in animations.</li>
          </ul>

          <p>For simple programs, direct drawing is fine. Once you have animations or
          fast movement, the canvas approach pays off.</p>`,
        } },
        entries: [
        { id: 'display-fill', label: 'pbc.fill(farbe)', content: { kind: 'topic',
          body: { de: `<p>Füllt den gesamten Bildschirm mit einer Farbe.</p>`,
                  en: `<p>Fills the whole screen with one color.</p>` },
          signature: { de: 'pbc.fill(farbe)', en: 'pbc.fill(color)' },
          example: 'pbc.fill(pbc.BLUE)',
          insert: 'pbc.fill(pbc.WHITE)\n' } },

        { id: 'display-clear', label: 'pbc.clear()', content: { kind: 'topic',
          body: { de: `<p>Löscht den Bildschirm (schwarz). Kurzform für <code>pbc.fill(pbc.BLACK)</code>.</p>`,
                  en: `<p>Clears the screen (black). Shortcut for <code>pbc.fill(pbc.BLACK)</code>.</p>` },
          signature: 'pbc.clear()',
          example: 'pbc.clear()',
          insert: 'pbc.clear()\n' } },

        { id: 'display-pixel', label: 'pbc.pixel(x, y, farbe)', content: { kind: 'topic',
          body: { de: `<p>Setzt einen einzelnen Punkt an Position (x, y).</p>`,
                  en: `<p>Sets a single pixel at position (x, y).</p>` },
          signature: { de: 'pbc.pixel(x, y, farbe)', en: 'pbc.pixel(x, y, color)' },
          example: 'pbc.pixel(120, 140, pbc.RED)',
          insert: 'pbc.pixel(x, y, pbc.WHITE)\n' } },

        { id: 'display-line', label: 'pbc.line(...)', content: { kind: 'topic',
          body: { de: `<p>Zeichnet eine gerade Linie von (x1, y1) nach (x2, y2).</p>`,
                  en: `<p>Draws a straight line from (x1, y1) to (x2, y2).</p>` },
          signature: { de: 'pbc.line(x1, y1, x2, y2, farbe)',
                       en: 'pbc.line(x1, y1, x2, y2, color)' },
          example: 'pbc.line(0, 0, 240, 280, pbc.GREEN)',
          insert: 'pbc.line(x1, y1, x2, y2, pbc.WHITE)\n' } },

        { id: 'display-rect', label: 'pbc.rect / fill_rect', content: { kind: 'topic',
          body: { de: `<p>Zeichnet ein Rechteck. <code>rect</code> nur den Rand, <code>fill_rect</code>
          gefüllt (gleichwertig: <code>pbc.rect(…, fill=True)</code>). Position (x, y) ist die
          obere linke Ecke.</p>`,
                  en: `<p>Draws a rectangle. <code>rect</code> draws only the outline,
          <code>fill_rect</code> draws it filled. Position (x, y) is the top-left
          corner.</p>` },
          signature: { de: 'pbc.rect(x, y, breite, höhe, farbe)\npbc.fill_rect(x, y, breite, höhe, farbe)',
                       en: 'pbc.rect(x, y, width, height, color)\npbc.fill_rect(x, y, width, height, color)' },
          example: 'pbc.rect(20, 20, 100, 60, pbc.WHITE)\npbc.fill_rect(40, 40, 60, 20, pbc.RED)',
          insert: { de: 'pbc.fill_rect(x, y, breite, höhe, pbc.WHITE)\n',
                    en: 'pbc.fill_rect(x, y, width, height, pbc.WHITE)\n' } } },

        { id: 'display-ellipse', label: 'pbc.ellipse(…, fill)', content: { kind: 'topic',
          body: { de: `<p>Zeichnet eine Ellipse (Kreis, wenn rx == ry). Mittelpunkt bei (x, y),
          Radius rx in x-Richtung, ry in y-Richtung. Mit <code>fill=True</code> wird sie
          gefüllt.</p>`,
                  en: `<p>Draws an ellipse (circle when rx == ry). Centre at (x, y), with
          radius rx in the x-direction and ry in the y-direction. With
          <code>fill=True</code> it is filled.</p>` },
          signature: { de: 'pbc.ellipse(x, y, rx, ry, farbe)\npbc.ellipse(x, y, rx, ry, farbe, fill=True)',
                       en: 'pbc.ellipse(x, y, rx, ry, color)\npbc.ellipse(x, y, rx, ry, color, fill=True)' },
          example: { de: 'pbc.ellipse(120, 140, 40, 40, pbc.YELLOW, fill=True)   # Kreis',
                     en: 'pbc.ellipse(120, 140, 40, 40, pbc.YELLOW, fill=True)   # circle' },
          insert: 'pbc.ellipse(x, y, rx, ry, pbc.WHITE, fill=True)\n' } },

        { id: 'display-poly', label: { de: 'Vielecke (poly)', en: 'Polygons (poly)' },
          content: { kind: 'topic',
          body: { de: `<p>Zeichnet ein Vieleck (Polygon) aus mehreren Eckpunkten.
          Die Punkte werden als <code>array.array("h", [...])</code> übergeben –
          immer paarweise x, y, und zwar als <b>Abstand</b> zum Startpunkt
          (ox, oy). Mit <code>fill=True</code> wird das Vieleck ausgefüllt,
          ohne nur der Umriss. Du brauchst dafür <code>import array</code>
          oben im Programm.</p>`,
                  en: `<p>Draws a polygon from several corner points. The points
          are given as <code>array.array("h", [...])</code> – always in x, y
          pairs, measured as an <b>offset</b> from the start point (ox, oy).
          With <code>fill=True</code> the polygon is filled, otherwise just the
          outline is drawn. You need <code>import array</code> at the top of
          your program.</p>` },
          signature: { de: 'pbc.poly(ox, oy, punkte, farbe, fill=False)',
                       en: 'pbc.poly(ox, oy, points, color, fill=False)' },
          example: { de: 'import array\n\npbc.clear()\n# Dreieck bei (120,40), gefüllt\ndreieck = array.array("h", [0,0, 50,0, 25,40])\npbc.poly(120, 40, dreieck, pbc.YELLOW, True)',
                     en: 'import array\n\npbc.clear()\n# triangle at (120,40), filled\ntriangle = array.array("h", [0,0, 50,0, 25,40])\npbc.poly(120, 40, triangle, pbc.YELLOW, True)' },
          insert: { de: 'import array\npunkte = array.array("h", [0,0, 50,0, 25,40])\npbc.poly(x, y, punkte, pbc.WHITE, False)\n',
                    en: 'import array\npoints = array.array("h", [0,0, 50,0, 25,40])\npbc.poly(x, y, points, pbc.WHITE, False)\n' } } },

        { id: 'display-text', label: { de: 'Proportionalschrift (text12 / 18 / 24)', en: 'Proportional font (text12 / 18 / 24)' },
          content: { kind: 'topic',
          body: { de: `<p>Schreibt einen Text an Position (x, y) in der angegebenen Farbe.
          Es ist eine <b>Proportionalschrift</b> – jeder Buchstabe ist nur so breit,
          wie er sein muss – in drei Größen:</p>
          <ul>
            <li><code>pbc.text12(...)</code> – 12 Pixel hoch. Im Blockmodus: <i>kleiner Text</i>.</li>
            <li><code>pbc.text18(...)</code> – 1,5-mal so groß. Im Blockmodus: <i>Text</i>.</li>
            <li><code>pbc.text24(...)</code> – doppelt so groß. Im Blockmodus: <i>großer Text</i>.</li>
          </ul>
          <p>Alle drei haben dieselben Argumente: Text, x, y, Farbe. Die größeren
          eignen sich gut für Überschriften, Punktestände oder große Zahlen.</p>`,
                  en: `<p>Writes text at position (x, y) in the given color. It is a
          <b>proportional font</b> – each letter is only as wide as it needs to be –
          in three sizes:</p>
          <ul>
            <li><code>pbc.text12(...)</code> – 12 pixels tall. Block mode: <i>small text</i>.</li>
            <li><code>pbc.text18(...)</code> – 1.5× the size. Block mode: <i>Text</i>.</li>
            <li><code>pbc.text24(...)</code> – double the size. Block mode: <i>big text</i>.</li>
          </ul>
          <p>All three take the same arguments: text, x, y, color. The larger ones are
          great for headings, scores or big numbers.</p>` },
          signature: { de: 'pbc.text12(text, x, y, farbe)  ·  text18(...)  ·  text24(...)',
                       en: 'pbc.text12(text, x, y, color)  ·  text18(...)  ·  text24(...)' },
          example: { de: 'pbc.text12("klein", 20, 40, pbc.WHITE)\npbc.text18("Text", 20, 80, pbc.CYAN)\npbc.text24("GROSS", 20, 130, pbc.YELLOW)',
                     en: 'pbc.text12("small", 20, 40, pbc.WHITE)\npbc.text18("Text", 20, 80, pbc.CYAN)\npbc.text24("BIG", 20, 130, pbc.YELLOW)' },
          insert: { de: 'pbc.text12("Hallo", x, y, pbc.WHITE)\n',
                    en: 'pbc.text12("Hello", x, y, pbc.WHITE)\n' } } },

        { id: 'display-text-mono', label: { de: 'Monospace-Schrift (text)', en: 'Monospace font (text)' },
          content: { kind: 'topic',
          body: { de: `<p>Neben der Proportionalschrift gibt es eine <b>Monospace-Schrift</b>:
          <code>pbc.text(...)</code>. Hier ist jeder Buchstabe gleich breit (8 Pixel),
          deshalb stehen Zeichen genau untereinander – praktisch für Tabellen,
          ausgerichtete Zahlenkolonnen oder einfache Textgitter. Sie hat keine
          Größenstufen und kein Hintergrund-Argument.</p>`,
                  en: `<p>Besides the proportional font there is a <b>monospace font</b>:
          <code>pbc.text(...)</code>. Every character is the same width (8 pixels),
          so characters line up exactly underneath each other – handy for tables,
          aligned columns of numbers or simple text grids. It has no size variants
          and no background argument.</p>` },
          signature: { de: 'pbc.text(text, x, y, farbe)', en: 'pbc.text(text, x, y, color)' },
          example: { de: 'pbc.clear()\npbc.text("12  345", 20, 40, pbc.WHITE)\npbc.text("987   6", 20, 52, pbc.WHITE)',
                     en: 'pbc.clear()\npbc.text("12  345", 20, 40, pbc.WHITE)\npbc.text("987   6", 20, 52, pbc.WHITE)' },
          insert: { de: 'pbc.text("Hallo", x, y, pbc.WHITE)\n',
                    en: 'pbc.text("Hello", x, y, pbc.WHITE)\n' } } },

        { id: 'display-colors', label: 'Farben', content: { kind: 'topic',
          body: { de: `<p>Fertige Farben: <code>pbc.BLACK</code>, <code>pbc.WHITE</code>,
          <code>pbc.RED</code>, <code>pbc.GREEN</code>, <code>pbc.BLUE</code>,
          <code>pbc.YELLOW</code>, <code>pbc.CYAN</code>, <code>pbc.MAGENTA</code>,
          <code>pbc.ORANGE</code>, <code>pbc.PURPLE</code>, <code>pbc.GRAY</code>.</p>
          <p>Eigene Farben mit <code>pbc.rgb(r, g, b)</code> – jeder Wert zwischen
          0 und 255.</p>`,
                  en: `<p>Ready-made colors: <code>pbc.BLACK</code>, <code>pbc.WHITE</code>,
          <code>pbc.RED</code>, <code>pbc.GREEN</code>, <code>pbc.BLUE</code>,
          <code>pbc.YELLOW</code>, <code>pbc.CYAN</code>, <code>pbc.MAGENTA</code>.</p>
          <p>Make your own color with <code>pbc.rgb(r, g, b)</code> – each value
          between 0 and 255.</p>` },
          example: 'orange = pbc.rgb(255, 165, 0)\npbc.fill(orange)' } },

        { id: 'display-size', label: 'pbc.WIDTH / pbc.HEIGHT', content: { kind: 'topic',
          body: { de: `<p>Die Größe des Displays als Konstanten. So musst du dir 240/280 nicht
          merken und dein Code bleibt portabel.</p>`,
                  en: `<p>The display size as constants. So you don't have to remember
          240/280 and your code stays portable.</p>` },
          example: { de: 'mitte_x = pbc.WIDTH // 2\nmitte_y = pbc.HEIGHT // 2\npbc.text12("Mitte", mitte_x - 20, mitte_y, pbc.WHITE)',
                     en: 'cx = pbc.WIDTH // 2\ncy = pbc.HEIGHT // 2\npbc.text12("Centre", cx - 20, cy, pbc.WHITE)' } } },
      ] },
    ],
  },

  // ============================== PBC+ BILDER & SPRITES =================
  {
    key: 'images', label: 'PBC+ Bilder & Sprites', icon: '🖼️',
    sections: [
      { title: 'Bilder anzeigen',
        intro: { kind: 'intro', body: {
          de: `<p>Du kannst eigene Bilder als <b>PNG-Dateien</b> auf den PBC+ laden und im
          Programm anzeigen. Lade die Bilder über „Dateien → Bilder verwalten" hoch –
          dann liegen sie auf dem Gerät und können in jedem Programm verwendet werden.</p>

          <p>PNGs mit Transparenz funktionieren automatisch: durchsichtige Pixel werden
          nicht überschrieben. So kannst du Spielfiguren mit unregelmäßigen Umrissen
          über Hintergrund-Bilder legen.</p>`,
          en: `<p>You can upload your own <b>PNG files</b> to the PBC+ and show them in
          your program. Upload images via "Files → Manage images" – they then live on
          the device and can be used from any program.</p>

          <p>PNGs with transparency just work: transparent pixels aren't overwritten.
          So you can place irregularly-shaped figures over a background image.</p>`,
        } },
        entries: [
        { id: 'images-load', label: 'pbc.load_image(datei)', content: { kind: 'topic',
          body: { de: `<p>Lädt eine PNG-Datei vom PBC+ und gibt ein Bild-Objekt zurück. Mache
          das einmal am Programm-Anfang, nicht in einer Schleife – Laden dauert.</p>`,
                  en: `<p>Loads a PNG file from the PBC+ and returns an image object. Do
          this once at the start of your program, not inside a loop – loading takes
          time.</p>` },
          signature: { de: 'pbc.load_image("dateiname.png")', en: 'pbc.load_image("filename.png")' },
          example: { de: 'held = pbc.load_image("held.png")\npbc.show(held, 100, 100)',
                     en: 'hero = pbc.load_image("hero.png")\npbc.show(hero, 100, 100)' },
          insert: { de: 'bild = pbc.load_image("dateiname.png")\n',
                    en: 'image = pbc.load_image("filename.png")\n' } } },

        { id: 'images-show', label: 'pbc.show(bild, x, y)', content: { kind: 'topic',
          body: { de: `<p>Zeigt ein geladenes Bild an Position (x, y). Funktioniert genauso
          wie das Anzeigen einer Canvas.</p>`,
                  en: `<p>Shows a loaded image at position (x, y). Works just like
          displaying a canvas.</p>` },
          example: { de: 'baum = pbc.load_image("baum.png")\npbc.clear()\npbc.show(baum, 50, 100)\npbc.show(baum, 150, 100)',
                     en: 'tree = pbc.load_image("tree.png")\npbc.clear()\npbc.show(tree, 50, 100)\npbc.show(tree, 150, 100)' } } },
      ] },
      { title: 'Sprites',
        intro: { kind: 'intro', body: {
          de: `<p>Ein <b>Sprite</b> ist eine bewegliche Spielfigur. Im Unterschied zu einem
          einfachen <code>pbc.show(bild, x, y)</code> merkt sich ein Sprite seine
          Position selbst und unterstützt sanfte Bewegungen sowie Kollisions-Tests.</p>

          <p>Sprites werden automatisch im Hintergrund neu gezeichnet, wenn sich was
          ändert. Du musst dich also nicht selbst um Flackern und Neuzeichnen kümmern.</p>`,
          en: `<p>A <b>sprite</b> is a moveable game figure. Unlike a plain
          <code>pbc.show(image, x, y)</code>, a sprite remembers its own position and
          supports smooth motion and collision tests.</p>

          <p>Sprites are redrawn automatically in the background whenever something
          changes. You don't have to worry about flicker or redrawing yourself.</p>`,
        } },
        entries: [
        { id: 'sprites-create', label: 'pbc.sprite(datei)', content: { kind: 'topic',
          body: { de: `<p>Erzeugt einen neuen Sprite aus einer PNG-Datei. Der Sprite startet an
          Position (0, 0) und ist noch <b>unsichtbar</b> – erst <code>.show()</code> zeigt ihn.</p>`,
                  en: `<p>Creates a new sprite from a PNG file. The sprite starts at
          position (0, 0) and is still <b>hidden</b> – call <code>.show()</code> to see it.</p>` },
          example: { de: 'spieler = pbc.sprite("held.png")\nspieler.set_to(100, 100)\nspieler.show()',
                     en: 'player = pbc.sprite("hero.png")\nplayer.set_to(100, 100)\nplayer.show()' },
          insert: { de: 'spieler = pbc.sprite("dateiname.png")\n',
                    en: 'player = pbc.sprite("filename.png")\n' } } },

        { id: 'sprites-showhide', label: '.show() / .hide()', content: { kind: 'topic',
          body: { de: `<p>Macht den Sprite sichtbar bzw. blendet ihn aus, ohne ihn zu vergessen.
          Position und Bild bleiben erhalten.</p>`,
                  en: `<p>Makes the sprite visible or hides it, without losing it.
          Position and image are preserved.</p>` },
          example: { de: 'spieler.hide()\ntime.sleep(1)\nspieler.show()',
                     en: 'player.hide()\ntime.sleep(1)\nplayer.show()' } } },

        { id: 'sprites-setto', label: '.set_to(x, y)', content: { kind: 'topic',
          body: { de: `<p>Springt sofort zu Position (x, y). Keine Animation, einfach „peng –
          drüben".</p>`,
                  en: `<p>Jumps immediately to (x, y). No animation, just snaps there.</p>` },
          example: { de: 'spieler.set_to(120, 140)', en: 'player.set_to(120, 140)' } } },

        { id: 'sprites-setby', label: '.set_by(dx, dy)', content: { kind: 'topic',
          body: { de: `<p>Verschiebt den Sprite <b>relativ</b> um (dx, dy). Praktisch in
          Schleifen, in denen sich was Schritt für Schritt bewegen soll.</p>`,
                  en: `<p>Moves the sprite <b>relative</b> by (dx, dy). Handy in loops
          where something should move step by step.</p>` },
          example: { de: 'for i in range(50):\n    spieler.set_by(1, 0)\n    time.sleep_ms(30)',
                     en: 'for i in range(50):\n    player.set_by(1, 0)\n    time.sleep_ms(30)' } } },

        { id: 'sprites-glideto', label: '.glide_to(x, y, ms)', content: { kind: 'topic',
          body: { de: `<p>Gleitet sanft über <code>ms</code> Millisekunden zur Position (x, y).
          Das Programm wartet, bis die Bewegung fertig ist.</p>`,
                  en: `<p>Glides smoothly to (x, y) over <code>ms</code> milliseconds. The
          program waits until the motion is done.</p>` },
          example: { de: 'spieler.glide_to(200, 100, 1000)   # 1 Sekunde lang gleiten',
                     en: 'player.glide_to(200, 100, 1000)   # glide for 1 second' } } },

        { id: 'sprites-glideby', label: '.glide_by(dx, dy, ms)', content: { kind: 'topic',
          body: { de: `<p>Gleitet sanft um (dx, dy) relativ zur aktuellen Position.</p>`,
                  en: `<p>Glides smoothly by (dx, dy) relative to the current position.</p>` },
          example: { de: 'spieler.glide_by(0, -30, 400)   # 30 Pixel nach oben in 0.4 s',
                     en: 'player.glide_by(0, -30, 400)   # 30 pixels up in 0.4 s' } } },

        { id: 'sprites-touches', label: '.touches(anderer)', content: { kind: 'topic',
          body: { de: `<p>Liefert <code>True</code>, wenn dieser Sprite einen anderen
          Sprite berührt. Praktisch für Kollisions-Erkennung.</p>`,
                  en: `<p>Returns <code>True</code> if this sprite touches another sprite.
          Useful for collision detection.</p>` },
          example: { de: 'if held.touches(gegner):\n    print("Getroffen!")',
                     en: 'if hero.touches(enemy):\n    print("Hit!")' } } },

        { id: 'sprites-edge', label: '.touches_edge()', content: { kind: 'topic',
          body: { de: `<p>Liefert <code>True</code>, wenn der Sprite am Bildschirmrand
          anstößt.</p>`,
                  en: `<p>Returns <code>True</code> if the sprite touches the screen edge.</p>` },
          example: 'ball.set_by(1, 0)\nif ball.touches_edge():\n    pbc.tone(1000)\n    time.sleep_ms(100)\n    pbc.no_tone()' } },

        { id: 'sprites-oncolor', label: '.on_color(farbe)', content: { kind: 'topic',
          body: { de: `<p>Liefert <code>True</code>, wenn der Sprite auf dem
          Hintergrund-Canvas eine Stelle mit genau dieser Farbe berührt. Gezählt wird
          nur die sichtbare Form des Sprites – durchsichtige Ecken nicht. So lassen sich
          Wände, Ziellinien oder Lava einfach auf den Hintergrund malen.</p>
          <p>Ohne Hintergrund-Canvas ist das Ergebnis immer <code>False</code>.</p>`,
                  en: `<p>Returns <code>True</code> if the sprite touches a spot of exactly
          this colour on the background canvas. Only the sprite's visible shape counts –
          transparent corners don't. That makes it easy to paint walls, finish lines or
          lava onto the background.</p>
          <p>Without a background canvas the result is always <code>False</code>.</p>` },
          example: { de: 'if held.on_color(pbc.RED):\n    print("Autsch, Lava!")',
                     en: 'if hero.on_color(pbc.RED):\n    print("Ouch, lava!")' } } },
      ] },
    ],
  },

  // ============================== PBC+ CANVAS ===========================
  {
    key: 'canvas', label: 'PBC+ Canvas', icon: '🖌️',
    intro: { kind: 'intro', body: {
      de: `<p>Ein <b>Canvas</b> ist eine Mal-Fläche im Speicher, die so groß
      ist wie das Display. Du zeichnest mit den gleichen Befehlen wie auf
      dem Display – das Bild bleibt aber unsichtbar, bis du
      <code>Canvas zeigen</code> aufrufst.</p>

      <p>Im PBC+ gibt es <b>immer genau ein</b> Canvas (im Code heißt es
      <code>hintergrund</code>). Du musst es nicht selbst anlegen – sobald
      du irgendwo einen Canvas-Block benutzt, wird das Canvas
      automatisch erzeugt. Das ist absichtlich so einfach gehalten: du
      kannst dich auf dein Spiel konzentrieren und musst dir keine
      Gedanken über Speicher oder Bildgrößen machen.</p>

      <p>Warum das nützlich ist:</p>
      <ul>
        <li><b>Hintergründe bauen.</b> Du malst Berge, Wolken und einen Pfad
          auf das Canvas und zeigst es dann. Während dein Spiel läuft,
          kannst du Sprites darüber bewegen oder eine Turtle darauf
          zeichnen lassen – ohne dass dein Bild zerstört wird.</li>
        <li><b>Flackerfreie Animationen.</b> Wenn du direkt aufs Display
          malst, sieht der Spieler jede einzelne Zeile entstehen. Wenn du
          auf das Canvas malst und dann mit <code>Canvas zeigen</code>
          einen Schwung überträgst, sieht er das fertige Bild auf einmal.</li>
      </ul>`,
      en: `<p>A <b>canvas</b> is a drawing surface in memory the same size as
      the display. You draw on it with the same commands you'd use for the
      display – but the picture stays invisible until you call
      <code>show canvas</code>.</p>

      <p>The PBC+ always has <b>exactly one</b> canvas (in code it's called
      <code>background</code>). You don't have to create it yourself: as
      soon as you use any canvas block, the canvas appears
      automatically. This is deliberately simple so you can focus on your
      game without worrying about memory or image sizes.</p>

      <p>Why this is useful:</p>
      <ul>
        <li><b>Pre-build scenes.</b> Paint mountains, clouds and a path
          onto the canvas, then show it. As your game runs you can move
          sprites over it or have a turtle draw on it without
          destroying your scene.</li>
        <li><b>Flicker-free animations.</b> Drawing straight onto the display
          shows every line appearing one by one. Drawing onto the canvas and
          then pushing it with <code>show canvas</code> shows the finished
          image all at once.</li>
      </ul>`,
    } },
    sections: [{ entries: [
      { id: 'canvas-draw', label: 'Auf das Canvas zeichnen', content: { kind: 'topic',
        body: { de: `<p>Die gleichen Befehle wie auf dem Display – nur als
        Methoden auf dem Canvas. Das Canvas wird automatisch angelegt, wenn
        du den ersten Canvas-Block benutzt; du brauchst keinen "Canvas
        anlegen"-Block.</p>`,
                en: `<p>The same commands as on the display – just as
        methods on the canvas. The canvas is created automatically the moment
        you use any canvas block; there's no separate "create canvas"
        step.</p>` },
        example: { de: 'hintergrund.fill(pbc.BLACK)\nhintergrund.rect(20, 20, 60, 40, pbc.WHITE)\nhintergrund.fill_rect(100, 60, 30, 30, pbc.RED)\nhintergrund.ellipse(160, 80, 20, 20, pbc.YELLOW, True)\nhintergrund.text12("Hallo!", 30, 120, pbc.GREEN)\npbc.show(hintergrund)',
                   en: 'background.fill(pbc.BLACK)\nbackground.rect(20, 20, 60, 40, pbc.WHITE)\nbackground.fill_rect(100, 60, 30, 30, pbc.RED)\nbackground.ellipse(160, 80, 20, 20, pbc.YELLOW, True)\nbackground.text12("Hello!", 30, 120, pbc.GREEN)\npbc.show(background)' } } },

      { id: 'canvas-show', label: 'Canvas zeigen', content: { kind: 'topic',
        body: { de: `<p>Schickt das Canvas zum Bildschirm. Bis du das
        aufrufst, ist alles, was du gemalt hast, unsichtbar.</p>`,
                en: `<p>Pushes the canvas to the screen. Until you call
        this, nothing you drew is visible.</p>` },
        signature: { de: 'pbc.show(hintergrund)', en: 'pbc.show(background)' } } },

      { id: 'canvas-turtle', label: 'Turtle auf das Canvas zeichnen lassen',
        content: { kind: 'topic',
        body: { de: `<p>Eine neue Turtle zeichnet immer auf das Canvas.
        Über die Auswahl im Block kannst du steuern, was beim Erzeugen
        passiert:</p>
        <ul>
          <li><b>Hintergrund behalten</b> – die Turtle zeichnet über das,
            was schon auf dem Canvas ist. Standard.</li>
          <li><b>neuer Hintergrund</b> – das Canvas wird vorher schwarz
            gefüllt. Praktisch, wenn du mit einer leeren Fläche starten
            willst.</li>
        </ul>`,
                en: `<p>A new turtle always draws on the canvas. The
        dropdown on the block controls what happens when it's created:</p>
        <ul>
          <li><b>keep background</b> – the turtle draws on top of whatever
            is already on the canvas. Default.</li>
          <li><b>new background</b> – the canvas is cleared to black
            first. Handy when you want to start with a fresh surface.</li>
        </ul>` },
        example: { de: 'hintergrund.fill(pbc.BLUE)\npbc.show(hintergrund)\n\nheld = turtle.Turtle(canvas=hintergrund)\nheld.forward(100)',
                   en: 'background.fill(pbc.BLUE)\npbc.show(background)\n\nhero = turtle.Turtle(canvas=background)\nhero.forward(100)' } } },

      { id: 'canvas-sprite-bg', label: 'Canvas hinter Sprites zeigen',
        content: { kind: 'topic',
        body: { de: `<p>Setzt das Canvas als das, was unter den Sprites
        gezeichnet wird. Ohne diese Zeile siehst du Sprites über einer
        schwarzen Fläche; mit ihr über deinem selbstgemalten Bild.</p>`,
                en: `<p>Sets the canvas as what gets painted below the
        sprites. Without this, sprites sit on a black surface; with it, on
        top of your own picture.</p>` },
        example: { de: 'pbc.Sprite._background = hintergrund',
                   en: 'pbc.Sprite._background = background' } } },
    ] }],
  },

  // ============================== PBC+ EINGABE ==========================
  {
    key: 'input', label: 'PBC+ Eingabe', icon: '🎮',
    sections: [
      { title: 'Knöpfe',
        intro: { kind: 'intro', body: {
          de: `<p>Der PBC+ hat zwei Knöpfe (A und B) und einen Joystick mit vier Richtungen
          und einem Mittel-Druck. Im Programm fragst du ab, ob ein Knopf gerade
          gedrückt ist oder gedrückt wurde.</p>

          <p>Wichtig zu unterscheiden:</p>
          <ul>
            <li><code>pressed_a()</code> liefert mehrfach <code>True</code>, solange du
              den Knopf festhältst. Praktisch wenn du dauerhaft etwas tun willst,
              solange der Knopf gehalten wird (z.B. „solange A gedrückt: nach rechts").</li>
            <li><code>was_pressed_a()</code> liefert genau einmal pro Drücken
              <code>True</code> – beim nächsten Aufruf <code>False</code>, auch wenn
              der Knopf noch gehalten wird. Gut für „Aktion einmal auslösen".</li>
          </ul>`,
          en: `<p>The PBC+ has two buttons (A and B) and a joystick with four directions
          plus a centre press. In your program you ask whether a button is currently
          pressed or has been pressed.</p>

          <p>Important distinction:</p>
          <ul>
            <li><code>pressed_a()</code> returns <code>True</code> repeatedly as long as
              you hold the button. Handy when you want something continuous while the
              button is held (e.g. "as long as A is pressed: move right").</li>
            <li><code>was_pressed_a()</code> returns <code>True</code> exactly once per
              press – the next call gives <code>False</code> even if the button is still
              held. Good for "trigger an action once".</li>
          </ul>`,
        } },
        entries: [
        { id: 'input-press_a', label: 'pbc.pressed_a()', content: { kind: 'topic',
          body: { de: `<p>Wahrheitswert: ist der A-Knopf <b>im Moment</b> gedrückt?</p>`,
                  en: `<p>Boolean: is the A button <b>currently</b> pressed?</p>` },
          example: { de: 'while True:\n    if pbc.pressed_a():\n        held.set_by(0, -1)',
                     en: 'while True:\n    if pbc.pressed_a():\n        hero.set_by(0, -1)' } } },

        { id: 'input-press_b', label: 'pbc.pressed_b()', content: { kind: 'topic',
          body: { de: `<p>Wahrheitswert: ist der B-Knopf im Moment gedrückt?</p>`,
                  en: `<p>Boolean: is the B button currently pressed?</p>` },
          example: 'if pbc.pressed_b():\n    print("B!")' } },

        { id: 'input-was_a', label: 'pbc.was_pressed_a()', content: { kind: 'topic',
          body: { de: `<p>Wahrheitswert: <i>wurde</i> der A-Knopf gedrückt seit dem letzten
          Aufruf? Genau einmal pro Drücken True, danach wieder False.</p>`,
                  en: `<p>Boolean: <i>has</i> the A button been pressed since the last call?
          True exactly once per press, then False again.</p>` },
          example: { de: 'if pbc.was_pressed_a():\n    punkte = punkte + 1',
                     en: 'if pbc.was_pressed_a():\n    score = score + 1' } } },

        { id: 'input-was_b', label: 'pbc.was_pressed_b()', content: { kind: 'topic',
          body: { de: `<p>Wahrheitswert: wurde der B-Knopf gedrückt seit dem letzten Aufruf?</p>`,
                  en: `<p>Boolean: has the B button been pressed since the last call?</p>` },
          example: { de: 'if pbc.was_pressed_b():\n    spiel_pausieren()',
                     en: 'if pbc.was_pressed_b():\n    pause_game()' } } },
      ] },
      { title: 'Joystick', entries: [
        { id: 'input-up', label: 'pbc.pressed_up() / _down / _left / _right / _center', content: { kind: 'topic',
          body: { de: `<p>Joystick-Richtungen, gleich wie bei den Knöpfen. Liefert
          <code>True</code> solange in die Richtung gedrückt wird.</p>`,
                  en: `<p>Joystick directions, just like the buttons. Returns
          <code>True</code> as long as the joystick is held in that direction.</p>` },
          example: { de: 'while True:\n    if pbc.pressed_up():    held.set_by(0, -1)\n    if pbc.pressed_down():  held.set_by(0,  1)\n    if pbc.pressed_left():  held.set_by(-1, 0)\n    if pbc.pressed_right(): held.set_by( 1, 0)\n    time.sleep_ms(20)',
                     en: 'while True:\n    if pbc.pressed_up():    hero.set_by(0, -1)\n    if pbc.pressed_down():  hero.set_by(0,  1)\n    if pbc.pressed_left():  hero.set_by(-1, 0)\n    if pbc.pressed_right(): hero.set_by( 1, 0)\n    time.sleep_ms(20)' } } },

        { id: 'input-was_up', label: 'pbc.was_pressed_up() / _down / _left / _right / _center', content: { kind: 'topic',
          body: { de: `<p>Joystick-Richtungen als „genau einmal pro Druck"-Variante.</p>`,
                  en: `<p>Joystick directions as the "once per press" variant.</p>` },
          example: 'if pbc.was_pressed_center():\n    fire_shot()' } },
      ] },
    ],
  },

  // ============================== PBC+ TURTLE ===========================
  {
    key: 'turtle', label: 'PBC+ Turtle', icon: '🐢',
    intro: { kind: 'intro', body: {
      de: `<p>Eine <b>Turtle</b> ist ein kleines Wesen, das mit einem Stift über das
      Display krabbelt und Linien hinterlässt. Du steuerst sie mit Befehlen wie
      „vorwärts 50 Pixel" oder „links 90 Grad". So entstehen mit ganz wenigen Anweisungen
      Quadrate, Sterne, Spiralen, Mandalas …</p>

      <p>Eine Turtle zeichnet immer auf das gemeinsame Canvas (den „Hintergrund").
      Bei der Erstellung kannst du wählen, ob der bisherige Inhalt erhalten bleiben
      oder das Canvas geleert werden soll. Du kannst auch mehrere Turtles gleichzeitig
      haben – jede mit eigenem Namen.</p>

      <p>Im Code-Modus geht das so:</p>
      <pre><code>import turtle
held = turtle.Turtle()
held.forward(100)
held.left(120)
held.forward(100)</code></pre>`,
      en: `<p>A <b>turtle</b> is a little creature that crawls across the display with a
      pen and leaves lines behind it. You steer it with commands like "forward 50
      pixels" or "left 90 degrees". With just a handful of instructions you can draw
      squares, stars, spirals, mandalas …</p>

      <p>A turtle always draws on the shared canvas (the "background"). When you
      create it you can choose whether to keep what was already drawn or to clear
      the canvas first. You can also have several turtles running side by side –
      each with its own name.</p>

      <p>In code mode it looks like this:</p>
      <pre><code>import turtle
hero = turtle.Turtle()
hero.forward(100)
hero.left(120)
hero.forward(100)</code></pre>`,
    } },
    sections: [{ entries: [
      { id: 'turtle-create', label: 'Turtle anlegen', content: { kind: 'topic',
        body: { de: `<p>Erzeugt eine neue Turtle. Im Block-Modus wirst du nach einem Namen
        gefragt, und kannst wählen, ob der Hintergrund vor dem Anlegen geleert werden
        soll.</p>`,
                en: `<p>Creates a new turtle. In block mode you'll be asked for a name and
        can choose whether to clear the background first.</p>` },
        signature: { de: 'mein_held = turtle.Turtle(canvas=hintergrund)',
                     en: 'my_hero = turtle.Turtle(canvas=background)' },
        example: { de: 'import turtle\nhintergrund = pbc.Canvas(pbc.WIDTH, pbc.HEIGHT)\nheld = turtle.Turtle(canvas=hintergrund)',
                   en: 'import turtle\nbackground = pbc.Canvas(pbc.WIDTH, pbc.HEIGHT)\nhero = turtle.Turtle(canvas=background)' } } },

      { id: 'turtle-forward', label: '.forward(distanz)', content: { kind: 'topic',
        body: { de: `<p>Bewegt die Turtle <code>distanz</code> Pixel vorwärts in die Richtung
        in die sie schaut. Wenn der Stift unten ist (Standard), wird eine Linie gezogen.</p>`,
                en: `<p>Moves the turtle <code>distance</code> pixels forward in the
        direction it's facing. If the pen is down (default), draws a line.</p>` },
        signature: { de: 'held.forward(distanz)',
                     en: 'hero.forward(distance)' },
        example: { de: 'held.forward(50)', en: 'hero.forward(50)' } } },

      { id: 'turtle-back', label: '.back(distanz)', content: { kind: 'topic',
        body: { de: `<p>Bewegt die Turtle <code>distanz</code> Pixel rückwärts.</p>`,
                en: `<p>Moves the turtle <code>distance</code> pixels backwards.</p>` },
        signature: { de: 'held.back(distanz)', en: 'hero.back(distance)' } } },

      { id: 'turtle-left', label: '.left(winkel)', content: { kind: 'topic',
        body: { de: `<p>Dreht die Turtle um <code>winkel</code> Grad nach links.</p>`,
                en: `<p>Turns the turtle <code>angle</code> degrees to the left.</p>` },
        signature: { de: 'held.left(90)', en: 'hero.left(90)' } } },

      { id: 'turtle-right', label: '.right(winkel)', content: { kind: 'topic',
        body: { de: `<p>Dreht die Turtle um <code>winkel</code> Grad nach rechts.</p>`,
                en: `<p>Turns the turtle <code>angle</code> degrees to the right.</p>` },
        signature: { de: 'held.right(90)', en: 'hero.right(90)' } } },

      { id: 'turtle-pen', label: '.penUp() / .penDown()', content: { kind: 'topic',
        body: { de: `<p>Hebt den Stift hoch (Turtle bewegt sich ohne zu zeichnen) oder
        setzt ihn wieder ab.</p>`,
                en: `<p>Lifts the pen up (turtle moves without drawing) or puts it back
        down.</p>` },
        example: { de: 'held.penUp()\nheld.forward(50)\nheld.penDown()',
                   en: 'hero.penUp()\nhero.forward(50)\nhero.penDown()' } } },

      { id: 'turtle-color', label: '.setPenColor(farbe)', content: { kind: 'topic',
        body: { de: `<p>Setzt die Farbe des Stifts. Du kannst die vordefinierten
        Farb-Namen nutzen (<code>pbc.RED</code>, <code>pbc.BLUE</code>, …) oder eigene
        Farben mit <code>pbc.rgb(r, g, b)</code> mischen.</p>`,
                en: `<p>Sets the pen colour. Use the predefined names
        (<code>pbc.RED</code>, <code>pbc.BLUE</code>, …) or mix your own with
        <code>pbc.rgb(r, g, b)</code>.</p>` },
        example: { de: 'held.setPenColor(pbc.YELLOW)',
                   en: 'hero.setPenColor(pbc.YELLOW)' } } },

      { id: 'turtle-pos', label: '.setPosition(x, y)', content: { kind: 'topic',
        body: { de: `<p>Setzt die Turtle ohne Linie zu ziehen an die Position (x, y).
        (0,0) ist die Mitte des Bildschirms.</p>`,
                en: `<p>Moves the turtle to (x, y) without drawing a line. (0,0) is
        the centre of the screen.</p>` },
        signature: { de: 'held.setPosition(0, 0)',
                     en: 'hero.setPosition(0, 0)' } } },

      { id: 'turtle-dir', label: '.setDirection(winkel)', content: { kind: 'topic',
        body: { de: `<p>Setzt die Blickrichtung der Turtle. 0 Grad bedeutet „nach oben",
        90 Grad „nach rechts", usw.</p>`,
                en: `<p>Sets the turtle's facing direction. 0 degrees means "up",
        90 degrees means "right", etc.</p>` } } },

      { id: 'turtle-home', label: '.home()', content: { kind: 'topic',
        body: { de: `<p>Bringt die Turtle zurück in die Mitte des Bildschirms, ohne
        eine Linie zu zeichnen.</p>`,
                en: `<p>Sends the turtle back to the centre of the screen without
        drawing a line.</p>` } } },

      { id: 'turtle-speed', label: '.speed(0..10)', content: { kind: 'topic',
        body: { de: `<p>Stellt die Animations-Geschwindigkeit ein. 0 = sofort
        (keine Animation), 1 = sehr langsam, 10 = schnell. Standard ist 5.</p>`,
                en: `<p>Sets the animation speed. 0 = instant (no animation),
        1 = very slow, 10 = fast. Default is 5.</p>` },
        example: { de: 'held.speed(0)   # sofort fertig\nheld.speed(1)   # ganz langsam',
                   en: 'hero.speed(0)   # instant\nhero.speed(1)   # very slow' } } },

      { id: 'turtle-show', label: '.show() / .hide()', content: { kind: 'topic',
        body: { de: `<p>Blendet die Turtle (das kleine Dreieck) ein oder aus. Die Linien
        bleiben jeweils sichtbar.</p>`,
                en: `<p>Shows or hides the turtle (the little triangle). The lines stay
        visible either way.</p>` } } },

      { id: 'turtle-clear', label: '.clear()', content: { kind: 'topic',
        body: { de: `<p>Löscht alle Linien der Turtle und füllt den Hintergrund
        schwarz.</p>`,
                en: `<p>Erases everything the turtle has drawn and clears the background
        to black.</p>` } } },

      { id: 'turtle-oncolor', label: '.on_color(farbe)', content: { kind: 'topic',
        body: { de: `<p>Liefert <code>True</code>, wenn die Stelle direkt vor der
        Turtle (3 Pixel in Blickrichtung) genau diese Farbe hat. Weil die Turtle nach
        vorne schaut, zählen ihre eigene Spur und ihr Dreieck nicht mit. Ein zweiter
        Wert ändert den Abstand, z. B. <code>held.on_color(pbc.RED, 6)</code>.</p>`,
                en: `<p>Returns <code>True</code> if the spot just ahead of the turtle
        (3 pixels in its heading) has exactly this colour. Because the turtle looks
        ahead, its own trail and triangle don't count. A second value changes the
        distance, e.g. <code>hero.on_color(pbc.RED, 6)</code>.</p>` },
        example: { de: 'while not held.on_color(pbc.RED):\n    held.forward(2)',
                   en: 'while not hero.on_color(pbc.RED):\n    hero.forward(2)' } } },
    ] }],
  },

  // ============================== PBC+ SENSOREN =========================
  {
    key: 'sensors', label: 'PBC+ Sensoren', icon: '📡',
    intro: { kind: 'intro', body: {
      de: `<p>Im PBC+ stecken Sensoren, die du im Programm auslesen kannst – ein
      <b>Beschleunigungssensor</b>, der erkennt wie das Gerät gehalten oder bewegt
      wird, und eine Batterie-Spannungs-Messung.</p>
      <p>Externe Sensoren (z.B. Temperatur) kannst du in den Einstellungen
      aktivieren und über STEMMA-QT-Stecker anschließen.</p>`,
      en: `<p>The PBC+ has built-in sensors you can read from your program – an
      <b>accelerometer</b> that detects how the device is being held or moved, and
      a battery voltage measurement.</p>
      <p>External sensors (e.g. temperature) can be enabled in the settings and
      connected via STEMMA-QT.</p>`,
    } },
    sections: [
      { title: 'Bewegung',
        entries: [
        { id: 'sensors-x', label: 'pbc.accel_x()', content: { kind: 'topic',
          body: { de: `<p>Beschleunigung in X-Richtung (links/rechts kippen). Werte etwa
          zwischen -10 und +10.</p>`,
                  en: `<p>Acceleration in the X direction (tilt left/right). Values
          roughly between -10 and +10.</p>` },
          example: { de: 'while True:\n    held.set_by(int(pbc.accel_x() // 2), 0)\n    time.sleep_ms(30)',
                     en: 'while True:\n    hero.set_by(int(pbc.accel_x() // 2), 0)\n    time.sleep_ms(30)' } } },

        { id: 'sensors-y', label: 'pbc.accel_y()', content: { kind: 'topic',
          body: { de: `<p>Beschleunigung in Y-Richtung (vor/zurück kippen).</p>`,
                  en: `<p>Acceleration in the Y direction (tilt forward/back).</p>` },
          example: 'print(pbc.accel_y())' } },

        { id: 'sensors-z', label: 'pbc.accel_z()', content: { kind: 'topic',
          body: { de: `<p>Beschleunigung in Z-Richtung. Im Ruhezustand etwa 9.8 (Erdanziehung).</p>`,
                  en: `<p>Acceleration in the Z direction. About 9.8 at rest (gravity).</p>` },
          example: { de: 'if pbc.accel_z() < 5:\n    print("Schüttle mich nicht!")',
                     en: 'if pbc.accel_z() < 5:\n    print("Do not shake me!")' } } },
      ] },
      { title: 'Batterie', entries: [
        { id: 'sensors-batt', label: 'pbc.battery_voltage()', content: { kind: 'topic',
          body: { de: `<p>Aktuelle Spannung der beiden Batterien in Volt: frisch etwa 3.0–3.2 V,
          fast leer etwa 2.0–2.2 V, mit NiMH-Akkus etwa 2.4–2.7 V. Am USB-Kabel (und im
          Emulator) etwa 5 V; <code>pbc.is_on_usb()</code> sagt, ob das Gerät am USB hängt.
          Aufladen kann der PicoBoy Akkus nicht.</p>`,
                  en: `<p>Current voltage of the two batteries in volts: about 3.0–3.2 V when
          fresh, 2.0–2.2 V when almost empty, 2.4–2.7 V with NiMH rechargeables. About 5 V
          on the USB cable (and in the emulator); <code>pbc.is_on_usb()</code> tells whether
          the device is on USB. The PicoBoy cannot charge rechargeable batteries.</p>` },
          example: { de: 'v = pbc.battery_voltage()\npbc.text12("Batterie: " + str(v) + "V", 30, 30, pbc.WHITE)',
                     en: 'v = pbc.battery_voltage()\npbc.text12("Battery: " + str(v) + "V", 30, 30, pbc.WHITE)' } } },
      ] },
    ],
  },

  // ============================== PBC+ LEDs & SOUND =====================
  {
    key: 'output', label: 'PBC+ LEDs & Sound', icon: '🔊',
    intro: { kind: 'intro', body: {
      de: `<p>Außer dem Display kann der PBC+ noch mehr: Drei Status-LEDs (rot, gelb,
      grün), eine bunte RGB-LED und einen kleinen Lautsprecher für Töne.</p>
      <p>Status-LEDs eignen sich für „etwas läuft / fertig / Fehler"-Anzeigen, die
      RGB-LED für Spielfeedback in beliebigen Farben, und der Lautsprecher für
      Beep-Töne oder einfache Melodien.</p>`,
      en: `<p>The PBC+ has more than just a display: three status LEDs (red, yellow,
      green), a multi-color RGB LED and a small speaker for tones.</p>
      <p>Status LEDs are good for "running / done / error" indicators, the RGB LED
      for game feedback in any color, and the speaker for beeps or simple
      melodies.</p>`,
    } },
    sections: [
      { title: 'Status-LEDs', entries: [
        { id: 'output-led_red', label: 'pbc.led_red(an)', content: { kind: 'topic',
          body: { de: `<p>Schaltet die rote LED ein (<code>True</code>) oder aus
          (<code>False</code>).</p>`,
                  en: `<p>Turns the red LED on (<code>True</code>) or off
          (<code>False</code>).</p>` },
          example: 'pbc.led_red(True)\ntime.sleep(1)\npbc.led_red(False)' } },

        { id: 'output-led_yel', label: 'pbc.led_yellow(an)', content: { kind: 'topic',
          body: { de: `<p>Schaltet die gelbe LED ein/aus.</p>`,
                  en: `<p>Turns the yellow LED on/off.</p>` },
          example: 'pbc.led_yellow(True)' } },

        { id: 'output-led_grn', label: 'pbc.led_green(an)', content: { kind: 'topic',
          body: { de: `<p>Schaltet die grüne LED ein/aus.</p>`,
                  en: `<p>Turns the green LED on/off.</p>` },
          example: 'pbc.led_green(True)' } },
      ] },
      { title: 'RGB-LED', entries: [
        { id: 'output-rgb', label: 'pbc.rgb_led(r, g, b)', content: { kind: 'topic',
          body: { de: `<p>Setzt die RGB-LED auf eine Farbe. Jeder Wert zwischen 0 und 255.</p>`,
                  en: `<p>Sets the RGB LED to a color. Each value between 0 and 255.</p>` },
          example: { de: 'pbc.rgb_led(255, 0, 0)     # rot\npbc.rgb_led(0, 255, 0)     # grün\npbc.rgb_led(128, 0, 200)   # lila',
                     en: 'pbc.rgb_led(255, 0, 0)     # red\npbc.rgb_led(0, 255, 0)     # green\npbc.rgb_led(128, 0, 200)   # purple' },
          insert: 'pbc.rgb_led(255, 0, 0)\n' } },

        { id: 'output-rgb_off', label: 'pbc.rgb_led_off()', content: { kind: 'topic',
          body: { de: `<p>Schaltet die RGB-LED komplett aus.</p>`,
                  en: `<p>Turns the RGB LED off completely.</p>` },
          example: 'pbc.rgb_led_off()' } },
      ] },
      { title: 'Sound', entries: [
        { id: 'output-tone', label: 'pbc.tone(freq)', content: { kind: 'topic',
          body: { de: `<p>Spielt einen Ton mit der angegebenen Frequenz in Hertz. 440 Hz ist
          ein Kammerton A, 880 Hz das A eine Oktave höher.</p>`,
                  en: `<p>Plays a tone at the given frequency in hertz. 440 Hz is a
          concert A, 880 Hz the A an octave higher.</p>` },
          example: 'pbc.tone(440)\ntime.sleep_ms(200)\npbc.no_tone()' } },

        { id: 'output-notone', label: 'pbc.no_tone()', content: { kind: 'topic',
          body: { de: `<p>Stoppt den aktuellen Ton.</p>`,
                  en: `<p>Stops the current tone.</p>` },
          example: 'pbc.tone(800)\ntime.sleep_ms(150)\npbc.no_tone()' } },

        { id: 'output-melody', label: 'Eine Melodie', content: { kind: 'topic',
          body: { de: `<p>Eine Melodie ist eine Folge aus Ton + Pause + Stop. Die Frequenzen
          stehen oft in einer Liste, durch die du mit <code>for</code> läufst.</p>`,
                  en: `<p>A melody is a sequence of tone + pause + stop. Frequencies
          often live in a list that you iterate over with <code>for</code>.</p>` },
          example: { de: 'noten = [262, 294, 330, 349, 392, 440, 494, 523]   # C-Dur Tonleiter\nfor f in noten:\n    pbc.tone(f)\n    time.sleep_ms(200)\npbc.no_tone()',
                     en: 'notes = [262, 294, 330, 349, 392, 440, 494, 523]   # C major scale\nfor f in notes:\n    pbc.tone(f)\n    time.sleep_ms(200)\npbc.no_tone()' } } },
      ] },
    ],
  },

  // ============================== DATEIEN ===============================
];

// Standard Blockly blocks that we expose in our sidebar.
//   control = flow only (if, loops, forever)
//   math    = numbers, arithmetic, random, comparisons, logic, true/false
const STD_BLOCKS = {
  control: [
    ['controls_if',          t('falls')],
    ['controls_if_else',     t('falls / sonst')],
    ['controls_repeat_ext',  t('N-mal wiederholen')],
    ['controls_whileUntil',  t('solange / bis')],
    ['controls_for',         t('für i von … bis …')],
  ],
  math: [
    ['math_number',          t('Zahl')],
    ['pbc_arith',            t('Rechnen + − × ÷ %')],
    ['logic_compare',        t('Vergleich = ≠ < >')],
    ['logic_operation',      t('und / oder')],
    ['logic_negate',         t('nicht')],
    ['logic_boolean',        t('wahr / falsch')],
  ],
  text: [
    ['text',                 t('Text')],
  ],
  vars:    'DYNAMIC',
  lists:   'DYNAMIC',
  methods: 'DYNAMIC',
  sprite:  'DYNAMIC',
  canvas:  'DYNAMIC',
};

