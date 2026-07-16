/**
 * JSON API for the GitHub Pages frontend.
 *
 * The Apps Script–hosted web app (Index.html) is same-origin and calls server
 * functions directly with google.script.run. The GitHub Pages frontend is a
 * DIFFERENT origin, so it can't — it POSTs JSON to doPost (in Code.gs), which
 * routes any non-"push" action here.
 *
 * Auth is NOT the username/password model used by Index.html. The page is public
 * (it must be, to be served from github.io), so the door is Google Sign-In: the
 * browser signs the user in with Google and sends the resulting ID token on every
 * request. This file verifies that token with Google and checks the email against
 * an allowlist. The check is done HERE, on the server — a check in the browser
 * would be decoration, since anyone can POST to the URL directly.
 *
 * ── One-time server setup (Project Settings ▸ Script properties) ──
 *   OAUTH_CLIENT_ID   the Web OAuth 2.0 client id the frontend signs in with
 *                     (looks like 1234567890-abc.apps.googleusercontent.com)
 *   ALLOWED_EMAILS    who may use the app — emails separated by comma / space /
 *                     newline, e.g.  doctor@gmail.com, reception@gmail.com
 *
 * The Apps Script deployment must be set to "Who has access: Anyone" so the public
 * page can reach it. That is safe here: this token + allowlist check is the door,
 * not Google's sign-in wall.
 */

var OAUTH_CLIENT_ID_PROP = 'OAUTH_CLIENT_ID';
var ALLOWED_EMAILS_PROP = 'ALLOWED_EMAILS';

/**
 * Routes one API request. Returns a plain object (doPost wraps it as JSON).
 * Throws on any failure — doPost's catch turns that into { ok:false, error }.
 */
function handleApiPost_(body) {
  var action = body.action;

  // "ping" needs no auth: it exists only to prove the cross-origin round-trip
  // works (CORS) before any real feature depends on it. It returns no data.
  if (action === 'ping') {
    return { ok: true, pong: true, configured: apiIsConfigured_() };
  }

  // Everything past here requires a signed-in, allowlisted Google account.
  var email = verifyIdToken_(body.idToken);

  switch (action) {
    case 'whoami':
      return { ok: true, email: email, clinic: CLINIC };
    case 'search':
      return { ok: true, results: searchPatientsCore_(body.query) };
    case 'getPatient':
      return { ok: true, data: getPatientCore_(body.ref) };
    case 'savePatient':
      return { ok: true, result: savePatientCore_(body.data) };
    case 'updatePatient':
      return { ok: true, result: updatePatientCore_(body.ref, body.data) };
    case 'saveVisit':
      return { ok: true, data: saveVisitCore_(body.data) };
    default:
      throw new Error('Unknown action: ' + action);
  }
}

/** True once both Script Properties are set — surfaced by ping for diagnostics. */
function apiIsConfigured_() {
  var p = props_();
  return !!p.getProperty(OAUTH_CLIENT_ID_PROP) && !!p.getProperty(ALLOWED_EMAILS_PROP);
}

/**
 * Verify a Google ID token and return the signed-in email, or throw.
 *
 * Google's tokeninfo endpoint checks the token's signature and expiry for us and
 * returns 200 only for a currently-valid token. We still must confirm two things
 * ourselves: that the token was minted for THIS app (aud === our client id — a
 * token issued to some other site must not be accepted), and that the email is
 * verified and on the allowlist.
 */
function verifyIdToken_(idToken) {
  if (!idToken) throw new Error('Not signed in / سائن ان کریں');

  var clientId = props_().getProperty(OAUTH_CLIENT_ID_PROP);
  if (!clientId) throw new Error('Server not set up: OAUTH_CLIENT_ID is missing.');

  var resp = UrlFetchApp.fetch(
    'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
    { muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) {
    throw new Error('Sign-in expired — please sign in again / دوبارہ سائن ان کریں');
  }

  var info = JSON.parse(resp.getContentText());
  if (info.aud !== clientId) throw new Error('This sign-in was not issued for this app.');
  if (String(info.email_verified) !== 'true') throw new Error('Your Google email is not verified.');

  var email = String(info.email || '').toLowerCase();
  if (!isEmailAllowed_(email)) {
    throw new Error('Access denied: ' + email + ' is not on the allowed list.');
  }
  return email;
}

/** Is this email on the allowlist? Case-insensitive; comma / space / newline separated. */
function isEmailAllowed_(email) {
  var raw = props_().getProperty(ALLOWED_EMAILS_PROP) || '';
  var list = raw.toLowerCase().split(/[\s,;]+/).filter(function (s) { return s; });
  return list.indexOf(String(email).toLowerCase()) !== -1;
}
