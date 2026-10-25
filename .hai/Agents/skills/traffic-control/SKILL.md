---
name: traffic-control
description: Reconcile concurrent controller sessions, child workers, write scopes, verification, generated assets, and protected baselines in a shared workspace. Use when ownership overlaps, another lane appears during active work, or a worker reports drift or collision.
---

# Traffic Control

Traffic control is a coordination gate, not a delegation engine. It decides whether the current root controller may safely build in its own lane or coordinate the current task's workers, and whether its bounded delegated Momus may coordinate an incident worker. It never implements product work, assigns work to a peer controller, or converts a peer controller into a worker.

The contract is runtime-neutral. A host may call the units tasks, threads, chats, sessions, agents, or subprocesses; map those names onto the identities below without changing their authority.

## Identity Model

- **Root controller:** the lead session that received the user's request. It may write in its own task lane as that lane's single writer, or delegate to child workers. Claudia is the default root controller; an explicitly named Momus root owns its own bug task. A delegated Momus is an incident coordinator under the existing root, not a new peer controller.
- **Parent task:** that exact root user task, identified by its task/session identity. It is not the repository, branch, worktree, task document, or product area.
- **Child worker:** a role-isolated execution session belonging to that parent task. Augustus and Julius are the default worker roles. Bounded Momus may reuse the named authorized same-task worker or spawn at most one probe/repair child at a time; preserve root/parent provenance and the settled lane.
- **Peer controller:** another root planning session with its own user request. It remains a controller even when it owns overlapping files or active workers.

Role and parent-task provenance are immutable during ordinary traffic control. A handoff may transfer a queue only after an explicit user decision and an accepted handoff; file overlap alone never transfers authority.

## Return One Decision

Complete the census and return exactly one operating state:

- **CLEAR:** the current controller may proceed in its own lane, or spawn or resume its own child worker there.
- **SEQUENCE:** another lane owns a dependency or overlapping target; wait for the named boundary, then proceed in the current controller's own lane or spawn or resume its own worker.
- **TRANSFER_REQUIRED:** safe continuation requires moving ownership between root controllers; stop and ask the user to approve the transfer.
- **BLOCKED:** authority, baseline, or scope cannot be established safely; report the missing evidence.

The current controller, not this skill, turns `CLEAR` into its own building or into worker assignments.

## 1. Freeze Only New Motion You Own

While the census is incomplete, do not spawn another child worker, start shared mutable verification, rewrite generated output, change server lifecycle, or initiate an outward act in the affected lane.

Let safe read-only work finish. Pause or interrupt only child workers owned by the current parent task. A peer controller and its workers remain outside the current controller's command authority. Do not wake, redirect, stop, archive, delete, or inject instructions into a peer task.

Existing approval gates for builds, dependencies, commits, pushes, pull requests, deployments, publishing, sharing, and external messages remain in force.

## 2. Take a Read-Only Two-Layer Census

Inventory both control planes:

- **Peer-task plane:** list, read, or wait on relevant root-controller tasks using the host's read-only task capabilities.
- **Owned-child plane:** list, message, follow up with, interrupt, or wait on child workers belonging to the current parent task.

Peer-task communication is not part of the normal census. If a peer collision needs human attention, report it to the user in the current task instead of steering the peer task.

Include a task only when its checkout, worktree, generated target, mutable runtime, or outward target can affect the current request. Treat titles and summaries as hints; confirm state from recent task messages, current coordination documents, Git state, and the filesystem. Run `node .hai/Agents/hai-harness.mjs worktree status --all` for the actual lanes and the files each has changed; peer prose is a hint.

## 3. Build the Traffic Ledger

Record the minimum evidence needed to decide:

| Field | Required evidence |
| --- | --- |
| Parent task | Root task/session identity that received the request |
| Controller | Root controller identity and immutable role |
| Lane | Task, branch, worktree, and integration target |
| Workers | Owned child-worker identities, roles, and states |
| Write scope | Exact files, directories, generated outputs, and config keys |
| Dependencies | Producer/consumer order and shared mutable setup |
| Verification | Build, test, browser, server, or export activity |
| Protection | Baseline hashes or trees that must remain exact |
| External acts | Commit, push, pull request, deploy, publish, share, or message |

Read the smallest coordination set that establishes those facts: `Agents/planning.md`, relevant task documents and current handoffs, then read-only dirty inventories or hashes when ownership is disputed. Do not infer write scope from a role name, and do not infer role or parent-task provenance from write scope.

## 4. Classify Collisions

A collision exists when lanes share a file, generated artifact, configuration key, producer/consumer contract, build/export target, mutable service, port, migration, seed, deployment target, or protected invariant.

Apply authority in this order: latest confirmed human direction, current task contract created after that direction, current accepted handoff/evidence, older planning text, then archived material as history only.

Resolve collisions without changing role identity:

- independent scopes may proceed in parallel through the current controller's own child workers;
- coupled scopes become one ordered worker queue under their existing root controller;
- peer-owned overlap returns `SEQUENCE`;
- moving work between peer controllers returns `TRANSFER_REQUIRED`;
- missing or contradictory evidence returns `BLOCKED`.

Never solve a collision by appending the current user's request to a peer controller's worktree or by treating that controller as available worker capacity.

## Fast Resume

Fast Resume applies only when this same root controller already holds a settled ledger for this same parent-task identity, the same recorded child worker resumes in the same worktree, scope is unchanged or narrower, and no build/export target, protected baseline, dependency, or outward act has expanded.

Any new root task, peer controller, worker identity, scope growth, unknown session, hash drift, or shared target requires the full census. Fast Resume never applies to a controller session as though it were a worker.

## Monitor and Close

Monitor owned child workers through the host's child-agent capabilities. Re-read a peer task only when new evidence can change the traffic decision; do not subscribe the current conversation to unrelated peer updates.

Before reporting traffic clear, reconcile final hashes, generated parity, verifier changes, protected baselines, lane status, and remaining dependencies. Confirm that no duplicate writer remains on the current parent task and separately name any peer lane still active.

End with the operating state, authoritative parent task and controller, owned worker lanes, sequencing boundary or transfer decision, completed verification, and actions deliberately not taken.
