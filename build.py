#!/usr/bin/env python3
"""Builds the single-file PBC+ Studio from src/.

    python3 build.py            -> dist/index.html (+ dist/.htaccess)

Layout of src/:
  head.html, style.css, body.html, tail.html   page skeleton
  pbcp.png                                     board photo, copied next to index.html
  js/NN_name.js                                main script, concatenated in name order
  py/*.py                                      MicroPython modules of the emulator (pbc, turtle);
                                               the worker refers to one as @@PY_WORKER:name.py@@
  geteilt/*.js                                 fonts and display operations of the worker:
                                               @@GETEILT:name.js@@
  worker/*.js                                  emulator worker, inserted as @@WORKER@@
micropython/micropython.{mjs,wasm}           the worker's MicroPython: @@MP_PBC_MJS@@, @@MP_PBC_WASM@@
The result must stay ONE html file: it is uploaded as-is to the webspace.
"""
import datetime
import glob
import os
import re
import sys

HIER = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HIER, 'src')
DIST = os.path.join(HIER, 'dist')


def lies(*teile):
    with open(os.path.join(SRC, *teile), encoding='utf-8') as f:
        return f.read()


def geteilt_einsetzen(text):
    return re.sub(r'@@GETEILT:([\w.]+)@@', lambda m: lies('geteilt', m.group(1)), text)


def py_worker_einsetzen(text):
    import json
    def ersetze(m):
        name = m.group(1)
        return json.dumps(lies('py', name))
    return re.sub(r'@@PY_WORKER:([\w.]+)@@', ersetze, text)


def worker_einsetzen(text):
    if '@@WORKER@@' not in text:
        return text
    teile = [lies('worker', os.path.basename(p))
             for p in sorted(glob.glob(os.path.join(SRC, 'worker', '*.js')))]
    code = geteilt_einsetzen(py_worker_einsetzen('\n'.join(teile)))
    if '</script' in code:
        sys.exit('worker: "</script" darf nicht vorkommen')
    # stored as a JSON string so the worker source needs no escaping rules
    import json
    return text.replace('@@WORKER@@', json.dumps(code))


def mp_einsetzen(text):
    # own MicroPython build (micropython/README.md): module source as a
    # JSON string, wasm as base64
    import json, base64
    hier = os.path.dirname(os.path.abspath(__file__))
    if '@@MP_PBC_MJS@@' in text:
        with open(os.path.join(hier, 'micropython', 'micropython.mjs'), encoding='utf-8') as f:
            text = text.replace('@@MP_PBC_MJS@@', json.dumps(f.read()).replace('</', '<\\/'))
    if '@@MP_PBC_WASM@@' in text:
        with open(os.path.join(hier, 'micropython', 'micropython.wasm'), 'rb') as f:
            text = text.replace('@@MP_PBC_WASM@@', '"' + base64.b64encode(f.read()).decode() + '"')
    return text


def baue():
    js = ''.join(lies('js', os.path.basename(p))
                 for p in sorted(glob.glob(os.path.join(SRC, 'js', '*.js'))))
    js = mp_einsetzen(worker_einsetzen(geteilt_einsetzen(js)))
    # The date in the terminal banner is the day of the build.
    js = re.sub(r"const APP_DATE  = '[0-9-]+';",
                "const APP_DATE  = '%s';" % datetime.date.today().isoformat(), js)
    html = (lies('head.html') + '<style>\n' + lies('style.css') + '</style>\n' +
            lies('body.html') + '<script>\n' + js + '</script>\n' + lies('tail.html'))
    os.makedirs(DIST, exist_ok=True)
    with open(os.path.join(DIST, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(html)
    # photo of the board behind the emulator display; the page loads it
    # from next to index.html, like the original
    import shutil
    shutil.copyfile(os.path.join(SRC, 'pbcp.png'), os.path.join(DIST, 'pbcp.png'))
    ht = os.path.join(SRC, 'htaccess')
    if os.path.exists(ht):
        with open(os.path.join(DIST, '.htaccess'), 'w') as f:
            f.write(lies('htaccess'))
    return html


if __name__ == '__main__':
    html = baue()
    m = re.search(r'const APP_BUILD = (\d+)', html)
    print(f'dist/index.html: {len(html.encode())} Bytes, Build {m.group(1) if m else "?"}')
