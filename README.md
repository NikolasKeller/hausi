# Hausi 🏠🎉

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
npx prisma db push   # creates SQLite dev.db
npm run seed         # demo users + 3 sample events
npm run dev          # API on http://localhost:3001
```

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
| `demo@hausi.app` | `hausi123` |
| `mia@hausi.app` / `leo@hausi.app` / `zoe@hausi.app` | `hausi123` |

## Features

- **Auth** – signup/login with email + password (JWT in `expo-secure-store`), emoji avatars
- **Events** – create, edit, delete; six gradient/emoji cover themes, four title fonts (Classic/Literary/Fancy/Eclectic) and animated effects (confetti/sparkles/balloons) with live preview; date/time picker; optional guest cap
- **Invite links** – native share sheet; the invite deep link opens the event directly, signed-out guests are routed through signup first. In Expo Go the Share button emits a working `exp://<host>:8081/--/e/<slug>` link; the `hausi://e/<slug>` scheme takes effect in a development/standalone build (`npx expo run:ios`)
- **RSVPs** – Going / Maybe / Can't with plus-ones; per-event plus-one limit; hosts can open/close RSVPs
- **Waitlist** – full events queue GOING requests; freed spots auto-promote FIFO with a notification
- **Guest list** – emoji avatars grouped by status with live counters (going/maybe/waitlist); hosts can remove guests
- **Cohosts** – add by email; cohosts can edit the event and manage guests
- **Cancellation** – canceling keeps the page alive with a banner and notifies every guest; delete stays separate
- **Party Wall** – per-event feed with comments and activity entries ("Mia is going with +2 🎉")
- **Notifications** – in-app bell with unread badge: RSVPs and comments for hosts, updates/cancellations for guests, waitlist promotions
- **Home feed** – your events split into Upcoming and Past

## Try the main flow

1. Start server + app, log in as `demo@hausi.app`.
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
   `file:/data/hausi.db` — override only if you mount the volume elsewhere.
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

## Native device builds (EAS)

The repo also ships `app/eas.json` and bundle identifiers (`com.hausi.app`) for
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

   The `hausi://e/<slug>` invite deep link becomes fully functional in these builds.

## Out of scope (by design)

Image uploads, SMS/email sending, "Text Blasts", payments — all addable later.
