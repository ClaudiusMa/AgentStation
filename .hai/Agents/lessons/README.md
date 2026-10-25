# Lessons

<!--
## How To Use This File

- `INDEX.md` is the only always-loaded lesson memory. Keep at most 25 routing entries and 25 pending failure-class rows plus the intake cursor; merge related pending rows without dropping unresolved references.
- Lesson files are conditional Tier 2 rules. Prefer a deterministic check or a Standing Gate when possible.
- Claudia writes this state only through the `lesson-logger` skill. Workers read only assigned lessons.
- Pending safeguards can be active while unverified. Claudia revisits every pending row at intake/resume regardless of the sweep cursor, records completion evidence in the existing handoff or lesson, and removes the row without adding history to the index.
-->

- Routing index and sweep cursor: [INDEX.md](INDEX.md)
- Conditional lesson template: [TEMPLATE.md](TEMPLATE.md)
- Trigger filter and promotion ladder: [../skills/lesson-logger/SKILL.md](../skills/lesson-logger/SKILL.md)
