# iykyk 🏠🎉

A Partiful-style party app: create events, invite friends with a link, collect RSVPs, and chat on the Party Wall. One codebase, native on iOS **and** Android.

- **`app/`** – Expo (React Native, TypeScript) with Expo Router. Dark, playful Partiful-style UI with gradient cover themes.
- **`server/`** – Hono (Node, TypeScript) + Prisma + SQLite. REST API with JWT auth (bcrypt).
- **`app/shared/`** – TypeScript types shared by both sides. They live inside the app package because Metro can't resolve files outside its project root; the server imports them from there.

## Getting started

Requires Node 20+ and (for the app) the Expo Go app or an iOS Simulator / Android emulator.

### 1. Server

```bash
cd server
npm install
npx prisma db push   # creates SQLite dev.db (empty — real data only)
npm run dev          # API on http://localhost:3001
```

The app ships with **no fake data**: every user signs up through the phone
flow and every event is created for real. (`npm run seed` still exists for
throwaway local demos, but it is not part of the normal flow and refuses to
run against any non-SQLite database.)

### Event ledger (Supabase)

Every event lifecycle action — created / updated / canceled / deleted — is
appended to the `EventLedger` table in the iykyk Supabase project (what kind
of event, public or private, by whom, when). The server writes it through
PostgREST using `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from
`server/.env` (gitignored; see `.env.example`). Writes are fire-and-forget so
the ledger can never break a user request.

### 2. App

```bash
cd app
npm install
npx expo start       # press i for iOS simulator, a for Android
```

The iOS simulator reaches the server via `localhost`; Android emulators automatically use `10.0.2.2`. For a physical device, point the app at your machine's LAN IP:

```bash
EXPO_PUBLIC_API_URL=http://192.168.x.x:3001 npx expo start
```

### Demo login

| Email | Password |
| --- | --- |
| `demo@iykyk.app` | `iykyk123` |
| `mia@iykyk.app` / `leo@iykyk.app` / `zoe@iykyk.app` | `iykyk123` |

## Features

- **Auth** – signup/login with email + password (JWT in `expo-secure-store`), emoji avatars
- **Events** – create, edit, delete; six gradient/emoji cover themes, four title fonts (Classic/Literary/Fancy/Eclectic) and animated effects (confetti/sparkles/balloons) with live preview; date/time picker; optional guest cap
- **Invite links** – native share sheet; the invite deep link opens the event directly, signed-out guests are routed through signup first. In Expo Go the Share button emits a working `exp://<host>:8081/--/e/<slug>` link; the `iykyk://e/<slug>` scheme takes effect in a development/standalone build (`npx expo run:ios`)
- **RSVPs** – Going / Maybe / Can't with plus-ones; per-event plus-one limit; hosts can open/close RSVPs
- **Waitlist** – full events queue GOING requests; freed spots auto-promote FIFO with a notification
- **Guest list** – emoji avatars grouped by status with live counters (going/maybe/waitlist); hosts can remove guests
- **Cohosts** – add by email; cohosts can edit the event and manage guests
- **Cancellation** – canceling keeps the page alive with a banner and notifies every guest; delete stays separate
- **Party Wall** – per-event feed with comments and activity entries ("Mia is going with +2 🎉")
- **Notifications** – in-app bell with unread badge: RSVPs and comments for hosts, updates/cancellations for guests, waitlist promotions
- **Home feed** – your events split into Upcoming and Past

## Try the main flow

1. Start server + app, log in as `demo@iykyk.app`.
2. Create an event, pick a cover theme, save.
3. Tap **Share link** and open the shared link as another user to RSVP and comment. To simulate an invite in Expo Go on the iOS simulator:

   ```bash
   xcrun simctl openurl booted "exp://127.0.0.1:8081/--/e/<slug>"
   ```

## API overview

