# 0003: Run code in the browser

## Context

People run their code constantly: a Run button, a practice problem's tests,
Lens recordings, Hotspots and the Big-O meter, which runs a function many
times on growing inputs. Running untrusted code on a server means a sandbox
service, per-run costs and queueing, which doesn't fit a free deployment.
Running it in the browser is free, but the code must not be able to touch
the app: its cookies, storage, session or page.

## Decision

Code runs in the browser of the person who presses Run, inside two walls:

1. **A sandboxed iframe** (`sandbox="allow-scripts"`, deliberately without
   `allow-same-origin`), which gives it an opaque origin: no access to the
   app's cookies, storage, session or page. The frame also has its own
   Content Security Policy (`default-src 'none'`), inherited by its workers,
   so the code can't make network requests either. The one exception is the
   address Python is downloaded from.
2. **A Web Worker inside that frame**, so a runaway loop never freezes the
   tab. Time limits are enforced from outside: if a run takes too long, the
   app removes the iframe, which kills the worker.

JavaScript gets a fresh frame for every run. TypeScript's types are stripped
with Babel first. Python runs on Pyodide (CPython compiled to WebAssembly),
downloaded on first use and kept warm. The Practice judge stays outside the
sandbox: only test inputs go in, and the results are compared outside.

## Why

- No server cost and no queue: a run starts instantly however many people
  are coding.
- The browser's own isolation (opaque origins, CSP, workers) is the wall,
  and it's well tested.
- Everything that runs code (Run, tests, Lens, Hotspots, the meter) reuses
  the same sandbox, so it's hardened once.

## Trade-offs

- **C++ and Java can be edited but not run**: their compilers are too big
  to download into every visitor's tab, so they'd need a server-side sandbox.
- **Results are worked out in the browser**, so a determined person could
  fake their own test results or solo scores. That only affects their own
  profile, and the leaderboards mark solo scores as unverified.
- **Python's first run is slower**: Pyodide is a large download.
- Performance depends on the person's device, which the Big-O meter accounts
  for by measuring growth, not absolute time.

## Alternatives considered

- **A server-side sandbox (containers, Firecracker, or a hosted judge like
  Judge0).** Runs any language and can't be faked, but costs money per run,
  needs careful isolation, and adds latency.
- **Running code in the page itself.** Simplest, but code could read the
  session and act as the user. Never an option.
