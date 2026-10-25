# Custom roles

Add your project's own agents here. `update` never touches this folder except this README, so your roles survive every harness update.

One file per role, named after the role in lowercase (`apollo.md` for Apollo), starting with this frontmatter:

```markdown
---
name: Apollo
description: System and schema architect for this project.
route-when: changes to system structure, data schemas, or service boundaries.
writes: code
---

# Apollo

Read path: ../../project_context.md, then this file, then the task contract.

Rules for this role go here.
```

- `name`: the name users address. It must not be a built-in role (Claudia, Momus, Augustus, Julius, Athena, Hephaestus).
- `description`: one line on what the role does.
- `route-when`: one line naming the requests Claudia sends to this role.
- `writes`: `code` (may change product code inside its contract), `docs` (documents and design artifacts only), or `none` (read-only).

How agents use custom roles:

- A message that addresses or assigns the role by name gets that role; a mere mention ("ask Apollo about X") does not. A message that names no role goes to the project's default, which the `AGENTS.md` block states; make this role the default with `npx github:ClaudiusMa/HAI-Harness update --default-role <name>`.
- Claudia reads only this frontmatter at intake. She sends work to the role when its `route-when` clearly matches, names the role and its `writes` level in the contract, never gives code changes to a `docs` or `none` role, and asks you when a built-in and a custom role, or two custom roles, both fit.
- Every harness rule still applies: lanes, a clean primary, approvals, the Human boundary. A role file may add or narrow rules, never loosen them; on conflict agents follow the harness rule and tell you.
- The `writes` level binds the role however it is assigned, including when you address it directly: a `docs` or `none` role never changes code.
- A file with incomplete frontmatter, or a built-in name, is ignored for routing; `doctor` reports it.

Project-wide routing notes ("send schema changes to Apollo first") belong in `../../project_context.md`, not in the core role files, which `update` keeps current.
