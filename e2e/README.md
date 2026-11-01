# Browser tests

These drive the real app in a real browser (Chromium, through Playwright),
against the real server and a real MongoDB. Two people in a room, a match of
Four in a Row between two browsers, a solo race against bots: each suite
plays it out and checks what's on screen.

The only thing swapped out is sign-in. Clerk can't be scripted, so the tests
use small stand-ins (`stubs/`): in the app, the signed-in user is a
`cs-test-user` cookie; on the API, a `test:<name>` token. The stand-ins are
built into test copies only (`dist/`, `.app/`) and are never deployed.

## Run them

You need Node 22 and MongoDB on `localhost:27017` (any empty database works;
the tests use `codeshare-e2e` and empty it first).

```sh
cd server && npm ci && cd ..
cd client && npm ci && cd ..
cd e2e && npm ci
npx playwright install chromium   # once
npm test                          # everything: about 15 minutes
```

`npm test` prepares the test copies, starts the API on port 5055 and a
production build of the app on port 3000, runs every suite one after another
and stops everything again. A suite that fails gets one more try, and the run
fails if it fails twice.

- `node run.mjs four snake` runs only those suites.
- `npm run test:dev` uses `next dev` instead of a production build (quicker
  to start).
- `E2E_MONGODB_URI=...` points at another database.
- `E2E_OFFLINE=1` works without internet (local fonts, and the code editor
  from `node_modules` instead of its CDN).

Each suite's output goes to `logs/`, and the screenshots taken along the way
to `shots/`. In CI both are kept with a failed run (the run's "Artifacts").

## The suites

| Suite | What it covers |
| --- | --- |
| `room-regression` | Two people in a room: presence, chat, live editing |
| `framework` | Games hub, a lobby, the countdown and results with friends |
| `landing-games` | The landing page's Games section, its hero badge, and the navbar on tablets |
| `hover-jitter` | Cards that lift on hover hold still under a resting pointer |
| `keys-guard` | Game keys keep working when a page or extension grabs keys |
| `keyword-bitflip` | Keyword and Bit Flip, solo |
| `keyword-online` | Keyword with friends |
| `quizzes` | Output Oracle, Big-O Blitz and Bug Hunt |
| `racer-solo` | Code Racer against bots, and the saved result |
| `reactions` | Emoji reactions float across everyone's screen during a match |
| `four` | Four in a Row: against the computer and between two browsers |
| `pairs` | Pair Programming (the memory game), solo and with friends |
| `snake` | Byte Snake, solo and with friends |

The server's own tests (API, rooms and permissions, sockets, games) and the
app's unit tests live with the code: `npm test` in `server/` and `client/`.
