---
name: code-review
description: Review an assigned code change for correctness, completeness, regressions, and relevant security concerns. Use for a risk-area change when you did not implement it; skip trivial prose and mechanical edits.
---

# Code Review

Review the producer's exact task lane against the request's recorded requirements: the task contract for a delegated worker, or the `planning.md` entry when Claudia built it. Include the referenced requirements, design, and acceptance criteria. Inspect the intended base-to-task diff, including added or untracked files in the assigned scope, plus affected callers needed to understand behavior. Do not broaden the work into a whole-repository audit unless the assignment explicitly asks for one. Do not create another worktree. This is a read-only assignment: it temporarily replaces implementation defaults while you retain your assigned worker role. Do not edit files, run mutating commands, or approve/integrate the change.

Trace the changed behavior through its affected callers, interfaces, data, and error paths. Check:

- each task-routed lesson or Standing Gate, and whether the producer's acceptance evidence exercises its rule;
- whether the change satisfies every assigned requirement and preserves existing validation, error handling, security, accessibility, and data-loss protections;
- whether callers, failure paths, and neighboring behavior introduce a regression or leave the requested behavior incomplete;
- whether the meaningful checks cover the changed behavior, including an important failure or regression case when one applies, and what remains unverified;
- whether there is a concrete, avoidable complexity cost: duplicating an existing project pattern, adding an unnecessary dependency, creating unused extensibility or configuration, or changing out-of-scope behavior;
- for any `hai-defer:` marker in the changed scope, whether it states the real limit and a concrete revisit condition. Do not scan unrelated files for markers.

Report only actionable findings supported by the source or task contract. For each, give severity, file and line, the trigger and user-visible or operational consequence, and a behavior-preserving correction direction. When impact or severity depends on an unverified environment or assumption, identify the uncertainty and the evidence or check needed to resolve it; do not present it as a confirmed failure. Do not invent findings to fill a report or score changes by lines of code. No findings is a valid result. State what you inspected, which checks you ran or observed, and what you could not verify.

For routed learning, distinguish instruction or scenario inspection from an executed replay/check with observable artifacts. Report the verification scope precisely: actual replay evidence verifies only the exercised failure case and does not establish future recurrence prevention. Give Claudia any durable evidence link; the reviewer reports evidence but does not change lesson state.

Send findings to Claudia. She fixes them herself when she built the change, or assigns them to the producing worker. The reviewer does not fix them or claim approval authority. If the producer changes code in response, review the affected changes against the same contract and report whether the findings are resolved. Keep the recheck scoped to the changed areas and their relevant callers.
