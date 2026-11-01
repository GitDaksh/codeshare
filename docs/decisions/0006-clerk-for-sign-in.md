# 0006: Clerk for sign-in

## Context

Rooms, profiles, interviews and games with friends need accounts. Building
sign-up, sign-in, password resets, email verification, sessions and social
logins securely is a project of its own, and getting it wrong is the most
expensive kind of bug.

## Decision

[Clerk](https://clerk.com) handles accounts and sessions.

- **The app** (Next.js) uses Clerk's components for sign-in and sign-up, and
  `proxy.ts` (Next.js 16's middleware) protects private pages before any of
  their code runs. New accounts go straight to onboarding to pick a
  username.
- **The API never trusts the app.** Every REST request carries a Clerk
  session token (`Authorization: Bearer …`), verified on the server; every
  Socket.IO connection verifies the same token in its handshake.
- **Tokens, not cookies.** The app and the API live on different domains,
  so the API reads a token from each request instead of relying on cookies.
- **Profiles are CodeShare's own.** Usernames, avatars, bios and progress
  are stored in MongoDB, keyed by Clerk's user id.

## Why

- Secure defaults (hashed passwords, verification, bot protection, session
  rotation) without writing any of it.
- Works with Next.js on both the server and the client, and the same token
  works for REST and sockets.
- A free tier that comfortably covers this project.

## Trade-offs

- **A dependency on an outside service** for every sign-in. If Clerk is
  down, nobody can sign in.
- **Tests can't sign in through Clerk.** The test suites swap it for small
  stand-ins (a cookie in the app, `test:<name>` tokens on the API), which
  are only built into test copies (see `e2e/README.md`).
- Development and production use separate Clerk instances with different
  keys, which must match between the app and the API.

## Alternatives considered

- **Auth.js (NextAuth).** Free and open source, but sessions, the database
  tables and the API's token checks would be ours to secure and maintain.
- **Firebase Auth or Supabase Auth.** Comparable, but tied to their wider
  platforms.
- **Building it.** Not worth the risk for a project whose value is
  elsewhere.
