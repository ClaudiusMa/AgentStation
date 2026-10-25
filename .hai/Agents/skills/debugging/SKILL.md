---
name: debugging
description: Diagnose and repair a reported bug using discriminating evidence, one scoped correction at a time, and a check of the original symptom. Use for uncertain causes or failed repairs; known, reproduced corrections can use the same method without a separate coordinator.
---

# Debugging

Use the current task's expected behavior, scope, lane and authority. The lane's writer, Claudia or a worker, can use this method directly for obvious, reproduced, bounded fixes. Claudia routes unclear causes, repairs that failed without an established cause, and investigations needing intermittent/runtime/cross-component evidence to [Momus](../../momus.md). An ordinary bug or test failure does not require a new agent, report or review cycle.

## Establish the incident

Read the current contract/handoff and latest authoritative requirement. Record expected versus actual behavior, the failing inputs/environment and prior applied fixes. Reuse one task-centric handoff; for a simple case a few evidence lines suffice. Keep parent/controller, lane/candidate, authority, cumulative unsuccessful fixes and current next action there so resumes and worker changes preserve the incident.

Prefer an existing focused command/test or agent-operated interaction. Otherwise use a tiny fixture, browser/manual steps or captured failure evidence. Record the actual failing observation and exact steps/candidate; do not invent a baseline or revert user/peer work to produce one. Ask only for missing behavior, access or an interaction you cannot perform. Reuse the agreed pathway on later attempts.

## Diagnose before changing behavior

Trace the relevant path and compare a working case; reduce inputs while keeping the symptom. Distinguish observations from hypotheses. Choose a plausible, falsifiable hypothesis and the cheapest check that separates it from alternatives. State its prediction and record the outcome as supported, rejected or inconclusive. Do not require a fixed hypothesis count or perfect reproducibility.

Use an existing debugger, REPL, focused test, trace or profiler before adding instrumentation. If source/test/config probes are needed, the authorized worker owns them and their cleanup; Momus never writes them. Keep logs small, task-marked and redacted. A logging service or NDJSON is optional, never required.

For intermittent failures, use a bounded observation plan with counts, conditions and seeds/time where useful. A captured real failure can justify a discriminating probe; a clean run proves only its tested conditions. If evidence cannot support a cause, report not reproduced or diagnosis inconclusive and the exact missing evidence. Avoid speculative repairs presented as proven causes.

## Apply one correction and recheck

Explain the supported cause, gaps, one proposed causal correction and the symptom check. Existing local repair authority carries through the loop; diagnosis-only remains read-only. Material expected-behavior decisions, wider scope, high-cost checks and production/outward actions retain their existing gates.

The worker applies one coherent correction, adds regression coverage when it catches the real failure pattern at a useful seam, runs focused checks and returns the actual candidate/diff. Do not add tests that merely restate wording or mirror implementation. Reject or undo a failed probe/fix only through its owner's attributable edits after inspecting the current diff; preserve baseline, user and peer work. Never stack speculative corrections or reset/stash/clean a lane.

Re-run the original symptom and relevant neighboring behavior against the final candidate after temporary probe cleanup. For UI bugs inspect the rendered interaction at the relevant viewport/theme; typecheck is insufficient. For harness bugs compare the latest instruction to the actual role, task and lane. Momus, when routed, independently performs this symptom verification. Existing risk-based review obligations may be satisfied by assigned Momus review when he did not implement the change; no duplicate review is required solely because debugging occurred.

Label a verified correction, mitigation or unverified result accurately. A mitigation has its own checked scope and limits. Retained instrumentation needs a concrete reason, owner and revisit condition.

## Bound the loop

After each unsuccessful applied fix, keep its worker/candidate, prediction, attributable changes, observed result and the evidence informing the next attempt in the same handoff. A failing baseline, diagnostic probe or unavailable environment is not itself an applied fix. Continue only when useful new evidence supports the next correction.

Default: stop before a fourth unsuccessful applied fix for the same incident. Stop sooner for no useful new evidence, missing access, unclear authority, scope/resource collisions or a serious new regression. A new session, worker, slug or resume never resets the count. Report attempted explanations, unresolved evidence and the access/product/architecture decision needed; do not infer an architecture defect merely from three failures. Additional attempts or wider scope need a revised authorized approach recorded with the existing history.

Close with the supported cause, correction, fresh symptom evidence, limits and next owner/action. Keep integration, publication and cleanup status separate from the verified behavior; follow the native lane lifecycle and preserve unfinished work/resources.
