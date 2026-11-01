#!/usr/bin/env bash
# Runs every test of the fork against dist/index.html.
#   ./alle.sh          quick: edge cases, editor, Stop, help examples
#   ./alle.sh voll     plus all programs of the two books (about 2 hours)
# Pages are served with the isolation headers (like src/htaccess);
# ohne_isolation.mjs checks the page without them.
set -uo pipefail
cd "$(dirname "$0")"
python3 ../build.py
FEHLER=0
lauf() { echo "== $*"; "$@" || FEHLER=1; }
lauf env PBC_AUSGABE=ergebnisse/faelle node pruefe_py.mjs faelle/*.py
lauf node editor_test.mjs
lauf node stop_test.mjs
lauf node ohne_isolation.mjs
lauf node oberflaeche_test.mjs
lauf node dropdown_test.mjs
lauf node zip_test.mjs
lauf node zip_dateien_test.mjs
node hilfe_beispiele.mjs >/dev/null && PBC_AUSGABE=ergebnisse/hilfe_aus node pruefe_py.mjs ergebnisse/hilfe/*.py > ergebnisse/hilfe.log 2>&1
lauf node hilfe_auswerten.mjs < ergebnisse/hilfe.log
if [ "${1:-}" = voll ]; then
  lauf env PBC_AUSGABE=ergebnisse/w_buch node pruefe_py.mjs ../../dokumentation_python/buch/programme/*.py
  lauf env PBC_AUSGABE=ergebnisse/w_schule node pruefe_py.mjs ../../dokumentation_python/schule/programme/*.py
  lauf node pruefe_bloecke.mjs ../../dokumentation/buch/programme/*.pbcp ../../dokumentation/schule/programme/*.pbcp
fi
echo; [ $FEHLER = 0 ] && echo "ALLE TESTS OK" || echo "ES GIBT FEHLER"
exit $FEHLER
