---
name: human-scribe
description: Capture task-owned why-entries into provisional packet drafts, present one closeout batch, and write only approved Human items in the isolated accepted candidate with its changes before integration.
---

# Human Scribe

Agents maintain `Human/` and the public README; the user owns them by approving. Nothing reaches either without approval in the current batch. Claudia coordinates capture and review, and writes approved items herself in her task lane or assigns the worker holding the lane's writer slot. A direct Momus controller uses this method for its incident-specific choices; a delegated Momus reports them to its parent Claudia, who owns packet mutations. Neither entry authorizes global planning or direct Human writes by Momus. Provisional choices stay outside Agents and product files in the registered task packet.

## Packet adoption and discovery

Run commands from the retained recognized task lane, using one consistent physical harness target (`.` for root or `.hai` for the outer harness):

```sh
node .hai/Agents/hai-harness.mjs human-sync init --target .
node .hai/Agents/hai-harness.mjs human-sync status --target .
```

Initialization explicitly adopts the current traced state as baseline; it does not reconstruct earlier history. The current worktree workflow still requires a recognized task branch with canonical base/integration metadata, created from the clean primary checkout (normally on `main`). Missing, invalid, detached and non-task state refuses; never create a shared/global fallback or borrow another task's packet. Restore the recorded integration target for integration; packet reads can resume while that target is unavailable. When `worktree approve` merges the latest `main` into the lane, doctor may report traced paths that changed on `main`; append one entry naming them as merged from `main`, then acknowledge.

`status` returns `{packet, identity, head, snapshot}`. `packet` is the physical Git common directory's `hai-harness/tasks/<identity-hash>` path, containing `packet.json`, `decision-trail.md` and `human-inbox.md`. Identity binds branch, base, integration and physically resolved harness scope relative to the checkout; root and `.hai` have separate packets. Follow the returned directory, not an assumed `.git` directory in a worktree. Namespace and file symlink redirects refuse. Keep packet metadata private; do not put it in tracked code, Agents or Human.

If legacy `Agents/decision-trail.md` and `Agents/human-inbox.md` both exist, use `node .hai/Agents/hai-harness.mjs human-sync init --migrate --target .` instead. Migration requires regular files and a valid cursor, verifies exact copies and persists a content/hash supersession receipt before retiring either source. Existing or partial packets refuse for explicit reconciliation; never blindly delete populated legacy state. Init/update neither install these legacy files nor silently retire installed content.

## Sources and trace duty

- Packet `decision-trail.md`: append-only numbered `### T{n}` entries. Claudia, Athena, Hephaestus and direct Momus controllers trace changes to planning, project context, design guide, `designs/`, or role docs. Workers provide code-level evidence through handoffs, not trail entries. Trail/inbox, task contracts and handoffs need no entry.
- Entry fields: `Date`, `Change` (what changed and every affected traced path, relative to this harness target), `Why`, `Origin: user | agent`, `Area: product | design | process | code`. Origin `user` requires the user's actual statement or confirmation; never upgrade an assumption. Correct earlier entries by appending a numbered correction, not editing old text.
- Packet `human-inbox.md`: pending/deferred drafts and the `Captured through: none` or `Captured through: T{n}` cursor.
- Open `Decision needed from user` items in `Agents/planning.md`.

Capture reads the agent layer only, never chat transcripts. Do not read Human except the target file an assigned writer needs for a currently approved item. Preserve quoted user words in trace evidence for reflections.

Coordinate one writer slot for packet and lane mutations. Pause or hand off the active lane writer before changing trace, drafts or cursor; do not launch a hidden second writer. Read-only capture may inspect a stable agreed snapshot, but its resulting draft/cursor changes must be serialized. Record the packet identity/path and provisional state in the task handoff.

After the traced change and its new entry, run `human-sync status` again and acknowledge the exact observed state:

```sh
node .hai/Agents/hai-harness.mjs human-sync acknowledge --through T1 --head <HEAD> --snapshot <digest> --target .
```

Use the actual new trace ID and exact status values. Acknowledgment requires an unchanged prior trail prefix, a valid newly appended entry and a Change field naming every changed traced path; stale observations refuse. `doctor` compares touched commits, staged entries and physical contents/mode with the baseline and warns on pending/deferred drafts and untraced dirty or committed changes. Committing an acknowledged dirty change needs a fresh entry and acknowledgment of the committed state. A packet created before Momus remains readable with only that new role hash absent; doctor reports `Agents/momus.md` as unacknowledged drift until a normal new trace and acknowledgment adopt it. Never reinitialize the packet to clear this warning. Editing an unrelated trail/inbox item cannot clear drift. Initialization and acknowledgment never approve a Human draft.

## 1. Capture (fast tier, low effort)

1. Run `node .hai/Agents/hai-harness.mjs human-sync --target .` (or explicit `capture`). The CLI is offline, read-only and deterministic; it performs no model or network call. It lists entries after the packet cursor whose Origin is `user` or Area is `product`, `design`, or `process`, drops agent-origin `code`, and suppresses `- Applies: approved {draft}` reflections of already-approved items.
2. If nothing remains to capture, serialize the cursor update to the latest entry named and stop; no model call is needed. If a heading is malformed, preserve it for review and follow the command's numbering/cursor guidance rather than skipping it.
3. Otherwise add a draft for each listed entry under packet `## Drafts`, with `Status: pending`, `Target`, `Draft` and `from T{n}`. Skip a source/target draft already present; respect the existing cursor.
   - Origin `user` becomes a `decision` for `Human/decisions.md`. Add a `brief` or `readme` draft only when it changes the current product story or public description.
   - Origin `agent` becomes an `open question` for `Human/open_questions.md`: "Agents assumed {X}. Confirm or change?"
   - Unrecognized Origin/Area or malformed headings become open questions quoting the entry for review.
   - A `reflection` draft requires the user's quoted words.
