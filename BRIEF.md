# AgentStation

A live, hand-inked isometric railway showing every AI agent (Claude Code, Codex, Cursor) on this Mac.

Visual reference: Joshua Guo's Yamanote Line platform (x.com/jshguo/status/2112878577121407421), made with the
Colorfigures skill (`~/Documents/Skills/skills/colorfigures`, MIT). Match that look: warm paper, ink outlines,
flat three-tone shading, blue cast shadow, hand-drawn wobble, pill buttons, WAITING / BOARDED style counters.

**Setting: BART, the Bay Area (decided 2026-10-22).** The train is a legacy BART A-car: unpainted aluminium, a blue
band, the white fibreglass wedge nose with the raked windscreen and two headlights, an amber destination sign naming
the next station. The platform is grey concrete with a dotted yellow tactile strip and no screen doors; a third rail
runs beside the track; across the tracks a tall brown-tile wall (Market Street style) carries the station's name in
big white Helvetica over the line's blue band. Platform signs are black with white Helvetica and an amber LED board.
The sign on posts in the middle of the platform is gone (decided 2026-10-25): the big floating sign over the exit
names the station now, with the wall.
The page accent is BART blue; the line strip is the BART yellow line with white stops and a silver train.

## Metaphor (decided, revised 2026-10-21)

- **Station = project with an open agent.** Only projects with a working or idle agent are on the line.
- **Archived sessions never show**, running or not, and only the Claude account in use is read.
- **Open = running, or unresolved.** A Claude session with no process still counts while its sidebar shows the
  "needs input" dot (not archived, and something happened after the user last opened it), however old it is. The
  app's "Mark as completed" isn't read (it lives in the app's own storage), so a session marked completed without
  being opened stays until it is opened or archived.
- **Passenger = agent session.** Colour per tool (Claude / Codex / Cursor).
- **Every open agent stands on its platform.** An idle session is waiting on the user's feedback, so it still counts
  as open. Each wears a name tag: a number that matches its card under the line, and "…" (working), "?" (asking
  you) or "✓" (finished, unread). Decided 2026-10-21: the figure alone must say what each agent is doing.
- **A fixed pool of 9 passengers.** Picking a station sends the train there with all 9 aboard: the station's open
  agents (tool colours) and the spares (grey). The doors open and everyone gets off first; the agents walk to their
  spots, the spares wait on the boarding marks, then get back on and leave with the train. One agent at a
  station means 8 get back on.
- **Agents are commuters (decided 2026-10-25).** They don't stand on the platform until the view moves on: after a
  moment at their spots they go up to work, like people taking the train to the office. A station has one exit, not
  both: a lift for a few (three or fewer), an escalator for a crowd. The exit is big and runs out past the end of the
  platform like a real one (the lift tower on a landing past the left end, the escalator up and away past the right
  end). The project's name hangs over the exit as a big floating sign: not on the structure, but a thing in the scene
  with a 3D position that scales with the figure. The train waits until everyone who got off has gone up, then
  leaves. Their cards, numbers and counters stay for the stop; next time round they ride in again.
- **Closed session:** it boards the train if the train is standing there with its doors open, otherwise it walks off.
- **The train runs along the line**, and the user can choose which station it goes to next.
- **The line is a loop and the view is where the train is (decided 2026-10-22).** After the last station the train
  comes round to the first (off the right of the strip, back in from the left). It stops long enough to read, so the
  page loops through every project's status on its own. There is no "stay": the user steers only with Previous /
  Next or a stop on the line, and the view follows the train there. The line strip shows station names only.
- **Less text (decided 2026-10-22).** No summary line over the session list and no "Last update" on ask cards. The
  passenger number on a card is a quiet grey mark, not primary information.
- **Staged motion (decided 2026-10-22).** Nothing appears all at once. The train runs left to right with a cab at
  each end (nose leading), fully leaves one platform before sliding into the next, and stops as the strip's marker
  reaches the dot. The list is empty until the doors open, then the entries come in one by one while the passengers
  get off and on, and go out the same way as the doors close; leaving matters as much as arriving. The page opens
  with the train arriving. The counters sit at the top left of the figure and the buttons at its bottom right (decided 2026-10-22).

## Screens (decided)

1. **Platform** (the only figure): one station's isometric platform, drawn like the reference.
2. **Line strip** above it: a straight subway-style line of every station with live counts and the train's position;
   click a stop to go there. (A loop map was tried on 2026-10-21 and dropped: the user wants only the station.)
- The train runs back and forth along the line and turns round at the ends.

## Data (verified 2026-10-21)

| Tool | Source | Signal |
|---|---|---|
| Claude Code | `~/.claude/sessions/<pid>.json` | cwd, title, `status` (idle / busy), live pid |
| Codex | `~/.codex/state_5.sqlite` `threads` + rollout `.jsonl` | cwd, title, branch, parent thread, turn started/finished |
| Cursor | `Cursor/User/globalStorage/state.vscdb` `composerData:*`, `~/.cursor/agent-cli-state.json` | name, status, lastUpdatedAt, workers by folder |

All read-only. Cursor's format is undocumented and the most likely to break.

## Behaviour (decided 2026-10-21)

- **View only.** Picking a station moves the train there and shows how many agents work there. It changes nothing in
  the project. Later, dispatching agents from here could be a feature (more agents ≈ more reasoning on a project).
- **No compute accounting.** Free compute isn't a fixed pool. When an agent starts work at a station the train isn't
  at, it quietly appears on that platform. The train never has to deliver it.
- **Closed session → the passenger leaves** the system (walks off and fades).
- **Sub-agents follow a tour guide.** An agent with sub-agents carries a little flag, and its sub-agents walk in a
  line behind it.
