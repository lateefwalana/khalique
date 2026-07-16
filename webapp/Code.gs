/**
 * Khalique Homoeopathic Clinic — patient register web app.
 *
 * This script is bound to the register spreadsheet and uses it as the database.
 * The sheet stays readable on its own: if this app is ever turned off, every
 * record is still sitting in the Patients and Visits tabs.
 */

const CLINIC = {
  name: 'Khalique Homoeopathic Clinic',
  address: 'Circular Road, Lalu Wala, Bhera, Sargodha',
  reg: 'PHC Reg. No: PHC/R&L/2026/13527',
};

const PATIENTS_SHEET = 'Patients';
const VISITS_SHEET = 'Visits';

// Column numbers (1-indexed) on the Patients tab.
const P = {
  ref: 1, date: 2, time: 3, name: 4, occupation: 5, mobile: 6, address: 7,
  familyHistory: 8, sex: 9, age: 10, weight: 11, bp: 12, pulse: 13, temp: 14,
  symptoms: 15, clinicalReports: 16, allergies: 17, causation: 18,
  location: 19, constitution: 20, sensation: 21, modality: 22,
};
const P_LAST_COL = 22;

// Column numbers on the Visits tab. visitNo, patientName and the hidden helper
// in column G are spreadsheet formulas — the app must never overwrite them.
const V = { ref: 1, date: 2, visitNo: 3, name: 4, condition: 5, remedy: 6 };
const V_LAST_COL = 7;

const PATIENT_FIELDS = [
  'date', 'time', 'name', 'occupation', 'mobile', 'address', 'familyHistory',
  'sex', 'age', 'weight', 'bp', 'pulse', 'temp', 'symptoms', 'clinicalReports',
  'allergies', 'causation', 'location', 'constitution', 'sensation', 'modality',
];

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle(CLINIC.name)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Public — only the clinic's name and address, shown on the sign-in page. */
function getClinic() {
  return CLINIC;
}

// ─────────────────────── OFFLINE DESKTOP APP SYNC ───────────────────────
//
// The Windows desktop app is the doctor's working register and the only writer.
// When it is online it POSTs whatever changed to this endpoint, which mirrors it
// into the Sheet as an off-site backup. Authenticated with the same password as
// the web UI; no Google credentials live on the doctor's machine.

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function checkSyncPassword_(pass) {
  initAuth_();
  const p = props_();
  return hash_(pass || '', p.getProperty('AUTH_SALT')) === p.getProperty('AUTH_HASH');
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);

    // Desktop backup app: password-authenticated, mirrors records into the Sheet.
    if (body.action === 'push') {
      if (!checkSyncPassword_(body.password)) {
        return jsonOut_({ ok: false, error: 'Wrong password' });
      }
      return jsonOut_(pushFromDesktop_(body.patients || [], body.visits || []));
    }

    // GitHub Pages frontend: a different origin, so it cannot use google.script.run.
    // It POSTs JSON here instead, authenticated with a Google ID token + allowlist.
    // (See Api.gs.) handleApiPost_ throws on any failure; the catch turns that into
    // a JSON error the browser can read.
    return jsonOut_(handleApiPost_(body));
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err && err.message || err) });
  }
}

/**
 * Upsert patients by Ref.No and append visits. Date/time/mobile columns are
 * forced to text first, so the doctor's own notation ("17/5/20", leading-zero
 * mobiles) is stored verbatim rather than re-interpreted by Sheets.
 */
