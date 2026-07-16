# Khalique Homoeopathic Clinic — web app

A free web app that sits on top of the patient register spreadsheet. The Sheet stays
the database: every patient and visit saved through the app appears in the Patients
and Visits tabs, and the app can be switched off at any time without losing anything.

**Hosting cost: £0.** It runs on Google's servers under the doctor's own Google account.
Nothing to pay for, no card, nothing to renew.

---

## Setting it up (about 10 minutes, once)

**1. Get the register into Google Sheets first**

- Go to <https://drive.google.com> and drag in
  `Khalique Homoeopathic Clinic — Patient Register.xlsx`
- Right-click it → **Open with** → **Google Sheets**
- **File → Save as Google Sheets**

**2. Open the script editor**

- In that Google Sheet: **Extensions → Apps Script**
- It opens a new tab with an empty `Code.gs`

**3. Paste in the two files**

- Select everything in `Code.gs`, delete it, and paste the contents of **`Code.gs`**
  from this folder.
- Click **+** next to "Files" → **HTML** → name it exactly **`Index`** (Apps Script adds
  the `.html` itself). Delete the placeholder content and paste in **`Index.html`**
  from this folder.
- Click the **save** icon.

**4. Deploy it**

- Top right: **Deploy → New deployment**
- Click the gear next to "Select type" → **Web app**
- Set:
  - **Execute as:** `Me`
  - **Who has access:** `Only myself` *(see the note on access below)*
- **Deploy** → Google asks for permission the first time. Click through
  **Advanced → Go to (project name)** → **Allow**. This is Google asking whether the
  script may edit *your own* spreadsheet — it is not sending data anywhere.
- Copy the **Web app URL**. That's the app.

**5. Put it on his phone**

- Open the URL in Chrome on his phone
- Chrome menu **⋮ → Add to Home screen**
- It now opens like an app.

---

## Who has access

- **`Only myself`** — only the doctor's own Google account can open the app. Safest, and
  right if he's the only one using it.
- **`Anyone with Google account`** — needed if a receptionist or family member also
  records patients, using their own Google login. Anyone with the link *and* a Google
  account could open it, so only use this if that's acceptable.

Do **not** choose "Anyone" — that would put patient records on the open internet.

## After changing the code

Apps Script does not publish edits automatically. After editing:
**Deploy → Manage deployments → (pencil icon) → Version: New version → Deploy.**
The URL stays the same.

---

## What it does

- **Search** by name, mobile number or Ref.No — results appear as you type.
- **New Patient** — the full intake form from the paper register, in one screen.
  The Ref.No is assigned by the spreadsheet automatically.
- **Patient view** — all details plus every visit in order.
- **Add Visit** — date, condition/changes, and remedy with instructions. The visit
  number (1st, 2nd, 3rd…) works itself out.
- **Print** — prints the patient's card on clinic letterhead with the PHC registration.
- **Edit** — correct a patient's details.

## What it does not do

- **It does not work offline.** Apps Script apps run inside a Google sandbox that
  cannot cache pages for offline use. If the clinic's internet is down, the app will
  not open. The fallback is the **Google Sheets mobile app**, which *does* work offline —
  he can record the patient there and it syncs when the connection returns.
  If offline use turns out to matter day-to-day, that's the reason to move to a
  proper hosted app later (~£10/year).
- It is a bit slow to load the first time (2–3 seconds). That's normal for Apps Script.

## If something breaks

The data is never trapped in the app — open the Google Sheet and everything is there,
readable and editable by hand.
