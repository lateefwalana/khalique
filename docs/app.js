/**
 * Khalique Homoeopathic Clinic — GitHub Pages frontend.
 *
 * This is the same register as the Apps Script web app, but hosted as a static
 * site on a different origin. Two things differ from Index.html:
 *
 *   1. Transport. It can't use google.script.run (that only works same-origin).
 *      Every call is a POST to the Apps Script /exec URL — see api().
 *   2. Auth. No username/password. The user signs in with Google; the resulting
 *      ID token rides on every request and the server checks it against an
 *      email allowlist. See onCredential().
 */

var ID_TOKEN = null;   // Google ID token (a JWT); sent on every data call
var PROFILE = null;    // decoded {email,name,...} for display only — never trusted

var FIELDS = ['date','time','name','occupation','mobile','address','familyHistory','sex','age',
              'weight','bp','pulse','temp','symptoms','clinicalReports','allergies','causation',
              'location','constitution','sensation','modality'];

var LABELS = {
  date:'Date / تاریخ', time:'Time / وقت', occupation:'Occupation / پیشہ',
  mobile:'Mobile / موبائل', address:'Address / پتہ', familyHistory:'Family History / خاندانی امراض',
  sex:'Sex / جنس', age:'Age / عمر', weight:'Weight / وزن', bp:'B.P / بلڈ پریشر',
  pulse:'Pulse / نبض', temp:'Temp / درجہ حرارت', symptoms:'Symptoms / علامات',
  clinicalReports:'Clinical Reports / کلینیکل رپورٹس', allergies:'Allergies / الرجی',
  causation:'Causation / سبب', location:'Location / مقام', constitution:'Constitution / مزاج',
  sensation:'Sensation / احساس', modality:'Modality / موڈیلٹی'
};

var current = null;
var editingRef = null;

// ─────────────────────────── transport ───────────────────────────
//
// The one delicate part of talking to Apps Script from another origin: the
// request must be a "simple" CORS request or the browser fires a preflight
// OPTIONS that Apps Script cannot answer. So — POST, Content-Type text/plain,
// and NO custom headers (the auth token travels in the body, not an
// Authorization header). The JSON reply comes back readable.

function api(action, extra) {
  var body = Object.assign({ action: action }, extra || {});
  if (action !== 'ping') {
    if (!ID_TOKEN) return Promise.reject(new Error('Session expired — please sign in again'));
    body.idToken = ID_TOKEN;
  }
  return fetch(CONFIG.EXEC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
    redirect: 'follow'
  }).then(function (resp) {
    return resp.text().then(function (text) {
      var json;
      try { json = JSON.parse(text); }
      catch (e) {
        throw new Error('The server sent an unexpected reply. Is the web-app URL correct and deployed to "Anyone"?');
      }
      if (!json.ok) throw new Error(json.error || 'Request failed');
      return json;
    });
  }, function () {
    throw new Error('Could not reach the server. Check the internet connection.');
  });
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function toast(msg, isErr) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (isErr ? ' err' : '');
  setTimeout(function(){ t.className = 'toast'; }, isErr ? 5000 : 2500);
}

/** Auth failures kick back to the sign-in screen; everything else is a toast. */
function failed(e) {
  var msg = (e && e.message) ? e.message : String(e);
  if (/sign.?in|not signed in|session expired|allowed list|access denied/i.test(msg)) {
    signOut(msg);
    return;
  }
  toast(msg, true);
}

function today() {
  var d = new Date(), p = function(n){ return (n < 10 ? '0' : '') + n; };
  return d.getFullYear() + '-' + p(d.getMonth()+1) + '-' + p(d.getDate());
}

function showView(name) {
  ['search','patient','form'].forEach(function(v){
    document.getElementById('view-' + v).classList.toggle('active', v === name);
  });
  document.getElementById('tabSearch').classList.toggle('active', name === 'search');
  document.getElementById('tabNew').classList.toggle('active', name === 'form');
  window.scrollTo(0, 0);
}

// ─────────────────────────── Google Sign-In ───────────────────────────

/** Decode a JWT payload for display only (email, name). Not a security check. */
function decodeJwt(jwt) {
  try {
    var part = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(escape(atob(part))));
  } catch (e) { return {}; }
}

/** Called by Google Identity Services once the user picks an account. */
function onCredential(response) {
  ID_TOKEN = response.credential;
  PROFILE = decodeJwt(ID_TOKEN);

  document.getElementById('loginErr').style.display = 'none';
  document.getElementById('gbtn').style.display = 'none';
  document.getElementById('signinBusy').style.display = 'block';

  // whoami both proves the token is good AND enforces the allowlist server-side.
  api('whoami', {}).then(function (res) {
    document.getElementById('signinBusy').style.display = 'none';
    startApp(res.clinic);
  }).catch(function (e) {
    ID_TOKEN = null; PROFILE = null;
    document.getElementById('signinBusy').style.display = 'none';
    document.getElementById('gbtn').style.display = 'block';
    var err = document.getElementById('loginErr');
    err.textContent = e.message;
    err.style.display = 'block';
    if (window.google && google.accounts) google.accounts.id.disableAutoSelect();
  });
}