function pushFromDesktop_(patients, visits) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ps = sheet_(PATIENTS_SHEET);
    const vs = sheet_(VISITS_SHEET);

    // existing Ref.No -> row
    const pLastReal = firstEmptyRow_(ps, P.ref) - 1;
    const refRows = {};
    if (pLastReal >= 2) {
      const refs = ps.getRange(2, P.ref, pLastReal - 1, 1).getValues();
      for (let i = 0; i < refs.length; i++) {
        const n = Number(refs[i][0]);
        if (!isNaN(n)) refRows[n] = i + 2;
      }
    }

    const acceptedRefs = [];
    let nextRow = firstEmptyRow_(ps, P.ref);
    for (const p of patients) {
      const ref = Number(p.ref);
      const row = refRows.hasOwnProperty(ref) ? refRows[ref] : nextRow++;
      const vals = [ref];
      PATIENT_FIELDS.forEach(function (f) { vals.push(p[f] == null ? '' : String(p[f])); });
      const range = ps.getRange(row, P.ref, 1, P_LAST_COL);
      // text-guard date(2), time(3), mobile(6)
      ps.getRange(row, P.date).setNumberFormat('@');
      ps.getRange(row, P.time).setNumberFormat('@');
      ps.getRange(row, P.mobile).setNumberFormat('@');
      range.setValues([vals]);
      refRows[ref] = row;
      acceptedRefs.push(ref);
    }

    // append visits (Ref.No + Date in A:B, Condition + Remedy in E:F; C/D/G are formulas)
    const acceptedIds = [];
    let vRow = firstEmptyRow_(vs, V.ref);
    for (const v of visits) {
      vs.getRange(vRow, V.date).setNumberFormat('@');
      vs.getRange(vRow, V.ref).setValue(Number(v.ref));
      vs.getRange(vRow, V.date).setValue(String(v.date || ''));
      vs.getRange(vRow, V.condition).setValue(String(v.condition || ''));
      vs.getRange(vRow, V.remedy).setValue(String(v.remedy || ''));
      if (!vs.getRange(vRow, V.visitNo).getFormula()) {
        vs.getRange(vRow, V.visitNo).setFormula('=IF($A' + vRow + '="","",COUNTIF($A$2:$A' + vRow + ',$A' + vRow + '))');
        vs.getRange(vRow, V.name).setFormula(
          '=IF($A' + vRow + '="","",IFERROR(VLOOKUP($A' + vRow + ',Patients!$A:$D,4,FALSE),"— not found —"))');
      }
      if (v.id != null) acceptedIds.push(Number(v.id));
      vRow++;
    }

    SpreadsheetApp.flush();
    return { ok: true, patientRefs: acceptedRefs, visitIds: acceptedIds };
  } finally {
    lock.releaseLock();
  }
}

// ─────────────────────────── SIGN-IN ───────────────────────────
//
// The password is checked HERE, on the server, and every data function below
// demands a valid session token. A check done only in the browser would be
// decoration: anyone who can load the page can open the developer console and
// call searchPatients() directly. This cannot be walked around that way.
//
// The password itself is never in this file — it lives in Script Properties
// (Project Settings ▸ Script properties), stored as a salted SHA-256 hash, and
// can be changed from inside the app.

const SESSION_HOURS = 8;
const DEFAULT_USER = 'admin';
const DEFAULT_PASS = 'admin';

function props_() {
  return PropertiesService.getScriptProperties();
}

function hash_(text, salt) {
  const raw = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, String(salt) + '|' + String(text), Utilities.Charset.UTF_8);
  return raw.map(function (b) {
    return ('0' + (b < 0 ? b + 256 : b).toString(16)).slice(-2);
  }).join('');
}

/** Seed the credential on first use so a fresh install can be signed into. */
function initAuth_() {
  const p = props_();
  if (!p.getProperty('AUTH_SALT')) p.setProperty('AUTH_SALT', Utilities.getUuid());
  if (!p.getProperty('AUTH_USER')) p.setProperty('AUTH_USER', DEFAULT_USER);
  if (!p.getProperty('AUTH_HASH')) {
    p.setProperty('AUTH_HASH', hash_(DEFAULT_PASS, p.getProperty('AUTH_SALT')));
    p.setProperty('AUTH_IS_DEFAULT', 'yes');   // drives the "change your password" warning
  }
}

const MAX_TRIES = 8;          // failed sign-ins before a cool-off
const LOCKOUT_MINUTES = 15;

function login(user, pass) {
  initAuth_();
  const p = props_();
  const cache = CacheService.getScriptCache();

  // Crude but real brake on someone grinding passwords against a public URL.
  const fails = Number(cache.get('failcount') || 0);
  if (fails >= MAX_TRIES) {
    throw new Error('Too many failed attempts. Try again in ' + LOCKOUT_MINUTES + ' minutes.');
  }
  Utilities.sleep(500);

  const okUser = String(user || '').trim().toLowerCase() === String(p.getProperty('AUTH_USER')).toLowerCase();
  const okPass = hash_(pass || '', p.getProperty('AUTH_SALT')) === p.getProperty('AUTH_HASH');
  if (!okUser || !okPass) {
    cache.put('failcount', String(fails + 1), LOCKOUT_MINUTES * 60);
    throw new Error('Wrong username or password / غلط نام یا پاس ورڈ');
  }
  cache.remove('failcount');

  const token = Utilities.getUuid();
  cache.put('sess_' + token, 'ok', SESSION_HOURS * 3600);
  return JSON.stringify({
    token: token,
    mustChangePassword: p.getProperty('AUTH_IS_DEFAULT') === 'yes',
    clinic: CLINIC,
  });
}

