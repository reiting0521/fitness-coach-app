# Fitness Coach

Mobile-first strength workout coach. Phone UI, large tap targets, dark gym-friendly theme. Works offline with `localStorage`; optionally syncs `plan.json` and daily logs to Google Drive.

**Live:** https://reiting0521.github.io/fitness-coach-app/

## Features

- **Today** (Europe/Zurich): focus + exercise list, editable weight × reps, feeling chips (easy / solid / grind), notes, mark done
- **Finish day**: overall feeling + session note → localStorage + Drive `logs/YYYY-MM-DD.json`
- **Rest days**: Thu / Sat / Sun rest UI
- **Settings**: Drive connect, kg/lb, folder IDs
- **PWA-feel**: web manifest + Add to Home Screen friendly

## Stack

Vite + vanilla JS. Static build for GitHub Pages.

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

Drive sync needs a **Google Cloud OAuth 2.0 Web client ID**. The app uses [Google Identity Services](https://developers.google.com/identity/oauth2/web/guides/overview) + Drive API (`drive` scope (personal app; needed to read existing Fitness Coach folder)).

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → create or select a project.
2. Enable **Google Drive API**.
3. **APIs & Services → OAuth consent screen**: configure (External is fine for personal use). Add your Google account as a test user while in Testing.
4. **Credentials → Create credentials → OAuth client ID → Web application**.
5. **Authorized JavaScript origins** (add all you use):
   - `http://localhost:5173`
   - `http://127.0.0.1:5173`
   - `https://reiting0521.github.io`
6. Copy the client ID into `.env`:

```bash
VITE_GOOGLE_CLIENT_ID=123456789-abcdef.apps.googleusercontent.com
```

7. Rebuild / redeploy so Vite embeds the env var (`import.meta.env.VITE_GOOGLE_CLIENT_ID`).

Without a client ID the app still works fully offline.

### Known Drive folder IDs (defaults in Settings)

| Item | ID |
|------|-----|
| Fitness Coach folder | `1GCzaDOcj-jHmbMCxh7YEVDb8AqQNJ-c-` |
| logs/ | `1W4Wwho9JYB0bCvGUsbuwAhwgtoF04IBO` |
| plan.json | `1okdWjmCZkGAKnigHh2qF8rackLGzurUX` |

On connect, the app uses these IDs when valid; otherwise it finds or creates folders by name.

### Log JSON shape

```json
{
  "date": "YYYY-MM-DD",
  "timezone": "Europe/Zurich",
  "dayFocus": "Shoulders",
  "completed": true,
  "overallFeeling": "solid",
  "sessionNote": "",
  "exercises": [
    {
      "name": "Overhead press",
      "planned": { "sets": 4, "reps": "5", "note": "1–2 RIR" },
      "performed": [{ "weightKg": 40, "reps": 5 }],
      "feeling": "solid",
      "exerciseNote": "",
      "done": true
    }
  ],
  "updatedAt": "ISO-8601"
}
```

Weights are stored in **kg** internally; Settings toggles display to lb.

## GitHub Pages deploy

This repo deploys via GitHub Actions on push to `main` (see `.github/workflows/deploy.yml`).

Manual enable (once):

```bash
gh api repos/reiting0521/fitness-coach-app/pages -X POST \
  -f build_type=workflow \
  -f source[branch]=main \
  -f source[path]=/
```

Or: **Settings → Pages → Build and deployment → GitHub Actions**.

Site URL: **https://reiting0521.github.io/fitness-coach-app/**

> If you set `VITE_GOOGLE_CLIENT_ID` as a GitHub Actions secret named `VITE_GOOGLE_CLIENT_ID`, the workflow injects it at build time.

## Add to Home Screen

**iPhone (Safari):** Share → Add to Home Screen.

**Android (Chrome):** Menu → Install app / Add to Home screen.

## Weekly seed plan

| Day | Focus |
|-----|--------|
| Mon | Shoulders — OHP 4×5, laterals, face pulls, rear-delt fly, optional shrug |
| Tue | Chest — flat bench 4×5, incline DB, dips/CGBP, fly |
| Wed | Legs — squat 4×5, RDL, lunges/Bulgarian, curl, calves |
| Thu | Rest |
| Fri | Back — DL/trap-bar 3×5, pull-up/pulldown, CS row, pulldown, face pull |
| Sat/Sun | Rest |

Bundled `src/plan.json` matches the Drive `plan.json` shape.