function startApp(clinic) {
  document.getElementById('clinicName').textContent = clinic.name;
  document.getElementById('clinicAddr').textContent = clinic.address;
  document.getElementById('clinicReg').textContent  = clinic.reg;
  document.getElementById('pcName').textContent = clinic.name;
  document.getElementById('pcAddr').textContent = clinic.address;
  document.getElementById('pcReg').textContent  = clinic.reg;

  document.getElementById('view-login').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  showView('search');
  runSearch();
}

function signOut(reason) {
  if (window.google && google.accounts) google.accounts.id.disableAutoSelect();
  ID_TOKEN = null; PROFILE = null; current = null;
  document.getElementById('app').style.display = 'none';
  document.getElementById('view-login').style.display = 'flex';
  document.getElementById('gbtn').style.display = 'block';
  document.getElementById('results').innerHTML = '';
  var err = document.getElementById('loginErr');
  if (reason) { err.textContent = reason; err.style.display = 'block'; }
  else { err.style.display = 'none'; }
}

/** Sets up the Google button once the GIS library has loaded. */
function initGoogleSignIn() {
  if (!window.google || !google.accounts || !google.accounts.id) {
    setTimeout(initGoogleSignIn, 120);   // library still downloading
    return;
  }
  if (!CONFIG.CLIENT_ID || CONFIG.CLIENT_ID.indexOf('PASTE') === 0) {
    var note = document.getElementById('setupNote');
    note.innerHTML = 'Not configured yet: set <code>CLIENT_ID</code> and <code>EXEC_URL</code> in <code>config.js</code> (see SETUP.md).';
    note.style.display = 'block';
    return;
  }
  google.accounts.id.initialize({
    client_id: CONFIG.CLIENT_ID,
    callback: onCredential,
    auto_select: true,
    cancel_on_tap_outside: false
  });
  google.accounts.id.renderButton(document.getElementById('gbtn'), {
    theme: 'filled_blue', size: 'large', text: 'signin_with', shape: 'pill', width: 260
  });
  google.accounts.id.prompt();   // offer one-tap / auto sign-in
}

// ─────────────────────────── search ───────────────────────────
var searchTimer = null;

function runSearch() {
  if (!ID_TOKEN) return;
  var q = document.getElementById('q').value;
  document.getElementById('results').innerHTML = '<div class="empty">Searching…</div>';
  api('search', { query: q }).then(function (res) {
    renderResults(res.results);
  }).catch(function (e) {
    document.getElementById('results').innerHTML = '<div class="empty">' + esc(e.message) + '</div>';
    failed(e);
  });
}

function renderResults(list) {
  var box = document.getElementById('results');
  if (!list || !list.length) {
    box.innerHTML = '<div class="empty">No patients found. / کوئی مریض نہیں ملا۔</div>';
    return;
  }
  box.innerHTML = list.map(function(p){
    var sub = [p.age ? 'Age ' + esc(p.age) : '', esc(p.sex), esc(p.mobile)]
      .filter(Boolean).join(' · ');
    return '<div class="result" data-ref="' + Number(p.ref) + '">'
      + '<div class="ref">' + esc(p.ref) + '</div>'
      + '<div class="who"><div class="nm">' + esc(p.name) + '</div>'
      + '<div class="sub">' + sub + '</div></div>'
      + '<div style="color:#B9C4BF">›</div></div>';
  }).join('');

  var rows = box.querySelectorAll('.result');
  for (var i = 0; i < rows.length; i++) {
    (function(row){
      row.addEventListener('click', function(){
        openPatient(Number(row.getAttribute('data-ref')));
      });
    })(rows[i]);
  }
}

// ─────────────────────────── patient ───────────────────────────
function openPatient(ref) {
  toast('Opening…');
  api('getPatient', { ref: ref }).then(function (res) {
    current = res.data.patient;
    renderPatient(res.data.patient, res.data.visits);
    hideAddVisit();
    showView('patient');
  }).catch(failed);
}

function renderPatient(p, visits) {
  document.getElementById('ptName').textContent = p.name;
  document.getElementById('ptRef').textContent = 'Ref.No ' + p.ref;

  var keys = FIELDS.filter(function(f){ return f !== 'name'; });
  document.getElementById('ptDetails').innerHTML = keys.map(function(f){
    return '<div class="d"><div class="k">' + esc(LABELS[f]) + '</div>'
      + '<div class="v">' + esc(p[f]) + '</div></div>';
  }).join('');

  renderVisits(visits);
}

