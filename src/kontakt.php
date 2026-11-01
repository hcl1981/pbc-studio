<?php
/* ===================================================================
 * kontakt.php  --  Mail-Endpunkt fuer PBC+ Studio
 * ===================================================================
 * Verarbeitet zwei Formulare aus der IDE:
 *   - type=contact   : Kontaktformular (Footer "Kontakt")
 *   - type=hardware  : Hardware-Wunsch (Einstellungen)
 *
 * Spam-Schutz OHNE Captcha:
 *   1. Honeypot-Feld "website": fuer Menschen unsichtbar. Ist es
 *      ausgefuellt -> Bot -> wir tun so als waere alles ok, senden aber
 *      nichts.
 *   2. Zeit-Falle "elapsed" (ms seit Formular-Oeffnung): unter
 *      MIN_ELAPSED_MS -> zu schnell -> vermutlich Bot.
 *   3. Rate-Limit pro IP: max. MAX_PER_HOUR Nachrichten pro Stunde.
 *
 * ====== EINMALIG ANPASSEN ==========================================
 *   $TO    : DEINE private Empfaenger-Adresse (wird NICHT veroeffentlicht)
 *   $FROM  : Absender -- MUSS eine Adresse auf DEINER Domain sein,
 *            sonst landet die Mail im Spam oder wird abgelehnt
 *            (SPF/DKIM). z.B. noreply@deine-domain.de
 * ===================================================================
 */

// ---------- KONFIGURATION (anpassen!) ------------------------------
$TO   = 'empfaenger@example.com';                 // <-- HIER deine Empfaenger-Adresse eintragen
$FROM = 'noreply@example.com';        // <-- HIER eine Adresse auf DEINER Domain
$SITE = 'PBC+ Studio';

const MIN_ELAPSED_MS = 2000;              // Formular muss >= 2 s offen gewesen sein
const MAX_PER_HOUR   = 5;                 // max. Nachrichten pro IP und Stunde
const MAX_LEN        = 5000;              // max. Nachrichtenlaenge
// -------------------------------------------------------------------

header('Content-Type: application/json; charset=utf-8');

// Nur POST zulassen.
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Nur POST erlaubt.']);
    exit;
}

// Antwort-Helfer.
function fail($msg, $code = 400) {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg]);
    exit;
}
function ok() {
    echo json_encode(['ok' => true]);
    exit;
}

// ---------- Eingaben einlesen --------------------------------------
$type    = isset($_POST['type'])     ? trim($_POST['type'])     : 'contact';
$name    = isset($_POST['name'])     ? trim($_POST['name'])     : '';
$email   = isset($_POST['email'])    ? trim($_POST['email'])    : '';
$message = isset($_POST['message'])  ? trim($_POST['message'])  : '';
$website = isset($_POST['website'])  ? trim($_POST['website'])  : '';   // Honeypot
$elapsed = isset($_POST['elapsed'])  ? (int) $_POST['elapsed']  : 0;

// ---------- Spam-Schutz 1: Honeypot --------------------------------
// Ein Mensch sieht dieses Feld nicht. Ist es ausgefuellt -> Bot.
// Wir melden "ok", damit der Bot kein Feedback bekommt, senden aber nichts.
if ($website !== '') {
    ok();
}

// ---------- Spam-Schutz 2: Zeit-Falle ------------------------------
if ($elapsed > 0 && $elapsed < MIN_ELAPSED_MS) {
    // Zu schnell abgeschickt -- vermutlich automatisiert.
    ok();   // wieder still "ok", kein Hinweis fuer Bots
}

// ---------- Grundvalidierung ---------------------------------------
if ($message === '') {
    fail('Bitte schreibe eine Nachricht.');
}
if (mb_strlen($message) > MAX_LEN || mb_strlen($name) > 200) {
    fail('Nachricht ist zu lang.');
}
// E-Mail ist optional. Wenn angegeben, muss sie plausibel sein.
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    fail('Die E-Mail-Adresse sieht nicht gueltig aus.');
}

// ---------- Header-Injection verhindern ----------------------------
// Zeilenumbrueche in Feldern, die in Mail-Header wandern (Name, E-Mail),
// koennten zusaetzliche Header einschleusen. Entfernen.
function clean_header($s) {
    return trim(str_replace(["\r", "\n", "%0a", "%0d"], '', $s));
}
$name  = clean_header($name);
$email = clean_header($email);

// ---------- Spam-Schutz 3: Rate-Limit pro IP -----------------------
$ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
$rateDir = sys_get_temp_dir() . '/pbcp_rate';
if (!is_dir($rateDir)) { @mkdir($rateDir, 0700, true); }
$rateFile = $rateDir . '/' . sha1($ip) . '.txt';
$now = time();
$hits = [];
if (is_file($rateFile)) {
    $raw = @file_get_contents($rateFile);
    if ($raw !== false) {
        foreach (explode("\n", $raw) as $line) {
            $line = trim($line);
            if ($line !== '' && ctype_digit($line) && ($now - (int)$line) < 3600) {
                $hits[] = (int) $line;   // nur Eintraege der letzten Stunde behalten
            }
        }
    }
}
if (count($hits) >= MAX_PER_HOUR) {
    fail('Zu viele Nachrichten in kurzer Zeit. Bitte versuche es spaeter erneut.', 429);
}
$hits[] = $now;
@file_put_contents($rateFile, implode("\n", $hits), LOCK_EX);

// ---------- Mail zusammenbauen -------------------------------------
$isHw = ($type === 'hardware');
$subject = ($isHw ? '[PBC+ Hardware-Wunsch] ' : '[PBC+ Kontakt] ')
         . ($name !== '' ? $name : 'ohne Name');

$bodyLines = [];
$bodyLines[] = $isHw ? 'Neuer Hardware-Wunsch aus ' . $SITE
                     : 'Neue Kontaktnachricht aus ' . $SITE;
$bodyLines[] = str_repeat('-', 50);
$bodyLines[] = 'Name:   ' . ($name  !== '' ? $name  : '(keiner)');
$bodyLines[] = 'E-Mail: ' . ($email !== '' ? $email : '(keine angegeben)');
$bodyLines[] = 'Typ:    ' . ($isHw ? 'Hardware-Wunsch' : 'Kontakt');
$bodyLines[] = 'Zeit:   ' . date('Y-m-d H:i:s');
$bodyLines[] = 'IP:     ' . $ip;
$bodyLines[] = str_repeat('-', 50);
$bodyLines[] = '';
$bodyLines[] = $message;
$body = implode("\n", $bodyLines);

// Header. From MUSS auf der eigenen Domain liegen. Reply-To auf die
// Adresse des Absenders, damit man direkt antworten kann (falls angegeben).
$headers = [];
$headers[] = 'From: ' . $SITE . ' <' . $FROM . '>';
if ($email !== '') {
    $headers[] = 'Reply-To: ' . $email;
}
$headers[] = 'Content-Type: text/plain; charset=utf-8';
$headers[] = 'X-Mailer: PHP/' . phpversion();

$sent = @mail($TO, '=?UTF-8?B?' . base64_encode($subject) . '?=', $body,
              implode("\r\n", $headers));

if ($sent) {
    ok();
} else {
    fail('Die Nachricht konnte nicht versendet werden. Bitte spaeter erneut versuchen.', 500);
}
