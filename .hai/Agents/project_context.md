# Project Context

<!--
## How To Use This File

- Use this file for durable project context only.
- Update it when the product shape, system boundaries, stack, or non-negotiable rules change.
- Do not use this file as a sprint log, task tracker, or session summary.
-->

Shared high-level context for all agents. This file is intentionally architectural and durable. It should not be used as a sprint log, status board, or session history.

## 1. Purpose

- Describe only the durable facts every agent should know before touching the project.
- Give every agent enough shared context to reason about the codebase before reading role docs or task docs.
- Stay high level. Detailed implementation notes, file-by-file guidance, and temporary task context belong elsewhere.

## 2. Maintenance Contract

- Do update this file when the product shape changes, a core subsystem changes, a backend/storage choice changes, or a project-wide rule changes.
- Do not update this file for task progress, bug triage, one-off fixes, completed phases, or temporary work-in-progress notes.
- The agent who changes architecture or introduces a new durable constraint is responsible for updating this file in the same task.
- If a subsystem is in transition, document the boundary or ambiguity at a high level instead of narrating the full history.
- Put task baton-pass notes in [handoffs/](handoffs). Confirmed process failures go through `lesson-logger` into [lessons/](lessons), the Standing Gates block below, or a queued deterministic check.
- If a section does not matter yet, leave it short or blank rather than inventing detail.

## 3. What This Project Is

- Product or system name: AgentStation ("Agent Line")
- One-sentence description: A local, live, hand-inked isometric train-station view of every AI coding agent session on
  this Mac (Claude Code, Codex, Cursor), with readable cards saying what each session needs from the user.
- Primary users, operators, or collaborators:
  - Group: the owner, running many agent sessions across ProductLab projects, who wants to see what's working and what
    is waiting on them.
- Core workflows, surfaces, or jobs every agent should understand:
  - Platform figure: one station (project) at a time; passengers are sessions; a train runs along the line.
  - Line strip: a straight subway-style line of every station with an open session; click a stop to go there.
  - Session list: per station, sessions grouped by what the user must do, with each session's ask as the headline.

## 4. Durable Technical Shape

- Platform(s), runtime(s), or environment(s) only if they affect design decisions: macOS only (reads macOS app data
  paths); Node 18+, zero npm dependencies; a modern browser.
- Major technologies or stack choices only if they are architecturally important: `server.mjs` (static files + `/api/state`
  JSON + `/api/stream` SSE on 127.0.0.1:4477) and `lib/*.mjs` collectors; the page is one HTML file drawn with the
  vendored Colorfigures engine (`public/core.js`, MIT, April Zhu; skill in `~/Documents/Skills/skills/colorfigures`).
- Main data, state, or storage owners: none of our own. All data is read from the agent apps' files on each poll.
- External systems or dependencies that materially constrain the project: undocumented on-disk formats of Claude Code
  (`~/.claude/sessions`, `~/.claude/projects`, `~/Library/Application Support/Claude/claude-code-sessions`), Codex
  (`~/.codex/state_5.sqlite` + rollouts) and Cursor (`Cursor/User/globalStorage/state.vscdb`). Any app update can
  change them; read through the macOS `sqlite3` CLI.

## 5. Boundaries And Source Of Truth

- Main components, subsystems, or ownership areas:
  - Collector: `lib/claude.mjs`, `lib/codex.mjs`, `lib/cursor.mjs`, merged by `lib/collect.mjs` into one state shape.
  - Server: `server.mjs`, one shared rate-limited collect (2 s) for all clients.
  - Page: `public/index.html` (simulation, figure, line strip, session list); `public/core.js` is vendored, not edited.
- Source-of-truth boundaries agents must not violate: the agent apps own all session data. AgentStation is strictly
  read-only against them (SQLite opened `-readonly`, never write to their files).
- Coupling, layering, or interface rules agents should preserve:
- Migration, compatibility, or legacy constraints that affect reasoning:
- Environments, secrets, or operational dependencies:

## 6. Core Project Rules

- Rule: Never write to any agent app's files or databases.
- Rule: The server binds to 127.0.0.1 only; nothing leaves the machine.
- Rule: Visual style is the Colorfigures look (paper, ink, three-tone shading) in a BART / Bay Area setting, as decided
  in `BRIEF.md`; session text is plain, readable system sans, one plain card style (no quote-bar or extra card
  variants), and as little text as possible.
- Read, query, preview, or inspection paths should stay side-effect free when that is a system requirement.
- If degraded or offline operation matters for this project, preserve a usable failure mode when dependencies are unavailable.

## 7. Collaboration Map

- [onboarding.md](onboarding.md) is the mandatory first read for every agent.
- `project_context.md` is shared, high-level context only.
- Role docs (`claudia.md`, `augustus.md`, `julius.md`) define stable collaboration rules. Worker scope is planner-assigned unless your project intentionally adds durable role biases.
- Each agent session has at most one active role and does not switch roles. A parent task may contain a Claudia session plus separate role-isolated worker sessions that Claudia delegates to.
- [planning.md](planning.md) is Claudia-owned and is the single iteration source of truth for task allocation, implementation strategy, and worker execution planning.
- Claudia leads: she plans and, by default, builds in the task lane herself. Augustus and Julius own a write scope only when Claudia delegates it on a trigger. Each lane has one writer at a time.
- When a request is clear, sufficiently confident, approved, and safely scoped, Claudia builds it directly, or delegates it when a trigger in onboarding applies. She pauses for material ambiguity, scope collisions, missing high-cost approval, or outward-act approval.
- `tasks/` holds current worker assignments for Augustus and Julius when Claudia delegates.
- `designs/` holds Hephaestus-owned, non-code design contracts and supporting artifacts.
- `handoffs/` holds task baton-pass notes for coordinated worker execution and later chats/sessions.
- `lessons/` holds task/problem-specific learnings worth reusing in later chats.
- `Human/` is not part of default agent context.

## 8. Non-Negotiable Rules

- Always read a file before editing it, even mid-session.
- Never merge to `main` unless the user explicitly asks.
- Never push to `origin/main` unless the user explicitly asks.
- Preserve explicit source-of-truth boundaries. Do not create competing state without documenting it here.
- Keep side-effect-free paths side-effect free when the project defines them that way.
- Risky migrations and backfills need explicit approval before live execution.
- High-cost validation should stay opt-in.
- When a rollout changes identity, ownership, permissions, or durable data shape, preserve existing data before polishing workflow details around it.
- Prefer durable constraints over exhaustive description. If a detail will go stale quickly, it probably does not belong here.
- Add project-specific rules below:
  - Rule: `BRIEF.md` holds the user's confirmed product decisions (the station metaphor, 9-passenger pool, what counts
    as open); read it before changing behaviour.
  - Rule: Restart `server.mjs` after collector changes; page changes only need a browser reload.

### Standing Gates (lesson-promoted)

Always-on completion rules promoted from confirmed failures. Claudia edits only between these markers through the `lesson-logger` skill. Keep at most 7 gates.

<!-- standing-gates:start -->
<!-- No standing gates yet. -->
<!-- standing-gates:end -->
