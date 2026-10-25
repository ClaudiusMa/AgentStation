# Design Guide

<!--
## How To Use This File

- This is the project's single source of truth for concrete visual style:
  tokens, components, spacing, type, motion, and voice.
- Builders (Augustus, Julius) read it before writing any UI and match it.
- Hephaestus designs within it; Athena and Hephaestus check the artifact's adherence to it. When a
  style choice conflicts with an outside pattern, THIS FILE wins — it is the
  project's truth, not the reviewer's preference.
- Replace every placeholder below with your real design system. Delete the
  sections you don't need; add the ones you do.
- Already have a design system elsewhere (a shared brand repo, a component
  library, a Figma spec)? Keep this file as a short pointer to that source
  instead of filling it in; agents still read this file before UI work.
-->

The concrete visual language for this project. Hephaestus designs within it,
builders match it, and reviewers check adherence to it. If it is not written
here, it is not the standard.

## Overview

- Product / surface this guide covers:
- Design intent in one line (the feeling and priorities — e.g. calm, dense,
  playful, enterprise-serious):
- Platforms / breakpoints:
- Light / dark support:

## Colors

Define tokens by role, not raw hex scattered through the UI.

| Token | Value | Use |
| --- | --- | --- |
| `color.bg` | `#______` | Page background |
| `color.surface` | `#______` | Cards, panels |
| `color.text` | `#______` | Primary text |
| `color.text.muted` | `#______` | Secondary text |
| `color.primary` | `#______` | Primary action |
| `color.border` | `#______` | Dividers, outlines |
| `color.success` / `warning` / `danger` | `#______` | Status |

- Contrast target (e.g. WCAG AA 4.5:1 for body text):

## Typography

- Font family (UI / mono):
- Type scale (size / line-height / weight):

| Role | Size | Line height | Weight |
| --- | --- | --- | --- |
| Display | | | |
| Heading | | | |
| Body | | | |
| Caption | | | |

## Spacing & Layout

- Spacing scale (e.g. 4 / 8 / 12 / 16 / 24 / 32):
- Grid / max content width:
- Density stance (compact vs. comfortable, and where each applies):

## Elevation & Depth

- Surface layers and when to raise (shadow / border / background step):

## Motion

- Duration + easing tokens:
- What animates, what must not (respect reduced-motion):

## Shape & Radius

- Corner radii by component size:
- Border weights:

## Components

The canonical component set. Reuse these before inventing new UI; a new
component needs justification.

| Component | Variants | Notes / when to use |
| --- | --- | --- |
| Button | primary / secondary / ghost / destructive | |
| Input | | |
| Card | | |
| Table | | |
| Modal / Sheet | | |
| Toast / Banner | | |

## States

Every screen must handle these. Define the standard treatment for each so
builders and reviewers judge against one bar.

- **Empty** — first-use / no data:
- **Loading** — skeleton vs. spinner, when:
- **Error** — message tone, recovery action:
- **Disabled** — why-disabled affordance:
- **Permission** — no-access / restricted:
- **No-results** — filtered/searched to nothing:
- **Long-content** — truncation / wrapping / overflow:
- **Many-record** — pagination / virtualization / bulk actions:
- **Partial-success** — some items failed:
- **Destructive-action** — confirmation, undo:

## Voice & Content

- Tone (e.g. plain, human, specific — no vague "Manage" / "Submit"):
- Capitalization, punctuation, number/date formats:
- Terminology to use / avoid:

## Accessibility

- Keyboard: all actions reachable and operable:
- Focus states: visible and consistent:
- Labels: inputs, icons, and controls have text equivalents:
- Color is never the only signal (pair with text / icon / shape):
- Minimum target size:

## Do's and Don'ts

- **Do:**
- **Don't:**
