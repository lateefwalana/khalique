# Khalique register — GitHub Pages frontend

A static version of the patient register, hosted free on GitHub Pages, talking to
the **same Google Sheet** through the existing Apps Script backend. It sits
alongside the Apps Script web app and the desktop app — nothing is replaced.

- **Frontend:** the files in this `docs/` folder, served by GitHub Pages.
- **Backend:** your Apps Script project (`Code.gs` + `Api.gs`), same Sheet.
- **Sign-in:** Google Sign-In. The page is public, so the real gate is an email
  **allowlist** checked on the server — only approved Google accounts get in.

Do the steps in order. Steps 1–3 stand up the backend; step 4 proves the
connection works *before* you fiddle with sign-in; steps 5–6 turn on auth.

---

## 1. Update the Apps Script backend

In the Sheet: **Extensions ▸ Apps Script**.

1. Open `Code.gs`, replace its contents with this repo's `webapp/Code.gs`.
2. **+** next to Files ▸ **Script** ▸ name it `Api` ▸ paste this repo's `webapp/Api.gs`.
3. Save (💾).

## 2. Deploy it so a webpage can reach it

The public page can only call the backend if the deployment is open to anyone
(the allowlist, not Google's login wall, is what protects the data).

- **Deploy ▸ Manage deployments ▸** pencil ✏️ on the active one **▸ New version**.
- Set **Who has access: `Anyone`** (this means anyone *anonymous* can POST — that's
  required, and safe, because every data call is checked against the allowlist).
- **Deploy**, and **copy the Web app URL** (ends in `/exec`). You need it twice below.

> If you have never deployed before: **Deploy ▸ New deployment ▸** type **Web app ▸
> Execute as: Me ▸ Who has access: Anyone ▸ Deploy**, then Allow the permissions.

## 3. Create the Google Sign-In client (Google Cloud)

You need a **web OAuth client ID** so the page can sign users in with Google.

1. Go to <https://console.cloud.google.com/>. Pick the project tied to this Sheet's
   Google account (or **New Project**, name it e.g. "Khalique Register").
2. **APIs & Services ▸ OAuth consent screen** (if not set up yet):
   - User type **External** ▸ Create.
   - App name "Khalique Clinic Register", your support email, your developer email ▸
     save through the pages. You do **not** need to publish or get verified — under
     "Test users" add the doctor's email (and any other staff email). Testing mode is
     fine for a handful of known users.
3. **APIs & Services ▸ Credentials ▸ Create credentials ▸ OAuth client ID**:
   - Application type **Web application**.
   - **Authorised JavaScript origins ▸ Add URI:** your GitHub Pages origin, e.g.
     `https://YOURNAME.github.io` (origin only — no path, no trailing slash).
     If the repo isn't `YOURNAME.github.io`, the origin is still just
     `https://YOURNAME.github.io` (the project path does not go here).
   - You can leave "Authorised redirect URIs" empty (Google Sign-In doesn't need it).
   - **Create**, and copy the **Client ID**
     (`…-….apps.googleusercontent.com`).

## 4. Configure and publish the frontend

1. Edit **`docs/config.js`**:
   - `EXEC_URL` → the `/exec` URL from step 2.
   - `CLIENT_ID` → the client ID from step 3.
2. Push this repo to GitHub, then **Settings ▸ Pages ▸ Build from a branch ▸
   `main` / `/docs`** ▸ Save. Wait a minute; note the published URL
   (`https://YOURNAME.github.io/…`).
3. **Prove the connection first:** open **`…/ping.html`** on the published site and
   click **Ping**.
   - ✓ green "CORS works" = backend reachable from the page. Good — continue.
   - ✗ or non-JSON = the deployment isn't `Anyone`, or the URL is wrong. Fix before
     going on (sign-in can't work until the round-trip does).

   It will also say *"not configured yet"* — expected until step 5.

## 5. Turn on the allowlist (server side)

In Apps Script: **Project Settings (⚙️) ▸ Script properties ▸ Add script property**,
twice:

| Property | Value |
|---|---|
| `OAUTH_CLIENT_ID` | the same client ID from step 3 |
| `ALLOWED_EMAILS`  | the Google emails allowed in, e.g. `doctor@gmail.com, reception@gmail.com` (comma / space / newline separated) |

Save. (No redeploy needed — script properties are read live.)

## 6. Sign in

Open the published site (`…/index.html`). Click **Sign in with Google**, choose an
allowlisted account. You should land on the search screen with the register.

- An account **not** on `ALLOWED_EMAILS` is refused with "Access denied" — that's
  the gate working.
- To add/remove staff later, just edit `ALLOWED_EMAILS`. No redeploy, no code change.

---

## How the pieces relate

```
 Browser (GitHub Pages, public)
   │  POST {action, idToken, …}   text/plain, no preflight
   ▼
 Apps Script  doPost ─► Api.gs handleApiPost_
   │  verify idToken with Google + check ALLOWED_EMAILS
   ▼
 The Google Sheet  (Patients / Visits tabs)
```

Auth here is **completely separate** from the Apps Script web app's
username/password and the desktop app's sync password — those keep working
unchanged. This frontend only uses Google Sign-In + the allowlist.

## Troubleshooting

- **Sign-in button doesn't appear / "not configured":** `CLIENT_ID` still says
  `PASTE…` in `config.js`, or Pages hasn't rebuilt yet.
- **Popup: "origin is not allowed":** the GitHub Pages origin in step 3 doesn't
  exactly match — check `https`, no trailing slash, no path.
- **"Server sent an unexpected reply":** deployment isn't `Anyone`, or `EXEC_URL`
  is an old/deleted deployment. Redeploy and copy a fresh `/exec` URL.
- **"Access denied: … is not on the allowed list":** add that email to
  `ALLOWED_EMAILS`.
- **"This sign-in was not issued for this app":** `OAUTH_CLIENT_ID` in Script
  properties doesn't match `CLIENT_ID` in `config.js`.
