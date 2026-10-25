# AgentStation

A live train-station view of every AI coding agent running on this Mac. Each project is a station, each agent
session is a passenger standing on its platform, and a BART train rides a loop from station to station so a screen
left open shows you, project by project, what is working, what is waiting on you, and what has finished.

It reads the files that Claude Code, Codex and Cursor already keep on disk. It never writes to them, and nothing
leaves the machine.

macOS only. It needs Node 18 or newer (nodejs.org, or `brew install node`) and uses macOS's built-in `sqlite3`;
there are no npm dependencies.

## Get it

```sh
git clone https://github.com/ClaudiusMa/AgentStation.git
cd AgentStation
node server.mjs              # then open http://localhost:4477
```

To get a Dock icon instead, build the Mac app and install it into `/Applications`:

```sh
bash app/build.sh --install
```

## Open it

**The icon.** Once installed, `AgentStation` is in `/Applications`. Double-click it (or drag it to the Dock first). It starts the
server if it is not running and opens http://localhost:4477 in your browser (set `AGENTSTATION_PORT` to change the port). There is no window of its own: the
browser tab is the app. The first time, macOS may say it is from an unidentified developer: right-click the icon and
choose *Open*. It needs Node 18 or newer (nodejs.org, or `brew install node`); if Node is missing it says so.

Closing the tab leaves the server running quietly in the background (its log and pid are in
`~/Library/Application Support/AgentStation/`). Opening the icon again just reopens the page.

**From a terminal**, from this folder:

```sh
node server.mjs          # then open http://localhost:4477   (PORT=… to change)
node lib/collect.mjs     # print one snapshot of the data as JSON
```

Add `?demo=1` to the page for made-up agents (handy if none are running), `?station=<Project>` to start at one
platform; without it the page starts at the station with the most open sessions.

## How to read the page

**The platform.** The station is one project. Everyone standing on it is an open session in that project, drawn in
the colour of its tool (Claude orange, Codex blue, Cursor grey). Each passenger wears a tag over its head:

| Tag | Meaning |
|---|---|
| `…` on cream | working right now |
| `?` on blue | waiting on you: it asked something |
| `✓` on paper | finished its turn; nobody has read the result yet |

The small number in the tag (1, 2, 3…) is just an id: the oldest open session is 1. Sub-agents are 1a, 1b… and
stand in a line behind their parent, who carries a yellow flag. Hover a passenger to see its title and last update.
The three counters at the top left (Working / Waiting / Finished) count the sessions on this platform.

**The way out.** The agents are commuters. Once off the train and settled for a moment (long enough to read the
tags), they head up to work. Each station has one exit, running off the end of the platform the way a real one leads
to the concourse: a glass lift tower on a landing past the left end when three or fewer agents are here, an escalator
up past the right end when there are more. A big sign with the project's name hangs in the air over the exit. The
train waits until the last one has gone up, then the doors close. Their cards and counters stay; when the train comes
round again, they ride in again.

**The train and the loop.** The line under the figure is every project with an open session (the 12 most recently
active, if there are more), in alphabetical order. The train stops about twelve seconds at each station, then runs to the next; after the last one it comes
round to the first. The page always shows the station the train is at, so it tours every project on its own. When
the train leaves, the view switches halfway to the next platform and you watch the train slide in from the left.
*Previous* / *Next*, or a stop on the line, send the train there the short way round and the view goes with it.

**The list.** Under the line, the sessions at this station, grouped: *Waiting* (what each one asked you, as the
headline), *Working* (one line saying what it is doing now; its sub-agents inside), *Finished, read when you can*
(one line each). The list is empty while the train is moving; entries come in one by one when the doors open and
go out one by one as they close. The grey number on a card matches a passenger's tag. Click a card or a passenger
and the other is marked too.

## Where the data comes from

