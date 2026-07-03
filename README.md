# Hausi 🏠🎉

A Partiful-style party app: create events, invite friends with a link, collect RSVPs, and chat on the Party Wall. One codebase, native on iOS **and** Android.

- **`app/`** – Expo (React Native, TypeScript) with Expo Router. Dark, playful Partiful-style UI with gradient cover themes.
- **`server/`** – Hono (Node, TypeScript) + Prisma + SQLite. REST API with JWT auth (bcrypt).
- **`shared/`** – TypeScript types shared between app and server.

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
- **Events** – create, edit, delete; six gradient/emoji cover themes with live title preview; date/time picker; optional guest cap
- **Invite links** – native share sheet; deep link `hausi://e/<slug>` opens the event, signed-out guests are routed through signup first
- **RSVPs** – Going / Maybe / Can't with plus-ones; capacity enforcement when the event is full
- **Guest list** – emoji avatars grouped by status with live counters (X going, Y maybe)
- **Party Wall** – per-event comment feed

## Try the main flow

1. Start server + app, log in as `demo@hausi.app`.
2. Create an event, pick a cover theme, save.
3. Tap **Share link** and open the link (or `hausi://e/<slug>`) as another user to RSVP and comment.

## API overview

| Method | Path | Description |
| --- | --- | --- |
| POST | `/auth/signup`, `/auth/login` | JWT auth |
| GET | `/events` | Your feed (hosting + RSVP'd) |
| POST | `/events` | Create event |
| GET | `/events/by-slug/:slug` | Resolve invite link |
| PATCH / DELETE | `/events/:id` | Host only |
| PUT | `/events/:id/rsvp` | Upsert RSVP (`GOING` \| `MAYBE` \| `CANT`, `plusOnes`) |
| GET / POST | `/events/:id/comments` | Party Wall |

## Out of scope (by design)

Image uploads, SMS/email sending, "Text Blasts", payments, and app-store builds (EAS) — all addable later.
