# Workflow Glossary

This glossary explains the editor surface names used across the tutorial pages and the workflow inventory.

## Assets Dock

The asset-management panel in the left sidebar. Use it to import images, audio, and fonts, then drag assets onto the canvas or other editor targets.

## Cloud Pane

The right-side pane tab that handles account access, GitHub connection, publish status, and GitHub Pages publishing.

## Entity List

The scene graph in the left sidebar. It lists scenes, sprites, text entities, formations, triggers, and project-level sections depending on the current sidebar scope.

## Event Block

An `Actions/Events` handler attached to an entity or formation. Event Blocks group action steps under a typed trigger such as scene start, update, input action, visible edge, custom event, or Bounds event.

## Event Source

The source or instigator carried by a runtime event occurrence. For a group-owned Bounds event, Event source is the individual member that crossed the boundary, not the whole formation.

## Formation

A named group of sprite entities with stable member order and optional layout metadata. Formations can be created from selected sprites, assets, or a live draft.

## Inspector

The right-side editing surface for the current selection. This is where you edit properties, action parameters, text settings, and many scene systems.

## Layout Popover

The floating panel opened from the on-canvas selection bar when multiple sprites are selected. It contains distribute, spacing, align, and set-position tools.

## Selection Bar

The near-cursor action strip that appears for canvas selections. Use it for actions that should stay close to the pointer, such as grouping and layout.

## Scene Appearance

The Scene inspector foldout for authored scene-level visual defaults, including the solid background color rendered behind background layers.

## Scatter

A formation draft preset that deterministically places generated members inside X/Y bounds from a stored seed. Scatter can also apply deterministic per-member random RGB tint during authoring.

## Set Property

A constrained no-code action that sets an allowlisted entity property such as X, Y, tint, alpha, visibility, or velocity from a typed value source.

## Value Source

A typed source for an action parameter value. Current Set Property value sources are constants, seeded random ranges, and selected primitive event fields.

## Viewbar YAML Controls

The open/save YAML controls in the viewbar. Use them to open YAML from disk, save back to an existing handle, or save to a new file.
