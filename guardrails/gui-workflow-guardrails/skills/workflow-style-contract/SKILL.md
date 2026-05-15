---
name: workflow-style-contract
description: Extract existing UI style patterns (layout + interaction conventions) and enforce them for new/updated GUI features.
---

## When to use

Use this skill when:
- Adding a new panel/inspector section/tool
- Adding new canvas objects or interaction affordances
- You want to prevent “style drift” (new UI breaks established patterns)

## Process

### 1) Extract current style patterns

Scan the existing GUI for “style contracts”:
- Layout patterns (e.g., paired controls side-by-side, consistent spacing, foldout patterns)
- Interaction conventions (e.g., where object actions live; near-cursor vs inspector)
- Terminology conventions (verbs and labels)
- Discoverability patterns (hints/tooltips, menu placement)

Write them as **general rules**, not one-off examples.

### 2) Enforce style by default

When designing a new feature:
- Match the existing pattern first.
- Only deviate if it improves intuition or efficiency (fewer steps / shorter pointer travel).

### 3) Style vs workflow tradeoff gate

If a deviation could improve workflow but violates style:
- Stop and ask the user which to prioritize.
- Provide 1–2 alternatives that preserve style.

### 4) Regression checks

Before finishing:
- Ensure newly introduced UI does not reintroduce banned patterns (e.g., splitting conceptual pairs across lines).
- Ensure comparable objects get comparable affordances (menus, shortcuts, hover/cursor).

## Output format

- **Style contracts (generalized):** bullet list
- **Where each contract applies:** file/module/surface
- **Planned deviations:** none / list with rationale + confirmation status

## Exit criteria

- New UI matches existing style contracts (or approved deviations are documented).
- No “style drift” is introduced inadvertently.