/** Is this a live session? Enough to change the password, not to read records. */
function requireSession_(token) {
  if (!token || CacheService.getScriptCache().get('sess_' + token) !== 'ok') {
    throw new Error('Session expired — please sign in again / دوبارہ سائن ان کریں');
  }
}

/**
 * Guards every function that touches patient data.
 *
 * Note the second check: while the password is still the factory 'admin', NO
 * patient data is served at all. The URL may be public, so a default password
 * must not be a way in — it only gets you as far as the change-password screen.
 */
function requireAuth_(token) {
  requireSession_(token);
  if (props_().getProperty('AUTH_IS_DEFAULT') === 'yes') {
    throw new Error('Set a password before using the register / پہلے پاس ورڈ بنائیں');
  }
}

function logout(token) {
  if (token) CacheService.getScriptCache().remove('sess_' + token);
  return true;
}

function changePassword(token, oldPass, newPass) {
  requireSession_(token);   // deliberately NOT requireAuth_ — this is how you escape the default
  const p = props_();
  if (hash_(oldPass || '', p.getProperty('AUTH_SALT')) !== p.getProperty('AUTH_HASH')) {
    throw new Error('Current password is wrong / موجودہ پاس ورڈ غلط ہے');
  }
  const np = String(newPass || '');
  if (np.length < 8) {
    throw new Error('Password must be at least 8 characters / کم از کم 8 حروف');
  }
  if (np.toLowerCase() === 'admin' || np.toLowerCase() === 'password') {
    throw new Error('Choose a less obvious password / زیادہ مضبوط پاس ورڈ چنیں');
  }
  p.setProperty('AUTH_HASH', hash_(np, p.getProperty('AUTH_SALT')));
  p.setProperty('AUTH_IS_DEFAULT', 'no');
  return true;
}

function sheet_(name) {
  const s = SpreadsheetApp.getActive().getSheetByName(name);
  if (!s) throw new Error('Sheet "' + name + '" not found. Is this script attached to the register?');
  return s;
}

function tz_() {
  return SpreadsheetApp.getActive().getSpreadsheetTimeZone() || Session.getScriptTimeZone();
}

/** Dates come back from the sheet as Date objects; send plain strings to the browser. */
function fmtDate_(v) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, tz_(), 'dd/MM/yyyy');
  }
  return String(v);
}

/**
 * Flatten one cell to a string or number for the browser.
 *
 * Sheets quietly reinterprets some text as a date — a time typed as "16:11"
 * comes back as a Date object, not the string that was written. Handing such a
 * value to google.script.run makes the whole payload fail to serialise and the
 * client receives null, with no error anywhere. So nothing leaves this file
 * until it is a plain string or number.
 */
function cellText_(v, field) {
  if (v === null || v === undefined || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, tz_(), field === 'time' ? 'HH:mm' : 'dd/MM/yyyy');
  }
  if (typeof v === 'number' || typeof v === 'string') return v;
  return String(v);
}

/**
 * Build the date at MIDDAY, not midnight.
 *
 * A midnight Date written into a spreadsheet whose timezone sits behind the
 * script's rolls back into the previous day — every visit would be filed one
 * day early. Midday leaves ~12 hours of slack in both directions, so the
 * calendar date survives any timezone offset.
 */
function parseDate_(s) {
  let d;
  if (s) {
    const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/); // the date input gives yyyy-mm-dd
    d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(s);
    if (isNaN(d.getTime())) d = new Date();
  } else {
    d = new Date();
  }
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
}

/**
 * The register ships with formulas pre-filled down every row, so getLastRow()
 * points at the bottom of the formula block rather than the last real record.
 * Find the first row whose key column is genuinely empty instead.
 */
