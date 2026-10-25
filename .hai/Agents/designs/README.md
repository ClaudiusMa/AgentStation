# Design Artifacts

Hephaestus owns this folder as the durable, non-code source of truth for human-interface designs.

## Structure

Use one folder per designed artifact or experience:

```text
designs/
└── <artifact-slug>/
    ├── design.md
    └── <optional supporting visuals>
```

`design.md` is the canonical design contract. Keep it current rather than creating competing drafts. Add supporting files only when a wireframe, annotated screenshot, flow diagram, state matrix, motion storyboard, or exported image materially removes ambiguity.

## Boundaries

- Store design intent, flows, specifications, exact copy, state behavior, accessibility, and build acceptance here.
- Store implementation assignment and sequencing in `Agents/handoffs/`.
- Store live worker queues in `Agents/tasks/` and planner state in `Agents/planning.md`.
- Never store or generate executable HTML, CSS, JavaScript, framework code, configuration, tests, build output, or runtime assets here.
