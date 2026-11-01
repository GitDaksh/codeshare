# Decision records

Short notes on the choices that shape CodeShare: what was decided, why, what
it costs, and what else was considered. They were written after the fact,
from the code and how the project grew, so that anyone reading it (or
interviewing its author) can see the trade-offs and not only the result.

| # | Decision | In one line |
|---|---|---|
| [0001](0001-shared-editing-with-yjs.md) | Shared editing with Yjs | A CRDT merges edits made at the same moment, with no lost keystrokes |
| [0002](0002-socket-io-for-live-events.md) | Socket.IO for everything live | One authenticated connection per room page, with rooms, reconnection and acknowledgements built in |
| [0003](0003-run-code-in-the-browser.md) | Run code in the browser | A locked-down iframe and a worker cost nothing to run and keep code away from the app |
| [0004](0004-mongodb.md) | MongoDB | Rooms, profiles and scores are documents, and atomic updates cover what needs to be exact |
| [0005](0005-games-in-lockstep.md) | Games in lockstep | The server orders moves, every browser runs the same rules, and results count when browsers agree |
| [0006](0006-clerk-for-sign-in.md) | Clerk for sign-in | Accounts, sessions and tokens without building them, checked again on every request and connection |
| [0007](0007-one-room-per-connection.md) | One room per connection | A role belongs to one room, so it can never carry over into another |

Each record follows the same outline: **Context** (the problem), **Decision**,
**Why**, **Trade-offs**, and **Alternatives considered**.