All routes are mounted under `/api` (so they never collide with the web app's
own pages, which are served from the same origin in production).

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/health` | Health check |
| POST | `/api/auth/signup`, `/api/auth/login` | JWT auth |
| GET | `/api/events` | Your feed (hosting + RSVP'd) |
| POST | `/api/events` | Create event |
| GET | `/api/events/by-slug/:slug` | Resolve invite link |
| PATCH / DELETE | `/api/events/:id` | Host only |
| PUT | `/api/events/:id/rsvp` | Upsert RSVP (`GOING` \| `MAYBE` \| `CANT`, `plusOnes`); full events → waitlist |
| DELETE | `/api/events/:id/rsvp/:userId` | Host removes a guest |
| POST | `/api/events/:id/cancel` | Cancel (keeps page, notifies guests) |
| POST / DELETE | `/api/events/:id/cohosts[/:userId]` | Manage cohosts (creator only) |
| GET / POST | `/api/events/:id/comments` | Party Wall |
| GET | `/api/notifications` | Your notifications + unread count |
| POST | `/api/notifications/read-all` | Mark all read |

## Going live with a real database (e.g. Supabase)

Local dev runs on SQLite with seeded demo data. The social layer is fully
computed from live tables — mutuals derive from shared guest lists, badges
from real counts, trending from real RSVPs — so swapping in a real database
requires no application changes:

1. In `server/prisma/schema.prisma` change `provider = "sqlite"` to `"postgresql"`.
2. In `server/.env` set `DATABASE_URL` to the Supabase pooled connection string (see `.env.example`).
3. `npx prisma db push` to create the tables, and set a strong `JWT_SECRET`.

`npm run seed` **refuses to run against a non-SQLite database**, so demo
users/events never reach production — real signups populate everything.

## Deploying to Railway (web app / PWA)

The repo root has a `Dockerfile` + `railway.json`: one container exports the app
to web (`expo export`), and the Hono server serves it (phone-sized layout on any
screen, installable via "Add to Home Screen") alongside the API under `/api`.

1. Create a Railway service from this GitHub repo — the Dockerfile is picked up
   automatically.
2. Add a **volume** mounted at `/data` (the sqlite database lives there;
   without it, data resets on every deploy).
3. Set the **`JWT_SECRET`** variable (e.g. `openssl rand -hex 32`); the server
   refuses to boot in production without it. `DATABASE_URL` defaults to
   `file:/data/now.db` — override only if you mount the volume elsewhere.
4. *(Recommended for a public link)* set **`INVITE_CODE`** to a shared passcode.
   Because there is no SMS provider, the login code is shown on screen, so
   without a gate anyone with the URL could sign in as any phone number. With
   `INVITE_CODE` set, the app asks friends for the passcode before sending a
   code — share it with them out-of-band. Leave it unset for open signup.
5. Generate a public domain (service → Settings → Networking) and share
   `https://<your-domain>/` — invite links (`/e/<slug>`) work directly.

> **How login works here:** there's no SMS gateway wired up, so after entering
> a phone number the 6-digit code appears on screen (as a mock text message)
> and you type it in. That's enough for friends to make accounts; wiring a real
> SMS provider is a later step.

On iPhones: open the link in Safari → Share → **Add to Home Screen** to get the
full-screen app. Android/Chrome offers "Install app" automatically.

## Continuous Expo Go delivery (EAS Update)

Two GitHub Actions keep the app runnable in **Expo Go** on your phone at all times:

| Workflow | Trigger | EAS Update target |
| --- | --- | --- |
| `.github/workflows/eas-update-production.yml` | every push/merge to `main` | channel/branch **`production`** |
| `.github/workflows/eas-update-preview.yml` | every PR (opened/updated) | a branch named after the PR's git branch, plus an auto-updated **PR comment with a QR code** |

**How to open it on your iPhone:**

- **Latest main:** open Expo Go (logged in with the project owner's Expo
  account) → Projects → *iykyk* → branch `production`. The production
  workflow's job summary also prints a stable `exp://u.expo.dev/...` link and
  QR code — scan it once, it always resolves to the latest published update.
- **A PR preview:** scan the QR code from the bot comment on the PR.

**One-time setup** (required before the workflows can publish):

```bash
cd app
npm i -g eas-cli
eas login                 # Expo account
eas init                  # links the repo to an EAS project (writes extra.eas.projectId into app.json — commit it)
```

Then create an access token at <https://expo.dev/settings/access-tokens> and
add it to the GitHub repo as a secret:

```bash
gh secret set EXPO_TOKEN
```

Notes:

- `runtimeVersion` uses the `appVersion` policy — bump `expo.version` in
  `app/app.json` whenever native dependencies change, so old clients don't
  receive incompatible updates. Expo Go itself only checks the SDK version
  (currently 54).
- Updates only ship JS/asset changes. Adding native modules still requires a
  new build (and doesn't affect Expo Go as long as the modules are part of
  Expo Go).
- The published bundle talks to the API at `EXPO_PUBLIC_API_URL` (server
  origin, no `/api`), baked in at publish time. Both workflows read it from a
  **repository variable** — set it to your deployed server (e.g. the Railway
  domain), otherwise the app on your phone falls back to `localhost` and
  cannot reach the API:

  ```bash
  gh variable set EXPO_PUBLIC_API_URL --body "https://<your-railway-domain>"
  ```

## Native device builds (EAS)

The repo also ships `app/eas.json` and bundle identifiers (`com.iykyk.app`) for
real native builds:

1. **Point the app at your server** — build with
   `EXPO_PUBLIC_API_URL=https://your-api.example.com` (origin only, no `/api`).
2. **Build for devices** (needs a free [Expo account](https://expo.dev):
   `npm i -g eas-cli && eas login`):

   ```bash
   cd app
   eas build --profile preview --platform ios      # internal distribution / simulator
   eas build --profile production --platform all   # store-ready builds
   eas submit --platform ios                       # TestFlight
   ```

   The `iykyk://e/<slug>` invite deep link becomes fully functional in these builds.

## Out of scope (by design)

Image uploads, SMS/email sending, "Text Blasts", payments — all addable later.
