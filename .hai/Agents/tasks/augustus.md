# Augustus Tasks

Planner owns this execution contract. Augustus uses it as the current queue. Historical queues belong under `Agents/_archive/tasks/`.

Keep this file execution-only. Do not copy product rationale, option analysis, or planner strategy here.

## Assigned Queue

- Status: done (2026-10-25; reported, accepted by Claudia; the lane's writer slot is back with Claudia)
- Task / outcome: the platform figure's depth sorting is unstable while things move: parts pop in front of or behind each other from frame to frame (people against each other, the station sign, the lift tower, the escalator, the floating sign). Find why and make the draw order stable, so nothing visibly flickers while passengers walk, queue, ride the escalator or the lift.
- Read first: `../onboarding.md` → `../project_context.md` → `../augustus.md` → this file
- Active now: none (T-13 depth-sort flicker delivered)
- Next in sequence: none
- Queue order and priority: one task, P1
- Method reference: `../skills/implement/SKILL.md`
- Model tier / effort: standard tier, medium effort (checkable by watching the figure; narrow blast radius: one file; judgment bounded by the engine's sorting rules)
- Requirements / design references: `BRIEF.md` (the commuters decision), `README.md` "How to read the page"; the engine's sort is `byDepth` / `sepOrder` in `public/core.js` (vendored, read-only: parts sort by a separating axis on their `box`, viewer side +x,+y,+z last, falling back to the depth of the box centre or an explicit `at` point). The scene's parts are built in `platformScene` and `exitsScene` in `public/index.html`.
- Files / write scope: `public/index.html` only (lane `../AgentStation-worktrees/station-exits`, branch `task/station-exits`). Never edit `public/core.js`. Do not commit.
- Acceptance criteria: (1) with `?demo=1`, watched through at least two full stops (a lift station and an escalator station), no part visibly changes draw order from one frame to the next except where a mover genuinely passes another; (2) people in front of the station sign, the lift tower, the escalator and the floating sign draw over them, people behind draw behind; (3) riders on the escalator and in the lift cab stay drawn as before (clipped through the doorway / hood); (4) no script errors; (5) the rest of the page (train, cards, strip, counters) unchanged.
- Rejected options (do not build): editing `core.js`; removing the exits, the floating sign or the clipping; hiding flicker by making parts opaque or by freezing movement.
- Existing patterns / interfaces to reuse or preserve: every part gives a `box: [[x0,y0,z0],[x1,y1,z1]]`; parts that overlap in all three axes fall to the centre-depth comparison, and JavaScript's sort with a comparator that is not a total order gives unstable results as boxes move: the likely cause. Prefer boxes that always separate (tight boxes for people, split or merged parts for the exits, an explicit `at` where a centre misleads) over new mechanisms. Keep the hand-inked Colorfigures look.
- Read-only / preserve: everything outside `public/index.html`.
- Current handoff: none; write a short report in your final message instead.
- Dependencies: none.
- Verification: run `PORT=4481 node server.mjs` from the lane and open `http://localhost:4481/?demo=1&station=JiuGui` in the built-in browser; watch the figure over two stops; script globals are not reachable from the browser tool's isolated world, so to inspect state inject a `<script>` element that writes JSON to `document.documentElement.dataset` and read that. Stop the server you started when done (by its pid, nothing else; another server runs on 4477 and is not yours).
- Routed lessons / Standing Gates: none
- Required worker evidence: what the cause was, what you changed, which stations and movers you watched and for how long, what still flickers if anything, and the console's error state.
- User-approved to execute: yes (the user asked for this worker)
- High-cost approval: not needed
- Outward acts authorized: none

## Stop Conditions

- Stop for a broken assumption, scope expansion, or anything that needs `core.js` changed; report it instead.