| Tool | What counts as an open session | What counts as working |
|---|---|---|
| Claude Code (`~/.claude/sessions/<pid>.json`) | its process is alive | `status` is `busy` (or `running`, `working`, `generating`, `thinking`) |
| Claude desktop session (`~/Library/Application Support/Claude/claude-code-sessions/*/*/local_*.json`) | not running, not archived, and something happened after you last opened it (the sidebar's dot) | never: it is waiting on you |
| Claude sub-agent (`~/.claude/projects/<slug>/<session>/subagents/*.jsonl`) | its transcript was touched in the last 2 min | always |
| Codex (`~/.codex/state_5.sqlite` and the rollout `.jsonl`) | not archived, updated in the last 60 min | a `task_started` with no later `task_complete` or `turn_aborted`, rollout touched in the last 10 min |
| Cursor (`globalStorage/state.vscdb`, `composerData:*`) | updated in the last 60 min | `status` is `generating`, or updated in the last 90 s |

A session's text (its ask, its last update) comes from the desktop app's turn wrap-up or post-turn summary, else
the last reply in its transcript. Archived sessions never show, and only the Claude account in use is read.

A project's name: a Claude desktop worktree (`<repo>/.claude/worktrees/<lane>`) is its repo; otherwise the git toplevel's folder name,
else the folder itself; the home folder is `Home`. One rule is specific to the author's own layout: anything under
`~/Documents/ProductLab/<Name>/` is `<Name>` (so are its lanes in `<Name>-worktrees/` and `_worktrees/<Name>/`); it
does nothing on a Mac without that folder (`projectFor` in `lib/util.mjs`).

Cursor's on-disk format is undocumented and the most likely to break after an update. The thresholds above are
constants at the top of each `lib/*.mjs` file.

## How it is built

No dependencies, no build step for the page. Node 18+ and macOS's built-in `sqlite3`.

```
server.mjs          static files + GET /api/state (JSON) + GET /api/stream (server-sent events), 127.0.0.1:4477
lib/collect.mjs     one snapshot: merges the three collectors, names projects, builds the station list
lib/claude.mjs      Claude Code sessions, desktop sessions, sub-agents
lib/codex.mjs       Codex threads
lib/cursor.mjs      Cursor composers
lib/util.mjs        read-only sqlite, partial file reads, project naming
public/index.html   the whole page: simulation (train, people), the figure, the line strip, the session list
public/core.js      the Colorfigures drawing engine (vendored, MIT, April Zhu; do not edit)
app/build.sh        builds dist/AgentStation.app; app/launcher.sh is what the icon runs; app/icon.svg
BRIEF.md            the owner's confirmed product decisions: the metaphor, what counts as open, the BART look
.hai/               the HAI-Harness: how agents work on this repo (start with .hai/Agents/onboarding.md)
```

The server collects at most once every 2 s however many tabs are open, and the stream sends a snapshot only when
something other than the timestamp changed. The page keeps its own simulation: a fixed pool of 9 passengers per
stop (the station's agents, who go up the lift or the escalator, plus grey spares who get back on), a train position
on the loop, and a view that follows it. Everything on the page is redrawn from that state every frame.

The state shape: `{ generatedAt, agents[], stations[], sources }`. Agent ids are prefixed by tool (`claude:`,
`codex:`, `cursor:`); `parentId` is set only when the parent is open too. Optional fields: `model`, `branch`,
`agentType`, `pid`, `entrypoint`, `summary`, `ask`, `state`.

## Changing it

Read `BRIEF.md` first: it holds decisions the owner has confirmed (the loop, the view following the train, the
staged arrivals, less text), and the latest decision wins over anything older in the code or docs.

- **The page** (`public/index.html`): reload the browser to see a change. The look is a set of materials and small
  drawing functions at the top; the train's timing is `DWELL` and the speeds in `tickTrain`; the exits are `LIFT`, `ESC`,
  `tickExit` and `exitsScene` (one of the two per station, chosen by `exitFor`); the list is `drawList`.
- **A collector** (`lib/*.mjs`): restart the server afterwards. `node lib/collect.mjs` shows what it now sees.
- **The app** (`/Applications/AgentStation.app`, once installed) carries its own copy of the server and the page, and the server it
  starts serves that copy. After any change, rebuild, reinstall and restart in one go, then open the icon again:

  ```sh
  bash app/build.sh --install
  ```

- **Rules**: read-only against the agent apps (sqlite is opened read-only); bind to 127.0.0.1 only; keep the
  Colorfigures look; keep text on the page to a minimum.

## Giving it to someone

Point them at this repository, or copy `/Applications/AgentStation.app` to their Mac. They need Node 18+ and the same
agent apps; the page shows whatever sessions their own Mac has. Nothing is sent anywhere. The app is not signed, so
the first time macOS may say it is from an unidentified developer: right-click it and choose *Open*.

## License

MIT, see [LICENSE](LICENSE). `public/core.js` is the Colorfigures drawing engine by April Zhu, vendored under its own
MIT license in [public/COLORFIGURES-LICENSE](public/COLORFIGURES-LICENSE).

This is a personal tool shared as is. It reads undocumented on-disk formats of other apps, so an update to any of them
can break a collector; issues and pull requests are welcome.
