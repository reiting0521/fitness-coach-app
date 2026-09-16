# Fitness Coach

Mobile-first strength workout coach. Dark, polished phone UI (Strong / Hevy vibe). Works offline with `localStorage`; optionally syncs plan + daily logs to Google Drive.

**Live:** https://reiting0521.github.io/fitness-coach-app/

## Features

- **Week strip** (Europe/Zurich): jump Mon–Sun / previous weeks; today highlighted
- **Plan v2**: Mon Shoulders · Tue Chest · Wed Legs (squat, hip thrust, abductor/adductor, Smith SL calf) · Thu Rest · Fri Back · Sat/Sun Rest
- **Locked history**: Finish day locks the session read-only; browse past logs from the week strip or Settings
- **Exercise how-to**: compact SVG diagram + 3–5 form cues per lift
- **Swap**: 1–3 alternatives when a machine is busy (session-local; original kept as reference)
- **Drive sync**: prefers `plan-v2.json`, falls back to `plan.json`; Finish day writes `logs/YYYY-MM-DD.json`
- **Settings**: Drive connect, kg/lb, folder IDs, on-device history list
- **PWA-feel**: web manifest + Add to Home Screen friendly

## Stack

Vite + vanilla JS. Static build for GitHub Pages (`base: /fitness-coach-app/`).

## Local development

```bash
npm install
cp .env.example .env   # optional: add VITE_GOOGLE_CLIENT_ID
npm run dev
```

Open the printed local URL (usually `http://localhost:5173/fitness-coach-app/`).

```bash
npm run build
npm run preview
```

## Google Drive OAuth setup

Drive sync needs a **Google Cloud OAuth 2.0 Web client ID**. The app uses [Google Identity Services](https://developers.google.com/identity/oauth2/web/guides/overview) + Drive API (`drive` scope).

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → create or select a project.
2. Enable **Google Drive API**.
3. **OAuth consent screen**: configure; add your account as a test user while in Testing.
4. **Credentials → OAuth client ID → Web application**.
5. **Authorized JavaScript origins**:
   - `http://localhost:5173`
   - `http://127.0.0.1:5173`
   - `https://reiting0521.github.io`
6. Put the client ID in `.env` (never commit `.env`):

```bash
VITE_GOOGLE_CLIENT_ID=123456789-abcdef.apps.googleusercontent.com
```

7. Rebuild / redeploy so Vite embeds the env var.

Without a client ID the app still works fully offline.

### Known Drive folder IDs (defaults in Settings)

| Item | ID |
|------|-----|
| Fitness Coach folder | `1GCzaDOcj-jHmbMCxh7YEVDb8AqQNJ-c-` |
| logs/ | `1W4Wwho9JYB0bCvGUsbuwAhwgtoF04IBO` |
| plan.json (fallback) | `1okdWjmCZkGAKnigHh2qF8rackLGzurUX` |

On connect, the app looks for **`plan-v2.json`** first, then `plan.json` / the cached plan file id.

### Log JSON shape

Weights stored in **kg**. Locked sessions include `"locked": true` and optional `originalName` when swapped.

## GitHub Pages deploy

Published from the **`gh-pages`** branch (`dist/` build output).

```bash
npm run build
# force-push dist/ to gh-pages (see deploy script / orphan branch method)
```

Site URL: **https://reiting0521.github.io/fitness-coach-app/**

## Weekly plan (v2)

| Day | Focus |
|-----|--------|
| Mon | Shoulders — OHP 4×5, laterals, face pulls, rear-delt fly, optional shrug |
| Tue | Chest — flat bench 4×5, incline DB, dips/CGBP, fly |
| Wed | Legs — back squat 4×5–8, hip thrust 4×6–10, abductor, adductor, Smith SL calf |
| Thu | Rest (preview: Friday Back) |
| Fri | Back — DL/trap-bar 3×5, pull-up/pulldown, CS row, pulldown, face pull |
| Sat/Sun | Rest |

Bundled `src/plan.json` is plan version **2**.
