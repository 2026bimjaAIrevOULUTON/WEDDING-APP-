# Wedding App

A guest guide for a wedding: what's happening now and next, the schedule with dress codes,
directions to the venue, and phone reminders before each function. The host can change
timings and message every guest from a passcode-protected page.

The pilot wedding is Laveen & Anoushka, 22–24 January 2027, Palm Springs Resort, Nashik.

## How it is built

- `public/` — the guide guests open (installable to the home screen), plus its service worker.
- `src/worker.js` — Cloudflare Worker: API, host passcode, web push, and a once-a-minute reminder check.
- `src/wedding.js` — everything specific to this wedding. A new wedding is a new copy of this file.
- Cloudflare D1 database `wedding-app` stores host edits, announcements and reminder subscriptions.
  Tables are created automatically on first use.

## Deploy

Connect this repository in the Cloudflare dashboard (Workers & Pages → Create → Import a repository).
Deploy command: `npx wrangler deploy`. Every push to `main` then goes live.

## First run

Open the live link, go to **Host**, and set the host passcode straight away.
The first person to set it becomes the host.

## Run locally

    npm install
    npm run dev
