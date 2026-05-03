# UX Checklist — Workflow Simplification (Intuitive → Fewer Steps → Shorter Pointer Travel)

Goal: reduce “many ways to do the same thing” so there is one obvious, simplest path for each common task, and keep related controls co-located to minimize *shorter pointer travel distance*.

## 1) Selection + Grouping / Ungrouping

- [ ] Pick a single primary **Selection Actions** surface (near-cursor): keep **right-click** context menu + one on-canvas selection bar menu; avoid duplicating actions in multiple places.
- [ ] Replace all “Group” variants with one consistent **Group…** action:
  - Opens a small near-selection popover (name prefilled, Enter confirms, Esc cancels).
  - Use the same flow for button/menu/keyboard (Ctrl/Cmd+Shift+G) so naming behavior is consistent.
- [ ] Standardize ungroup verbs and placement under Selection Actions:
  - Formation selected: **Dissolve formation** (current A19).
  - Sprites selected: **Remove from formation** (current A18).
  - Optional: per-member remove stays, but routes to the same underlying command and terminology.
- [ ] Ensure “Add to formation…” is always accessible in the same place (Selection Actions) and is the only obvious path (avoid separate top-right vs bar variants).

## 2) Asset Import + Assignment

- [ ] Make **Assets Dock** the single import entrypoint (images/spritesheets/audio/fonts).
- [ ] Convert SpriteImportPanel into an “Advanced import” modal launched from Assets Dock:
  - Keeps multi-frame selection + auto-hitbox, but avoids a second competing import surface.
- [ ] Remove or fold **AudioLibraryPanel** into Assets Dock audio tab to eliminate duplicate import paths.
- [ ] Add direct manipulation for asset assignment to existing entities:
  - Drag an asset from Assets Dock onto a selected sprite to **replace its asset** (or drop onto an “Asset” row in Inspector).
  - Provide a clear affordance (hover highlight + tooltip) so the workflow is discoverable.

## 3) YAML Round-trip (tight local loop)

- [ ] Add **Load YAML** and **Export YAML** controls directly inside/above the YAML panel (keep toolbar buttons as secondary).
- [ ] Optional: add a single “Round-trip” mini-flow in YAML panel:
  - Export → edit → Load, with inline status/error near the textarea.
- [ ] Clarify “Unsaved” meaning:
  - If it means “editor state differs from last loaded YAML”, label it that way; otherwise provide a “Save” workflow.

## 4) Viewport Navigation Consistency

- [ ] Fix the Viewbar instruction copy to match implementation:
  - Replace “Shift + drag” with “Space + drag or middle mouse”.
- [ ] Consider adding a visible hint when holding Space (cursor changes are already present) to make A8 discoverable.

## 5) Missing / Under-supported Workflows

- [ ] Add an explicit workflow to **convert/relink assets** Embedded ↔ Path after import (project-level asset edit):
  - Minimal: “Relink…” action on an asset row in Assets Dock.
  - Ensure it updates any references consistently.
- [ ] Provide a “Save to same file” loop if “Unsaved” is meant as a save prompt:
  - If browser file handles are used, support “Save” (reuses last handle) + “Save As…”.

## 6) Audit Pass (to confirm simplification worked)

- [ ] For each major task (group, ungroup, import asset, place asset, replace asset, YAML loop, audio, input maps), confirm:
  - There is **one primary path** that is discoverable.
  - Secondary paths (shortcuts) are consistent with the primary path, not separate behaviors.
  - The path keeps UI interactions **co-located** (short pointer travel) where possible.

