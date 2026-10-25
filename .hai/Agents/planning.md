# Product Planning

<!--
## How To Use This File

- Claudia owns this file in an installed product harness.
- Keep current product truth, backlog, active strategy, worker assignments, approvals, and user decisions here.
- Replace placeholders with real project state after installation.
- Keep completed evidence concise and move bulk history to `_archive/`.
- Do not use this file as a worker journal.
- The upstream HAI-Harness repository keeps this file blank; real project work belongs only in installed field instances.
-->

Planner-owned single source of truth for the current iteration.

Last updated: 2026-10-25 PDT
Last updated by: Claudia
User check-in after material clarification: not required
High-cost execution approved: no
Outward acts approved: none

Status options: `inbox`, `ready`, `next`, `in progress`, `blocked`, `done`, `dropped`.
Type options: `feature`, `bug`, `chore`, `design`, `experiment`.
Priority options: `P0` (must now), `P1` (soon), `P2` (nice), `P3` (maybe).

## Governing Rule

- The latest confirmed human decision supersedes every older conflicting decision, plan, task, handoff, or historical note.
- Apply clear precedence to keep work moving, but always flag the conflict and update the stale durable source through its owning role.
- Archived material is evidence only. It is never executable unless this plan or the current worker task explicitly restates it.

## Current Product Truth

