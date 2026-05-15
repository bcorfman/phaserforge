# AGENTS.md — GUI Workflow Guardrails (Root)

This repo is a *template kit* for enforcing workflow quality in GUI projects.

## Priorities (in order)
1. Intuitive primary workflow
2. Fewer total steps
3. Shorter mouse pointer travel distance
4. Style consistency (match established UI patterns)

## Significant Change Confirmation (template rule)

Before implementing a change that *significantly changes* an existing workflow or would violate an established style pattern:

- Ask the user to confirm:
  - workflows impacted (atomic/composite names if present)
  - current vs proposed primary path (brief steps)
  - entrypoints added/removed/merged (buttons/menus/shortcuts/gestures)
  - expected impact on steps + pointer travel
  - the style rule being broken (and why)
- Offer 1–2 alternatives that preserve style if there’s a tradeoff.

## Progressive disclosure

Keep root rules short. Put detailed style and interaction contracts in scoped `AGENTS.md` files near the code they govern.