function firstEmptyRow_(sheet, keyCol) {
  const last = Math.max(sheet.getLastRow(), 1);
  if (last < 2) return 2;
  const values = sheet.getRange(2, keyCol, last - 1, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    if (values[i][0] === '' || values[i][0] === null) return i + 2;
  }
  return last + 1;
}

function readPatients_() {
  const sh = sheet_(PATIENTS_SHEET);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const rows = sh.getRange(2, 1, last - 1, P_LAST_COL).getValues();
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r[P.name - 1]) continue; // formula-only row, no patient yet
    const p = { row: i + 2, ref: Number(r[P.ref - 1]) };
    PATIENT_FIELDS.forEach(function (f) {
      p[f] = cellText_(r[P[f] - 1], f);
    });
    out.push(p);
  }
  return out;
}

/** Search by name, mobile or reference number. Empty query returns the most recent. */
function project_(p) {
  return { ref: p.ref, name: p.name, mobile: p.mobile, age: p.age, sex: p.sex, address: p.address };
}

/**
 * Ranked search. Results are ordered by how well they match, not just by Ref.No,
 * so typing "3" puts patient 3 at the very top instead of burying it under 13,
 * 30, 33... The tiers (best first):
 *   0  Ref.No is exactly the query        (3 -> patient 3)
 *   1  Ref.No starts with the query       (3 -> 30, 31, 300...)
 *   2  name starts with the query
 *   3  name contains the query
 *   4  mobile matches — but only once at least 3 digits are typed, otherwise a
 *      lone "3" would drag in every phone number that happens to contain a 3.
 * Within a tier, the most recent patient (highest Ref.No) comes first.
 */
function searchPatients(token, query) {
  requireAuth_(token);
  return searchPatientsCore_(query);
}

function searchPatientsCore_(query) {
  const all = readPatients_();
  const q = String(query || '').trim().toLowerCase();

  if (!q) {
    return all.slice()
      .sort(function (a, b) { return Number(b.ref) - Number(a.ref); })
      .slice(0, 50).map(project_);
  }

  const qDigits = q.replace(/\D/g, '');
  const scored = [];
  for (let i = 0; i < all.length; i++) {
    const p = all[i];
    const ref = String(p.ref).toLowerCase();
    const name = String(p.name).toLowerCase();
    const mob = String(p.mobile).toLowerCase().replace(/\s/g, '');

    let rank = -1;
    if (ref === q) rank = 0;
    else if (ref.indexOf(q) === 0) rank = 1;
    else if (name.indexOf(q) === 0) rank = 2;
    else if (name.indexOf(q) !== -1) rank = 3;
    else if (qDigits.length >= 3 && mob.indexOf(qDigits) !== -1) rank = 4;

    if (rank !== -1) scored.push({ p: p, rank: rank });
  }

  scored.sort(function (a, b) {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return Number(b.p.ref) - Number(a.p.ref);
  });

  return scored.slice(0, 50).map(function (s) { return project_(s.p); });
}

function readVisitsFor_(ref) {
  const sh = sheet_(VISITS_SHEET);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const rows = sh.getRange(2, 1, last - 1, V_LAST_COL).getValues();
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r[V.ref - 1] === '' || r[V.ref - 1] === null) continue;
    if (Number(r[V.ref - 1]) !== Number(ref)) continue;
    out.push({
      row: i + 2,
      visitNo: Number(r[V.visitNo - 1]) || '',
      date: cellText_(r[V.date - 1], 'date'),
      condition: cellText_(r[V.condition - 1]),
      remedy: cellText_(r[V.remedy - 1]),
    });
  }
  out.sort(function (a, b) { return Number(a.visitNo) - Number(b.visitNo); });
  return out;
}

/**
 * Returned as a JSON string, not an object. google.script.run's own
 * serialisation gives the client a bare null when it dislikes any value in the
 * payload, and reports nothing — a string can't fail that way.
 */
function getPatient(token, ref) {
  requireAuth_(token);
  return JSON.stringify(getPatientCore_(ref));
}

function getPatientCore_(ref) {
  const all = readPatients_();
  let found = null;
  for (let i = 0; i < all.length; i++) {
    if (Number(all[i].ref) === Number(ref)) { found = all[i]; break; }
  }
  if (!found) throw new Error('Patient ' + ref + ' not found.');
  return { patient: found, visits: readVisitsFor_(found.ref), clinic: CLINIC };
}