- Product direction: v1 is built and running locally (see `BRIEF.md`, `README.md`). Next is polish and coverage.
- Current scope boundary: view only. Nothing the page does changes a project or a session.
- Non-negotiable constraint: read-only against the agent apps; local only.
- Latest decision that supersedes older material (2026-10-21, user: "make it clear what all agents in a station work
  on"): the figure itself must say what each agent is doing. Every passenger wears a numbered name tag (… working,
  ? asking you, ✓ finished, unread) and the session cards carry the same numbers; counters are Working / Asking you /
  Finished (the spare-passenger Waiting / Boarded counters and the engine's Labels callouts are gone); a one-line
  station summary heads the list; clicking a card or a passenger marks the other. Archived and signed-out-account
  sessions never show.

## 1. Inbox (untriaged)

- **[ ]** (type) Short description — notes / links

## 2. Backlog

| ID | Title | Type | Priority | Status | Owner | Notes / Links |
| --- | --- | --- | --- | --- | --- | --- |
| T-1 | Verify Codex and Cursor sessions appear while actively running | chore | P2 | inbox | - | Neither had an open session during v1; heuristics in `lib/codex.mjs` / `lib/cursor.mjs` constants. |
| T-2 | Decide "unresolved" for Codex and Cursor | feature | P2 | inbox | - | Claude uses the sidebar dot (not archived + activity after last focus). Codex/Cursor still use "updated in last 60 min". |
| T-3 | Read Claude's "Mark as completed" | feature | P3 | inbox | - | Stored in the app's own storage, not the session JSON; a session marked completed without opening stays until opened or archived. |
| T-4 | First commit of the project | chore | P1 | done | - | Committed as 1d27d3a on master (user-approved, 2026-10-21). |
| T-5 | Visual critique: make each agent's work readable on the station | design | P1 | done | Claudia | Built 2026-10-21 in `public/index.html` (tags, counters, numbered cards, summary line, pick-to-match); README and BRIEF updated. Not committed. |
| T-6 | Name tags overlap when passengers stand close | bug | P3 | inbox | - | Nudge tags apart or stagger them. (The centre station sign was removed 2026-10-25, user: the big floating name is enough.) |
| T-13 | Commuters: agents who get off go up the lift (three or fewer) or the escalator (more) and disappear before the train leaves; one exit per station, big, running off the platform's end; the project name as a big floating 3D sign | design | P1 | done | Claudia | 2026-10-25, user: "like workers taking the train to their office"; then "either elevator or escalator", "larger, extend out the platform", "name bigger, can float, 3D position and scale". Lane `task/station-exits`, `public/index.html` (`LIFT`, `ESC`, `exitFor`, `tickExit`, `exitsScene`); BRIEF and README updated. Verified in the browser on demo data (lift tower rides, escalator rides at JiuGui, no script errors). Depth-sort flicker fixed by Augustus (standard tier, user-requested): `orderParts` draws parts as a chain ordered only where lines of sight pass through both boxes, plus tighter boxes for people, train, platform, escalator and cab; 144 unexplained swaps per ~4000 frames down to 1–2 per run, one rare pinwheel left at the sign-to-queue path. Claudia re-checked a full stop. Not integrated. |
| T-14 | Train drawn off the platform mid-stop when the station set changes (a station appears or vanishes, every stop's `s` shifts by SP while `asTrain.s` and `at` stay); seen on demo data | bug | P2 | inbox | - | Keep the dwelling train on its stop when `layoutStations` moves it: re-anchor `asTrain.s` to `stationOf(at).s`. |
| T-12 | Fix the flash before arrival: the view flipped back for ~100 ms in the last half unit; the list collapsed when emptied; counters bumped. Now: tolerant loop distances, the stop just left excluded by identity, list keeps its height, platform eases in | bug | P1 | done | Claudia | 2026-10-22. Verified by driving tickTrain/tickPeople in a fixed-step simulation (90 s, no blips, no NaN). Not committed. |
| T-11 | Cards leave one by one as the doors close; counters at the figure's bottom right | design | P1 | done | Claudia | 2026-10-22, user: "disappear is as important as appear". Not committed. |
| T-10 | Two-cab A-car, left-to-right running, staged arrival and card entry, quiet numbers | design | P1 | done | Claudia | 2026-10-22, user decisions in BRIEF.md (photo reference: legacy A-car). Not committed. |
| T-9 | Loop line, view driven by the train, no Stay here, leaner list, Claude worktrees named by repo | feature | P1 | done | Claudia | 2026-10-22, user decisions in BRIEF.md. `lib/util.mjs` projectFor maps `<repo>/.claude/worktrees/<lane>` to the repo. Not committed. |
| T-8 | BART / Bay Area look: legacy A-car with wedge nose, concrete platform, brown-tile wall, black Helvetica signs, yellow line strip | design | P1 | done | Claudia | 2026-10-22, user: "more like BART, whole vibe more Bay Area". Decided look in BRIEF.md. Not committed. |
| T-7 | View follows the train (loop through every project); strip shows names only; Mac app | feature | P1 | done | Claudia | 2026-10-21, user decisions. Follow mode with "Stay here" toggle, `?follow=0`; `app/build.sh` → `dist/AgentStation.app`. Not committed. |

## 3. Active Queue

- Current handoff: [`handoffs/agentstation-v1.md`](handoffs/agentstation-v1.md) (v1 built; nothing in progress).

### <Task ID> — <Title>

- **Status:** ready / in progress / blocked / done
- **Priority:** P0 / P1 / P2 / P3
- **Owner sequence:** Claudia builds by default → Hephaestus/Athena if needed → delegated worker only on a trigger → independent review only for risk areas
- **Builder:** Claudia / delegated worker (trigger: none)
- **Current handoff:** `handoffs/<file>.md`, or none
- **Design contract:** `designs/<artifact>/design.md`, or none
- **Dependencies:** exact artifact, ordering, external state, or independent
- **User-approved execution:** no
- **High-cost approval:** not required / pending / approved
- **Outward-act approval:** none; each push, PR, deploy, message, or other external act must be named explicitly

Required outcome:

1. Observable result.
2. Preservation constraint.
3. Stop condition.

Completion evidence:

- Files or surfaces changed:
- Low-cost verification passed:
- High-cost verification run or intentionally not run:
- Remaining user-owned verification:

### 3a. Current Iteration Strategy

- Goal:
- Why now:
- Context gathered:
  - Fact:
  - Fact:
- Architectural or product decision:
  - Decision:
  - Constraint:
  - Out of scope:
- Delegation (Claudia builds by default; name the trigger when a worker builds; two workers only if both queues clear the Parallel Split Gate):
  - Augustus:
  - Julius:
  - Parallel Split Gate result:
- Risks / ambiguity:
  - Risk:

### 3b. Implementation Queues

Assigned queue for Augustus (only when delegated):

1. Not assigned.

Assigned queue for Julius (only when delegated):

1. Not assigned.

Advancement rule:

- Continue directly to the next approved queued task after the current one is complete.
- Pause for a blocking user decision, broken assumption, write-scope collision, missing high-cost approval, or unapproved outward act.

Verification rule:

- Use low-cost verification by default.
- Record high-cost verification explicitly before assigning or running it.
- Never claim rendered, integration, or networked acceptance when it was not performed.

### 3c. Decision Needed From User

- Decision:
- Why it blocks:
- Options already ruled out:

## 4. Bugs (optional detail)

| Bug ID | Title | Severity | Status | Repro steps | Notes |
| --- | --- | --- | --- | --- | --- |
| B-1 | Replace with real bug | medium | inbox | Repro steps | Notes |

## 5. Feature Ideas / Roadmap

- **Idea:** Short name
- **Why:** User or product rationale
- **Rough scope:** S / M / L
- **Notes:** Links, dependencies, or previous decisions

## 6. Archived State

- Retired handoffs: [`_archive/handoffs/`](_archive/handoffs/)
- Delivered or superseded worker queues: [`_archive/tasks/`](_archive/tasks/)
- Older planner snapshots: [`_archive/`](_archive/)
