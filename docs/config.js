/**
 * Deployment settings for the GitHub Pages frontend.
 *
 * Both values below are PUBLIC by design — a Google OAuth client id and an Apps
 * Script web-app URL are meant to be seen by the browser. No password or secret
 * goes here. Access is controlled on the server by the email allowlist.
 *
 * Fill these in after following SETUP.md, then commit.
 */
window.CONFIG = {
  // The Apps Script web-app URL, ending in /exec
  // (Deploy ▸ Manage deployments ▸ copy the Web app URL).
  EXEC_URL: 'https://script.google.com/macros/s/AKfycbz3exr7_ihTiLxkO3yU2KuuLQhM_VDtBDa0J79I--sj4Ecnryk1OwRt1A5-fjyp12VL7A/exec',

  // The Web OAuth 2.0 Client ID from Google Cloud
  // (looks like 1234567890-abc123.apps.googleusercontent.com).
  CLIENT_ID: 'PASTE_YOUR_OAUTH_CLIENT_ID_HERE',
};
