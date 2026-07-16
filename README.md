# Khalique Homoeopathic Clinic — register frontend

Static web frontend for the clinic's patient register, hosted on **GitHub Pages**,
talking to a **Google Sheet** through an Apps Script backend.

> **This repository contains code only — never patient records.** Patient data
> lives in the clinic's private Google Sheet. A deny-by-default `.gitignore` keeps
> the scanned records, spreadsheets, and exports out of version control.

## Layout

- **`docs/`** — the GitHub Pages site (the frontend). Start with **`docs/SETUP.md`**.
- **`webapp/`** — the Apps Script backend (`Code.gs` + `Api.gs`) that runs on the
  Sheet. `Code.gs` also still serves the original Apps Script–hosted web app.

## How it fits together

The page signs the user in with Google and sends that ID token to the Apps Script
backend, which verifies it against an email allowlist before touching the Sheet.
The page is public; the allowlist is the gate. Full setup — Google Cloud OAuth
client, deployment, allowlist, Pages — is in [`docs/SETUP.md`](docs/SETUP.md).
