# 0001: Shared editing with Yjs

## Context

Everyone in a room edits the same file at the same time. Two people often
type within milliseconds of each other, connections drop and come back, and
the server restarts on every deploy. Whatever keeps the copies in step has to
merge concurrent edits without losing any of them, and has to cope with
someone coming back after editing offline.

## Decision

Each room's code is a [Yjs](https://yjs.dev) document (a CRDT, a
conflict-free replicated data type). Every browser keeps a copy. An edit
becomes a small binary update; the server applies it to its own copy of the
room's document and passes it on to everyone else in the room.

- **Joining** is a two-step handshake (`collab:hello` → `collab:sync`): each
  side sends its state vector, and the other answers with only what's
  missing. Edits made while offline merge in the same way.
- **Saving**: the server keeps a room's document in memory while anyone is
  in it, and saves both the text and the Yjs state to MongoDB, 1.5 seconds
  after the last edit and at least every 10 seconds while edits keep coming.
  When the last person leaves (or the server shuts down), it saves at once.
- **Cursors and selections** travel as Yjs *awareness* updates over the same
  connection.
- **Limits**: updates may only change the room's text, the code is capped at
  100,000 characters, and update and cursor sizes are bounded, so no client
  can grow a room without limit.

## Why

- A CRDT merges concurrent edits by design: two people typing in the same
  line both keep their characters, in the same order on every screen.
- Saving the Yjs state (not only the text) means that people who reconnect
  after a restart merge into the same history instead of duplicating text.
- Yjs is small, fast and widely used in collaborative editors, and its
  awareness protocol covers cursors and selections too.

## Trade-offs

- The server holds each active room's document in memory, which is one more
  reason the API runs as a single instance (see the README's limitations).
- The binary updates can't be inspected by eye, and validating them means
  decoding them on the server (done for every update).
- A Yjs document keeps some history (deleted items as tombstones), so it is
  slightly larger than the plain text.

## Alternatives considered

- **Send the whole file on every change (last write wins).** Simple, but
  when two people type at the same moment one of them loses their edit.
- **Operational transformation (as in Google Docs).** Also merges correctly,
  but needs a central server to transform every operation in order, and it's
  harder to get right for offline edits.
- **Lock the file to one typist at a time.** Avoids conflicts by avoiding
  collaboration, which defeats the point of the product.
