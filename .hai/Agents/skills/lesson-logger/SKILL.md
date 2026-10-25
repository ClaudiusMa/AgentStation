---
name: lesson-logger
description: Turn a confirmed process failure into a structural fix and track whether the safeguard has been exercised. Claudia uses it during work, at intake or resume, and at closeout when feedback indicates the harness should have prevented a failure.
---

# Lesson Logger

Push confirmed lessons as far down the promotion ladder as possible while keeping always-loaded memory small. This is Claudia-owned. Workers and reviewers put evidence in their reports or handoffs; they do not write lesson state. A safeguard may be put in force while its learning remains pending verification.

## Trigger filter

Ask: **Should the harness realistically have prevented this feedback?**

Run on a false-complete report, repeated correction, violated written rule, approach-invalidating rework, or process surprise. Check at three points: when qualifying feedback or a repeated correction arrives during active work; at new-task intake or resume; and before closeout, including when handing off blocked work. Do not run on ordinary aesthetic steering, first-time preferences, new requirements, or a legitimate choice between options. Deduplicate the same evidence by its durable source reference and failure class; a new recurrence with new evidence is a new event even in the same session.

At intake and resume, read every `Pending verification` record regardless of age or sweep cursor, then compare normal intake docs with `Last swept:` in `Agents/lessons/INDEX.md`. Load this skill when pending work exists or new evidence/status/current-message triggers the filter. Advance the cursor only after each encountered event has a durable disposition and evidence reference; pending verification stays in its own section and is not hidden by the cursor. When an older installed index lacks that section, add it on the first needed write while preserving all existing entries, cursor, and pending Tier 0 specs. The index holds current routing and unresolved follow-ups only: never add completed verification history, and retain the `Pending verification` heading with `None.` when it is empty. The installer must not replace installed index state with the template.

## Read scope

1. `Agents/lessons/INDEX.md` for deduplication and the sweep cursor.
2. The current failure evidence or unswept planning/handoff events.
3. The applicable Standing Gates between markers in `Agents/project_context.md`.
4. Only lesson files surfaced by deduplication.

## Reflection and disposition

For each qualifying failure, record a brief reflection in the existing task handoff or report: expected behavior, observed behavior, the causal mechanism (mark hypotheses uncertain), why prior guidance did not prevent it, and the smallest effective safeguard. Do not create a separate narrative ledger. Check Standing Gates as well as routed lessons and the index before choosing whether to revise, promote, merge, or discard.

## Disposition ladder

- **Tier 0 — Mechanize.** A deterministic check can catch the class. Put a compact specification and its verification follow-up in the index for Claudia to queue. A written spec alone is pending, not learned. When implementation lands, remove only the completed spec text; retain the `Pending verification` record until the check has actually run with observable evidence.
- **Tier 1 — Institutionalize.** An unconditional category-wide rule. Add one imperative sentence between the `standing-gates` markers in `Agents/project_context.md`. Maximum 7 gates.
- **Tier 2 — Conditional lesson.** Judgment applies only under a specific trigger. Write one lesson of at most 30 lines from `TEMPLATE.md` and one routing entry. Maximum 25 index entries.
- **Discard.** The incident is not reusable. Leave its story in the existing handoff/report.

When a disposition puts a rule, gate, lesson, or check in force before it has been behaviorally exercised, add one `Pending verification` record even for Tier 1 or Tier 2; do not duplicate the safeguard there. Keep at most 25 failure-class rows in that section by merging related classes and retaining every evidence reference. Do not drop an unresolved reference to meet the cap; compact or merge its row. Each record names the tier and safeguard, durable evidence link(s), owner, and a concrete next check/event.

When a budget is full, merge, promote, or retire an entry in the same edit. A Tier 2 recurrence should promote toward Tier 1 or 0. A violated Tier 1 gate should mechanize if possible or be rewritten so it bites. A Tier 2 item that has not fired across ten subsequent completed tasks is a retirement candidate.

## Verification status

Require a corrective replay or check with observable evidence when feasible; do not block unrelated authorized work when validation is unavailable. An isolated agent executing the actual skill or routed task and producing observable artifacts can verify the exercised case. Reading instructions, checking that a spec exists, or a prose scenario walkthrough is limited review, not behavioral verification. Record that limitation and the next check. A passing corrective replay supports only the tested failure case; it does not guarantee future recurrence prevention. Keep unresolved work pending with its owner and next check, including at blocked handoff, and revisit it at every intake/resume regardless of the cursor.

When verification completes, write the result and evidence into the existing task handoff or lesson's `Verify` section (for a Standing Gate, use its source handoff or existing gate evidence reference), then remove the pending row. Do not add a completed-history section or another destination to the index; if no pending rows remain, keep `## Pending verification` and write `None.` beneath it. Do not copy the safeguard into a second destination. Report the outcome as pending, verified for the tested case, or discarded, with the cause, disposition/location, and next action when pending.

## Formats

Index entry:

`- [do|never] when {trigger} → {imperative}. ({file}.md · src {task} · fired {n})`

Standing gate:

`- {imperative sentence}. (src {task})`

Tier 2 lesson: Trigger, Rule, Why (at most three evidence lines), Verify.

Pending verification record: `- [pending · tier {0|1|2}] {failure class} → {safeguard}; evidence: {repo-relative link(s)}; owner: {role}; next check: {specific check/event}.`

## Completion

- Every index entry links one lesson file and every active lesson file has one entry.
- Pending verification records have a durable evidence link, owner, and concrete next check/event; their count stays within 25 class rows without dropping unresolved references.
- Budgets and the sweep cursor are current, and pending records remain visible independently of the cursor.
- Report each disposition in one line. Ask only when a proposed Tier 0 check adds high-cost behavior; all existing approval gates still apply.