/**
 * The next reference number: one above the highest already in the register.
 *
 * Ref.No used to be a formula (=ROW()-1). That had to go once the clinic's
 * historical paper records were imported — those carry the doctor's OWN numbers
 * (001, 258, 324...), written on the forms and used to find the paper file. Tying
 * the number to a row position would have overwritten them. It is now a real
 * value, and new patients continue from the top of his existing sequence.
 */
function nextRef_(sh) {
  const last = sh.getLastRow();
  if (last < 2) return 1;
  const refs = sh.getRange(2, P.ref, last - 1, 1).getValues();
  let max = 0;
  for (let i = 0; i < refs.length; i++) {
    const n = Number(refs[i][0]);
    if (!isNaN(n) && n > max) max = n;
  }
  return max + 1;
}

function savePatient(token, data) {
  requireAuth_(token);
  return savePatientCore_(data);
}

function savePatientCore_(data) {
  if (!data || !String(data.name || '').trim()) throw new Error('Patient name is required.');

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = sheet_(PATIENTS_SHEET);
    const row = firstEmptyRow_(sh, P.name);
    const ref = nextRef_(sh);

    const values = [];
    for (let c = P.date; c <= P_LAST_COL; c++) values.push('');
    PATIENT_FIELDS.forEach(function (f) {
      values[P[f] - P.date] = f === 'date' ? parseDate_(data.date) : (data[f] || '');
    });
    if (!data.time) values[P.time - P.date] = Utilities.formatDate(new Date(), tz_(), 'HH:mm');

    sh.getRange(row, P.ref).setValue(ref);
    sh.getRange(row, P.date, 1, P_LAST_COL - P.date + 1).setValues([values]);

    SpreadsheetApp.flush();
    return { ref: ref };
  } finally {
    lock.releaseLock();
  }
}

function updatePatient(token, ref, data) {
  requireAuth_(token);
  return updatePatientCore_(ref, data);
}

function updatePatientCore_(ref, data) {
  if (!data || !String(data.name || '').trim()) throw new Error('Patient name is required.');

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const all = readPatients_();
    let target = null;
    for (let i = 0; i < all.length; i++) {
      if (Number(all[i].ref) === Number(ref)) { target = all[i]; break; }
    }
    if (!target) throw new Error('Patient ' + ref + ' not found.');

    const sh = sheet_(PATIENTS_SHEET);
    const values = [];
    for (let c = P.date; c <= P_LAST_COL; c++) values.push('');
    PATIENT_FIELDS.forEach(function (f) {
      values[P[f] - P.date] = f === 'date' ? parseDate_(data.date) : (data[f] || '');
    });
    sh.getRange(target.row, P.date, 1, P_LAST_COL - P.date + 1).setValues([values]);
    SpreadsheetApp.flush();
    return { ref: Number(ref) };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Add a visit. Visit # and patient name are formulas on the sheet, so only
 * Ref.No, Date, Condition and Remedy are written.
 */
function saveVisit(token, data) {
  requireAuth_(token);
  return JSON.stringify(saveVisitCore_(data));
}

function saveVisitCore_(data) {
  if (!data || !data.ref) throw new Error('No patient selected.');
  if (!String(data.remedy || '').trim() && !String(data.condition || '').trim()) {
    throw new Error('Enter the condition or the remedy before saving.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = sheet_(VISITS_SHEET);
    const row = firstEmptyRow_(sh, V.ref);

    sh.getRange(row, V.ref).setValue(Number(data.ref));
    sh.getRange(row, V.date).setValue(parseDate_(data.date));
    sh.getRange(row, V.condition).setValue(data.condition || '');
    sh.getRange(row, V.remedy).setValue(data.remedy || '');

    // Restore the formulas if this row sits below the pre-filled block.
    if (!sh.getRange(row, V.visitNo).getFormula()) {
      sh.getRange(row, V.visitNo).setFormula('=IF($A' + row + '="","",COUNTIF($A$2:$A' + row + ',$A' + row + '))');
      sh.getRange(row, V.name).setFormula(
        '=IF($A' + row + '="","",IFERROR(VLOOKUP($A' + row + ',Patients!$A:$D,4,FALSE),"— not found —"))');
    }

    SpreadsheetApp.flush();
    return { ok: true, visits: readVisitsFor_(data.ref) };
  } finally {
    lock.releaseLock();
  }
}
