# CodeShare

Real-time collaborative coding rooms — create a room, share the link, and edit code with your team live.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js) ![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript) ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss) ![Express](https://img.shields.io/badge/Express-black?logo=express) ![Socket.IO](https://img.shields.io/badge/Socket.IO-black?logo=socket.io) ![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb) ![Clerk](https://img.shields.io/badge/Auth-Clerk-6c47ff)

**[Live demo →](https://codeshare-nexus.vercel.app)**

---

## Overview

CodeShare is a real-time collaborative coding platform. Create a room, invite others with a shareable link, and edit code together with a real Monaco editor, live syntax highlighting, an in-room chat, and presence indicators showing exactly who's online — no setup required on either end.

Built incrementally, one feature at a time, with an emphasis on clean architecture and decisions I can explain in an interview over sheer feature count.

## Project status

The core MVP is complete and deployed. What's left is hardening, not building.

| Area | Status |
|---|---|
| Authentication (Clerk) | ✅ Done — sign-up/in, protected routes |
| Room CRUD + MongoDB persistence | ✅ Done — real API, owner-scoped authorization |
| Real-time sync (Socket.IO) | ✅ Done — presence, chat, and code all live-sync |
| Code editor (Monaco) | ✅ Done — real syntax highlighting, cursor tracking, save-state indicator |
| Deployment | ✅ Live — Vercel + Render + MongoDB Atlas |
| Automated tests | 🚧 Not started |
| Clerk production instance | 🚧 Deployed on development keys for now (see Deployment) |

## Features

- **Authentication** — email/password via Clerk, with server-verified protected routes and API endpoints
- **Dashboard** — create, search, sort, and delete rooms; live skeleton loading and empty states
- **Real-time code editor** — Monaco-powered, with live syntax highlighting across 5 languages, cursor position, and a save-status indicator
- **Live presence** — see who's actually connected to a room, shown as initials in a distinct avatar shade per person
- **In-room chat** — persisted to MongoDB, auto-scrolling, with a tabbed sidebar alongside presence
- **Shareable rooms** — one link, no invite flow, no setup on the joiner's side
- **Responsive, accessible UI** — usable from a phone through a full desktop, with proper `aria-label`s on icon-only controls and `prefers-reduced-motion` support
- **Resizable sidebar + focus mode** on the room page for a distraction-free editing view

## Design

A deliberately monochrome visual system — pure black, white, and grayscale, no color accents except a single reserved red for genuine error/disconnected states. Presence is distinguished by grayscale avatar shade and initials rather than color, since hue was never load-bearing there. Space Grotesk carries headline typography; JetBrains Mono handles code and data; Framer Motion is used sparingly, for one or two deliberate moments rather than scattered scroll animations everywhere.

## Tech stack

**Frontend** — Next.js 16 (App Router), React, TypeScript, Tailwind CSS v4, Clerk, Framer Motion, Lucide icons, Monaco Editor
**Backend** — Node.js, Express, TypeScript, MongoDB + Mongoose, Socket.IO
**Deployment** — Vercel (frontend) · Render (backend) · MongoDB Atlas (database)

## Architecture

```text
codeshare/
├── client/                      # Next.js app
│   ├── app/                     # routes: /, /dashboard, /room/[id], /sign-in, /sign-up
│   │   ├── dashboard/           # + loading.tsx
│   │   ├── room/[id]/           # + loading.tsx
│   │   ├── not-found.tsx
│   │   └── error.tsx
│   ├── components/               # Navbar, CodeEditor, LanguageDropdown,
│   │                              #   ToastProvider, CreateRoomModal, Skeleton, LiveDemoPreview
│   ├── lib/                      # api.ts (authenticated axios), socket.ts (Socket.IO hook),
│   │                              #   colors.ts, languages.ts
│   ├── types/                    # Room, ChatMessage, OnlineUser
│   └── proxy.ts                  # Clerk middleware (Next.js 16 naming)
│
├── server/
│   ├── src/
│   │   ├── config/db.ts          # MongoDB connection, fail-fast on startup
│   │   ├── controllers/          # room, message
│   │   ├── models/                # Room, Message
│   │   ├── routes/                # roomRoutes
│   │   ├── middleware/            # requireAuth, errorHandler
│   │   ├── sockets/                # auth handshake, presence, chat, code sync,
│   │   │                           #   debounced save with shutdown-safe flushing
│   │   └── server.ts
│   └── ...
│
├── .gitignore
├── README.md
└── package.json                  # root — orchestrates `npm run dev`
```

**Request flow:**
```text
React (client) → HTTP request (Bearer token) → Express route → requireAuth
   → Controller → Mongoose model → MongoDB
```

**Real-time flow:**
```text
Client connects (Clerk token in handshake) → server verifies via @clerk/backend
   → socket.join(roomId) → presence broadcast
   → chat:message / code:change → persisted + broadcast to the room
```

**Auth flow:** Clerk's `proxy.ts` middleware protects `/dashboard` and `/room/*` on the frontend before any page code runs. Every backend route independently re-verifies the same Clerk session server-side — the frontend gate is never trusted alone. Since the client and server run on different origins, auth is a Bearer token in the `Authorization` header (via Clerk's `getToken()`), not a cookie.

## Local setup

**Prerequisites:** Node.js 20+, npm, a free [Clerk](https://dashboard.clerk.com) account, a free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) cluster.

```bash
git clone https://github.com/GitDaksh/codeshare.git
cd codeshare

npm install --prefix client
npm install --prefix server
npm install
```

Create the environment files described below, then run both apps together:

```bash
npm run dev
```

- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend: [http://localhost:5001](http://localhost:5001)

> Port 5000 is intentionally avoided — it conflicts with macOS's AirPlay Receiver.

## Environment variables

**`client/.env.local`**
```env
NEXT_PUBLIC_API_URL=http://localhost:5001

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard
```

**`server/.env`**
```env
PORT=5001
CLIENT_URL=http://localhost:3000
NODE_ENV=development
MONGODB_URI=
CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
```
Both Clerk key pairs (client and server) must come from the **same** Clerk application — mismatched projects fail silently with 401s rather than a clear error.

## API overview

All routes below require a valid Clerk session (`Authorization: Bearer <token>`).

| Method | Route | Description |
|---|---|---|
| `GET` | `/` | Health check |
| `POST` | `/api/rooms` | Create a room |
| `GET` | `/api/rooms` | List the current user's rooms |
| `GET` | `/api/rooms/:id` | Fetch a single room by ID |
| `DELETE` | `/api/rooms/:id` | Delete a room — owner-only, enforced server-side |
| `GET` | `/api/rooms/:id/messages` | Fetch a room's chat history |

## WebSocket / event overview

Socket connections are authenticated at handshake time using the same Clerk token as the REST API, verified via `@clerk/backend`.

| Event | Direction | Purpose |
|---|---|---|
| `room:join` | client → server | Join a room's channel, announce display name |
| `room:leave` | client → server | Leave a room's channel |
| `presence:update` | server → clients | Broadcast the current list of connected users in a room |
| `code:change` | client ↔ server | Broadcast live edits to everyone else in the room; debounce-saved to MongoDB (1.5s of inactivity) |
| `chat:message` | client ↔ server | Persist and broadcast a chat message |

Pending code saves are flushed immediately if a room empties out, and on server shutdown (`SIGINT`/`SIGTERM`) — an in-flight debounce timer is never allowed to silently lose an edit.

## Deployment

- **Frontend** → [Vercel](https://codeshare-nexus.vercel.app)
- **Backend** → [Render](https://codeshare-l5y8.onrender.com)
- **Database** → MongoDB Atlas (M0 free tier)

**Known, deliberate limitations of the current free-tier deployment:**
- **Clerk development keys are in use in production.** A real production instance requires an owned custom domain, which this project doesn't have yet — the tradeoff was made explicitly to keep hosting entirely free. You'll see Clerk's dev-key warning in the browser console as a result; it doesn't affect functionality.
- **Render's free tier sleeps after 15 minutes of inactivity.** The first request after a period of idle time takes roughly 30–60 seconds to wake the server — expected, not a bug.

## Roadmap

- [x] Room and message Mongoose models
- [x] Room CRUD API with owner-scoped authorization
- [x] Socket.IO real-time code sync and chat
- [x] Live online-presence indicators
- [x] Monaco Editor integration with language-aware syntax highlighting
- [x] Code persistence with debounced, shutdown-safe saving
- [x] Deployment to Vercel / Render / Atlas
- [ ] Automated tests for auth, room creation, and room authorization
- [ ] Real Clerk production instance (pending a custom domain)
- [ ] Stretch: file explorer, multiple files per room, cursor sync, code execution
