# 0007: One room per connection

## Context

A Socket.IO connection could join several rooms, but it had only one role,
stored on the connection (`socket.data.role`) and overwritten by the last
room it joined. Every room event checked that the connection had joined the
room it named, then checked that role.

That allowed this, with a few lines of script:

1. Join room A, where you're only a **viewer**.
2. On the same connection, join room B, which you **own**. The role on the
   connection is now "owner".
3. Send an edit, a language change or a run result for room A. The
   connection is in A, and its role says it may edit, so room A accepts it.

The app itself never did this (each room page opens its own connection), but
the server must not rely on that.

## Decision

A connection is in **one room at a time**, and its role belongs to that
room.

- Joining another room first leaves the current one, exactly as if the
  person had left it (they drop off the list of who's here and their cursors
  disappear), then joins the new one, with no waiting in between, so two
  joins can't interleave.
- Every room event goes through one check, `inRoom(socket, roomId)`: the
  room it names must be the room this connection is in. Events that change
  the room (edits, language, runs, Lens) also need that room's role
  (`mayEdit`).
- A connection that closes while its join is still loading is never added
  to the room, so it can't leave a "ghost" in the list of who's here.

A regression test does exactly the three steps above and checks that room A
sees none of it (`server/test/integration/sockets.test.ts`). It fails on the
old code and passes on the new.

## Why

- A role is a fact about a person **in a room**, so storing it per
  connection is only safe if a connection is in one room.
- One check used by every handler is easier to get right (and review) than a
  room-and-role lookup repeated in each.
- It matches how the app already behaves, so nothing changes for real users.

## Trade-offs

- A script that wants to watch two rooms needs two connections (the app
  already uses one per room page).

## Alternatives considered

- **A role per room on each connection** (a map from room to role). Also
  correct, but every handler would need to look up the right role, and
  presence, cursors and documents would still have to be tracked per room.
- **Re-reading the role from the database on every event.** Always correct,
  but a database read on every keystroke is far too slow.
