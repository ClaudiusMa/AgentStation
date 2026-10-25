# Handoff - agentstation-v1
Last updated: 2026-10-21 19:20 PDT
From: Claude Code session "Running agents visualization feasibility" (built v1 before the harness was installed)
To: next assigned worker (Claudia by default)

## Status
- Done:
  - Collector for Claude Code, Codex and Cursor sessions (`lib/`), merged into one state; server on 127.0.0.1:4477
    with `/api/state` and `/api/stream` (SSE).
  - Claude: running sessions (live pid) plus desktop-app sessions that still show the sidebar's "needs input" dot
    (not archived, last activity after last focus), from the current account only; archived ones never show. Each
    carries `summary` and `ask` from the app's `turnWrapUp` / `postTurnSummary`, else the transcript's last reply.
  - Page (`public/index.html`): one platform figure after the Yamanote reference; fixed pool of 9 passengers per
    station (open agents stay, grey spares ride in, get off, then re-board); straight line strip of stations with
    an open session; session list grouped as asks (plain cards), "Finished, waiting for you to read" (rows),
    "Working now". Engine colour/wobble/view controls hidden.
  - Colorfigures skill installed in `~/Documents/Skills` (committed there); HAI-Harness 0.3.0 installed here with
    default role Claudia.
- In progress: none.
- Not started: backlog T-1 to T-4 in `planning.md`.

## Files touched or in scope
- `server.mjs`, `lib/collect.mjs`, `lib/claude.mjs`, `lib/codex.mjs`, `lib/cursor.mjs`, `lib/util.mjs`
- `public/index.html` (all page logic), `public/core.js` (vendored engine, do not edit), `public/COLORFIGURES-LICENSE`
- `BRIEF.md` (confirmed product decisions), `README.md` (run instructions, heuristics table)
- `../.claude/launch.json` in ProductLab (preview config `agentstation`, port 4479)

## Contracts / invariants
- Read-only against every agent app's files; SQLite via `sqlite3 -readonly`. Server binds 127.0.0.1 only.
- Decisions in `BRIEF.md` are the user's: station = project with an open session; idle sessions count as working;
  9-passenger pool; the train arrives full, everyone gets off, spares re-board, at every stop of the viewed station.
- Session list: one plain card style only (no left accent bar, no label above the ask cards, no Open links, no
  "Needs you" counter). The user rejected each of those explicitly.
- Do not declare these names in page script: they belong to `core.js` (see the skill's Reserved names). `cap` is
  already taken by the "Platform" caption element in `index.html`.
- Simulation runs on real elapsed time (`tick` in `index.html`), not the engine's capped frame dt; doors stay open
  while anyone is still getting off or on, up to 40 s.
- Limit: "Mark as completed" in the Claude sidebar is not read (T-3). Codex/Cursor "open" = updated in the last
  60 min (T-2).

## Verification
- Ran: `node lib/collect.mjs` against live data (19 Claude sessions over 5 stations, archived and old-account
  sessions absent, cross-checked with the app's session list); browser checks at JiuGui, PKS, ProductLab,
  TheseDays with no script errors; train stop sequence logged over three consecutive stops.
- Not run: Codex or Cursor sessions while active (none were open); phone-width layout; any automated tests (none
  exist).

## Blockers / decisions needed
- None. First commit is 1d27d3a on `master` (no remote); the checkout is clean, so harness lanes can start.

## Exact next step
- Take T-1: open a Codex thread and a Cursor agent, run
  `node lib/collect.mjs`, and check both appear with the right station, status and title.
