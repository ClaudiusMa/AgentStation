# Custom skills

Add your project's own skills here. `update` never touches this folder except this README, so your skills survive every harness update.

One folder per skill, named after the skill, holding a `SKILL.md` that starts with this frontmatter:

```markdown
---
name: release-notes
description: Draft release notes from merged changes in this project's house style. Use when preparing a release.
---

# Release notes

Steps for the skill go here.
```

- `name` matches the folder name and must not be a shipped skill name (the folders in `../../skills/`).
- `description` says what the skill does and when to use it; agents choose skills by it.

Agents read this frontmatter when choosing a method and load a skill when the task contract names it or its description clearly fits. A shipped skill with the same name wins. A skill with incomplete frontmatter is skipped; `doctor` reports it.
