# 0004: MongoDB

## Context

CodeShare stores rooms (with their code, members and roles), chat messages,
profiles (with practice progress), interviews (questions, notes, scorecards)
and game scores. Most reads fetch one thing by its id or owner. A few writes
must be exact even when two requests arrive together: joining a room,
solving a problem, saving a new personal best.

## Decision

[MongoDB](https://www.mongodb.com) (Atlas, free M0 tier) through Mongoose.

- **Documents match how the app reads.** A room carries its members and
  viewers; a profile carries its solved problems; an interview carries its
  questions and scorecards. One read gets what a page needs.
- **Atomic updates where it matters.** Joining adds a member with
  `$addToSet` (never twice), solving pushes a problem only if it isn't
  already there (one update with a guard), and a new best is saved only if
  it's still higher than the stored one. No read-modify-write races.
- **Indexes for every hot query**: rooms by owner and by member, profiles
  by user and username (unique when set), game scores in leaderboard order,
  and chat by room and time.

## Why

- The data is document-shaped, and the schema changed often while features
  were added (roles, practice, interviews, games). Adding a field usually
  needed only a default; the two bigger changes (invite links for old rooms,
  and interviews with several questions) are small steps the server runs at
  startup.
- Atlas's free tier is enough for this project.
- Mongoose gives schemas, validation and typed models on top.

## Trade-offs

- No joins: a leaderboard reads scores, then the matching profiles in a
  second query (cached for 15 seconds, so it stays cheap).
- No foreign keys: deleting a room deletes its chat in code, not by the
  database.
- Arrays inside documents need bounds (a room remembers at most 1,000
  members) to keep documents well under MongoDB's 16 MB limit.

## Alternatives considered

- **PostgreSQL.** Would serve the app just as well, with joins and
  constraints. The document shape and the flexible schema while the product
  was changing tipped it to MongoDB.
- **Firebase or Supabase.** Faster to start, but they would have moved the
  permission rules (roles, invites) out of the API into database rules.
