# 0002: Socket.IO for everything live

## Context

Most of what happens in a room is live: edits, cursors, who's here, chat,
typing indicators, shared runs, Lens sessions, interviews and game moves. The
server needs to push these to the right people within milliseconds, know who
each connection belongs to, and survive flaky networks and phones going to
sleep.

## Decision

All live traffic goes over [Socket.IO](https://socket.io), on the same port
as the REST API.

- **Authentication happens in the handshake.** The browser connects with its
  Clerk session token; the server verifies it with `@clerk/backend` before
  the connection is accepted, and remembers the user on the connection.
- **Socket.IO rooms** map to CodeShare rooms (and game lobbies), so a
  broadcast reaches exactly the people in one room.
- **Every event is checked on the server**: its payload is validated, it's
  rate-limited per person, and it only counts for the room the connection
  is in, with the role that person has there (see 0007).
- **Acknowledgements** answer game requests (join, start, settings) with a
  result or a reason.

## Why

- It reconnects by itself and falls back to HTTP long-polling where
  WebSockets are blocked, which matters on school and office networks.
- Rooms, broadcasts to everyone but the sender, and acknowledgements are
  built in, so the event code stays about the product, not the plumbing.
- One connection per room page carries everything, including the binary Yjs
  updates.

## Trade-offs

- The default adapter keeps rooms in the server's memory, so the API runs as
  one instance. Running several would need a shared adapter (Redis, for
  example), along with moving presence, lobbies and rate limits out of memory.
- Socket.IO has its own protocol on top of WebSockets, so a plain WebSocket
  client can't connect; only Socket.IO clients can.

## Alternatives considered

- **Plain WebSockets (`ws`).** Lighter, but reconnection, rooms, fallbacks
  and acknowledgements would all have to be built by hand.
- **A hosted service (Pusher, Ably, Liveblocks).** Less to run, but a paid
  dependency once usage grows, and authorization rules would be split
  between the service and the API.
- **Server-sent events plus REST.** Fine for one-way updates, but editing,
  cursors and games send many small messages in both directions.
