// Reads pruefe_py.mjs output (stdin) for the help examples and lists
// those that failed because a pbc/turtle/sprite/canvas name does not
// exist. Other failures (example fragments with undefined variables,
// waiting for input, missing pictures) are expected and ignored.
import fs from 'node:fs';
const text = fs.readFileSync(0, 'utf8');
const bloecke = text.split(/\n(?=ok     |FEHLER )/);
let schlecht = 0;
for (const b of bloecke) {
  if (!b.startsWith('FEHLER')) continue;
  const m = b.match(/AttributeError: (?:module '(?:pbc|turtle)'|'(?:Turtle|Sprite|Canvas)' object) has no attribute '(\w+)'/);
  if (m) { schlecht++; console.log(b.split('\n')[0].replace('FEHLER ', '').trim() + ': unbekannt ' + m[1]); }
}
console.log(schlecht ? schlecht + ' Hilfe-Beispiele mit falschen Namen' : 'Hilfe-Beispiele: keine falschen Namen');
process.exit(schlecht ? 1 : 0);