4. Draft each open `Decision needed from user` item without an existing draft, marked `from planning.md`.
5. Serialize `Captured through:` to the latest numbered entry read, including filtered entries. Keep pending/deferred drafts; do not recapture or merge source entries.

Draft only what the source states. Do not add reasons or guess the user's view.

## 2. Closeout batch

- Before closeout, including blocked handoff, Claudia shows all pending/deferred drafts in one numbered batch. The user approves, edits, drops or defers each item; "approve all" applies to that batch only. No first backfill or unrelated Human change is implied.
- Approved/edited items go to the assigned writer; the user's edit replaces the draft. Keep source IDs and approved text in the handoff until verified integration.
- Dropped drafts leave the inbox but their trace remains. Deferred items retain `Status: deferred`; unaddressed items stay pending. Raise both at the next intake.
- Execution changes are reflected in Agents by their owning role. Its trace adds `- Applies: approved {draft}` to avoid capture again.

## 3. Writer (fast tier, medium effort)

Write the current approved batch in a verified isolated candidate together with the accepted changes before integration. That candidate is normally Claudia's own task lane; when a worker holds the lane's writer slot, assign the batch to that worker. The primary/shared checkout is not a direct Human write destination. Recheck the candidate identity and baseline, serialize shared Human log updates across candidates, and deduplicate against the latest accepted entries. Remove approved drafts only after successful candidate writes; retain approved-source evidence through integration. A rejected or interrupted candidate never promotes provisional choices; preserve its packet and handoff.

- `Human/decisions.md`: preserve version header and fields (`Date`, `Decision`, `Why`, `Tradeoffs`, `Follow-up`). Remove `- None recorded yet.` on the first entry. Skip decisions already recorded. Use `Not stated.` for unsupplied fields. A replacement adds `- Supersedes: {date}: {earlier decision}` while keeping the earlier entry. For an older version header with real entries, stop for an explicit archive/reset decision.
- `Human/open_questions.md`: preserve its fields; `Current leaning` states the agents' current behavior. Skip listed questions. Remove a resolved question only with the approved decision's own entry.
- `Human/brief.md`: change only approved sections so it reads as the current story.
- `Human/reflections.md`: append only the user's dated quoted words; no paraphrase or interpretation.
- `README.md`: the Human writer does not edit it. Approved README drafts go through a task lane, Claudia's own or a worker's, for verification and normal integration approval.

## Handoff and recovery limits

Retain the unfinished lane and packet, including deferred and unreviewed drafts. Completion cleanup retains packet metadata in Git common storage and refuses lane removal while pending/deferred drafts or uncaptured review items remain. Use `worktree approve --keep-worktree` while closeout is unfinished. After branch/worktree removal primary capture cannot discover that retired identity. Record its physical path and identity before cleanup.

For cross-machine handoff, create an explicit recoverable checkpoint:

```sh
node .hai/Agents/hai-harness.mjs human-sync checkpoint --output /private/checkpoints/task.json --target .
```

The destination parent must exist, the file must be new, and its physical location must be outside every registered worktree of this repository (including a `.hai` scope's product parent). Export includes packet metadata, files and observed state. Transfer privately and reconcile canonical branch/base/integration/scope identity on recovery. Git push/fetch does not transfer packets. There is no import command or automatic cross-host recovery. Automatic session attachment, submit freeze, full lifecycle enforcement, host write prevention, generation fencing and distributed leases remain pending; this method does not claim them.

## Writing rules

Write for someone returning weeks later: plain words, the why stated directly, no internal code names, lane slugs, or file paths unless the reader needs them.

Cleanup rules apply to every file, including decisions:

- Keep facts, names, dates, numbers, and the user's meaning exact.
- Cut significance inflation and promotional words ("pivotal", "a testament to", "groundbreaking", "seamless", "robust"). State the fact instead.
- Use plain verbs: "is" and "has" instead of "serves as" and "boasts"; "use" instead of "leverage".
- Delete trailing "-ing" phrases that add false depth ("highlighting its importance").
- Cut filler and hedging ("it's worth noting", "in order to", "could potentially").
- Name who decided. The user decided, not "the team" or "experts".
- No chatbot artifacts, flattery, or upbeat closing lines.
- Use em dashes and boldface sparingly. No emojis.

Full style applies to the brief and README drafts:

- Vary section and sentence shape. Do not end every section with a takeaway line.
- Do not pad lists to three items. Keep an item only if it carries its own meaning.
- Keep one term for one thing; do not cycle synonyms.
- Use a transition only when it carries logic ("because", "but", "so").
- Read it aloud. Rewrite anything that sounds like a press release.

Never add opinions, feelings, first-person voice, humor, or experience the user did not state. Decision entries get the cleanup rules only and never gain a view the user did not express.

## Attribution

The writing rules adapt selected guidance from [humanize-writing](https://github.com/jpeggdev/humanize-writing) (`SKILL.md` and `references/ai-tells.md`) by jpeggdev, used under the [MIT License](https://github.com/jpeggdev/humanize-writing/blob/main/LICENSE), Copyright (c) 2025 jpeggdev. This skill does not use that project's installer.