function renderVisits(visits) {
  var body = document.getElementById('ptVisits');
  if (!visits || !visits.length) {
    body.innerHTML = '<tr><td colspan="4" class="empty">No visits recorded yet. / ابھی کوئی وزٹ نہیں۔</td></tr>';
    return;
  }
  body.innerHTML = visits.map(function(v){
    return '<tr><td class="n">' + esc(v.visitNo) + '</td>'
      + '<td class="dt">' + esc(v.date) + '</td>'
      + '<td>' + esc(v.condition) + '</td>'
      + '<td>' + esc(v.remedy) + '</td></tr>';
  }).join('');
}

// ─────────────────────────── add visit ───────────────────────────
function showAddVisit() {
  document.getElementById('vDate').value = today();
  document.getElementById('vCondition').value = '';
  document.getElementById('vRemedy').value = '';
  document.getElementById('visitForm').style.display = 'block';
  document.getElementById('vCondition').focus();
}
function hideAddVisit() {
  document.getElementById('visitForm').style.display = 'none';
}

function saveVisit() {
  if (!current) return;
  var btn = document.getElementById('vSave');
  btn.disabled = true; btn.textContent = 'Saving…';
  api('saveVisit', { data: {
    ref: current.ref,
    date: document.getElementById('vDate').value,
    condition: document.getElementById('vCondition').value,
    remedy: document.getElementById('vRemedy').value
  }}).then(function (res) {
    btn.disabled = false; btn.textContent = 'Save Visit / محفوظ کریں';
    renderVisits(res.data.visits);
    hideAddVisit();
    toast('Visit saved / وزٹ محفوظ ہو گیا');
  }).catch(function (e) {
    btn.disabled = false; btn.textContent = 'Save Visit / محفوظ کریں';
    failed(e);
  });
}

// ─────────────────────────── patient form ───────────────────────────
function newPatient() {
  editingRef = null;
  document.getElementById('formTitle').textContent = 'New Patient / نیا مریض';
  FIELDS.forEach(function(f){ document.getElementById('f_' + f).value = ''; });
  document.getElementById('f_date').value = today();
  showView('form');
  document.getElementById('f_name').focus();
}

function editPatient() {
  if (!current) return;
  editingRef = current.ref;
  document.getElementById('formTitle').textContent =
    'Edit — ' + current.name + ' (Ref.No ' + current.ref + ')';
  FIELDS.forEach(function(f){
    document.getElementById('f_' + f).value = current[f] == null ? '' : current[f];
  });
  var d = String(current.date || '').split('/');   // sheet gives dd/MM/yyyy
  document.getElementById('f_date').value =
    d.length === 3 ? d[2] + '-' + d[1] + '-' + d[0] : today();
  showView('form');
}

function collectForm() {
  var data = {};
  FIELDS.forEach(function(f){ data[f] = document.getElementById('f_' + f).value; });
  return data;
}

function savePatient() {
  var data = collectForm();
  if (!data.name.trim()) { toast('Patient name is required / نام ضروری ہے', true); return; }

  var btn = document.getElementById('pSave');
  btn.disabled = true; btn.textContent = 'Saving…';

  var action = editingRef ? 'updatePatient' : 'savePatient';
  var payload = editingRef ? { ref: editingRef, data: data } : { data: data };

  api(action, payload).then(function (res) {
    btn.disabled = false; btn.textContent = 'Save Patient / محفوظ کریں';
    toast('Saved / محفوظ ہو گیا');
    openPatient(res.result.ref);
  }).catch(function (e) {
    btn.disabled = false; btn.textContent = 'Save Patient / محفوظ کریں';
    failed(e);
  });
}

function cancelForm() {
  if (editingRef && current) { openPatient(editingRef); }
  else { showView('search'); }
}

// ─────────────────────────── wiring ───────────────────────────
function on(id, ev, fn) {
  var el = document.getElementById(id);
  if (el) el.addEventListener(ev, fn);
}

on('btnLogout', 'click', function(){ signOut(''); });
on('tabSearch', 'click', function(){ showView('search'); });
on('tabNew', 'click', newPatient);
on('btnBackToSearch', 'click', function(){ showView('search'); });
on('btnAddVisit', 'click', showAddVisit);
on('btnEditPatient', 'click', editPatient);
on('btnPrint', 'click', function(){ window.print(); });
on('vSave', 'click', saveVisit);
on('vCancel', 'click', hideAddVisit);
on('btnFormBack', 'click', cancelForm);
on('pSave', 'click', savePatient);
on('pCancel', 'click', cancelForm);

on('q', 'input', function(){
  clearTimeout(searchTimer);
  searchTimer = setTimeout(runSearch, 250);
});

document.getElementById('pForm').addEventListener('submit', function(e){ e.preventDefault(); });

window.addEventListener('error', function(e){
  toast('Error: ' + (e.message || 'unknown'), true);
});

initGoogleSignIn();
