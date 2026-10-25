# Human Onboarding

<!--
## How To Use This File

- Read this file first when you return to the project.
- Keep this file stable unless your collaboration method changes.
- Treat `Human/` as human-owned: agents keep it current, and you approve every change. Move anything agents need into `Agents/` before delegating.
-->

Start here when you return to the project.

## Purpose

`Human/` is the human-owned workspace for product thinking, decision-making, and open questions. Its visibility is determined by the project's sharing and version-control policy; the folder name does not make its contents private. Agents do not read this folder by default.

Agents write it for you, and you own it by approving. When agents change their own docs, they note why and whether the change came from you. At the end of a session Claudia shows you the drafted updates in one batch. Approve, edit, drop, or defer each one. Nothing lands here without your batch approval. Approved entries accompany the accepted changes in an isolated candidate before integration; deferred and unreviewed items stay in the task packet and come back at the next session. `reflections.md` holds only your own words.

## Read Order

1. Read [brief.md](brief.md).
2. Read [decisions.md](decisions.md).
3. Read [open_questions.md](open_questions.md).
4. Read [reflections.md](reflections.md).

## Working Rules

- Changes in `Human/` do not automatically reach agents.
- Before delegating work, translate anything agents need into the agent-facing docs under `Agents/`.
- If you want a read-only alignment check between `Human/` and `Agents/`, invoke the `guardian` skill explicitly.
- Agents keep `decisions.md`, `open_questions.md`, and `brief.md` current through the `human-scribe` skill, and only with your approval. Approved README changes go through a task lane and merge only after your usual approval; the Human writer does not edit the README itself. Provisional notes live outside product files and Agents in task-owned Git metadata; cross-machine handoff needs an explicit checkpoint because Git does not transfer that metadata.
