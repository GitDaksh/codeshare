# 0005: Games in lockstep

## Context

Nine games can be played with friends: races, quizzes, Four in a Row, a
memory game, Byte Snake. Each needs every player to see the same game, live,
on connections of different speeds. Running every game's rules on the server
would mean a game server per game and more load on a free instance.

## Decision

The server doesn't run the games. It **orders the moves**; every browser
**runs the same rules** over the same moves.

- Each match gets a **seed**. Snippets, words, boards and food come from a
  seeded random generator, so every browser draws the same ones.
- Moves go to the server, which numbers them (`seq`), stamps them with the
  match clock, and sends them to everyone. Every browser computes the game
  from that one ordered list, so all of them show the same board, scores and
  winner. Your own moves show at once and are matched up when the server's
  copy arrives.
- The server **checks moves without understanding them**: only players in
  the match, only after the countdown, small flat payloads, capped counts.
- At the end each browser **reports the standings**. A result is recorded
  only when every player still in the match agrees. Scores count as
  **verified** on the leaderboards only when at least two browsers agreed;
  solo scores are reported by one browser and marked as such.

## Why

- One small relay serves every game; adding a game is mostly client code.
- Same seed and same moves give the same game everywhere, which also makes
  the rules easy to unit-test (they're pure functions of the moves).
- Agreement between browsers stops one player from inventing a result.

## Trade-offs

- **The rules live in the browser.** The server can't tell a legal move from
  an illegal one; it relies on every browser rejecting the same moves (the
  rules are deterministic, and tested to be).
- **Solo scores can be faked** by someone determined, since only one browser
  sees the game. They're capped at a believable maximum and shown as
  unverified.
- Clock-based games wait a moment at the end for moves still on their way,
  so a result takes slightly longer to appear.

## Alternatives considered

- **An authoritative game server** that runs every game's rules. The gold
  standard against cheating, but much more server code and load.
- **Peer-to-peer (WebRTC).** No server load at all, but it's harder to get
  through some networks, and nobody keeps the order of moves.
