# PhaserForge

Project docs: [![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/bcorfman/phaserforge)

**Design the scene. Compose the behavior. Tune it live.**

**PhaserForge** is a gameplay behavior editor for Phaser built around one bet: the real slowdown is not movement code, collision code, or rendering code. It is **orchestration**.

The drag comes from timers, flags, ad-hoc state machines, event-order bugs, and one more special case buried in `update()`. PhaserForge pushes that glue into an **ACE** model: author **Actions**, gate them with **Conditions**, and trigger them from **Events**.

The claim is narrow on purpose. This is not “a better everything-editor.” It is a proof-of-concept that if orchestration becomes declarative, inspectable, and live-tunable, then a real kind of **10x game development** becomes possible for gameplay-heavy teams.

<img src="res/images/mainwindow.png?raw=true" style="width: 800px"/>

## Why It’s Different

| ACE authoring | Live tuning | Declarative reuse |
|---|---|---|
| Build behavior as **events + actions + conditions**, not glue code. | Change values while the game is running and feel the result immediately. | Keep gameplay logic in YAML so it can be inspected, versioned, duplicated, and remixed. |

## Highlights

| Design | Orchestrate | Ship |
|---|---|---|
| Multi-scene projects, base-scene-plus-waves, formations, text entities, scene graph editing, layout tools, and drag/drop asset workflows. | Event blocks, loops, patterns, parallel actions, counters, collections, collisions, triggers, semantic input maps, and live preview. | YAML round-trip, project library, online/offline workspace flows, cloud account support, GitHub connect, and GitHub Pages publishing. |

**Less glue. More game.**

## Start Here

- [DeepWiki](https://deepwiki.com/bcorfman/phaserforge) for architecture and feature details
- [Getting Started](https://bcorfman.github.io/phaserforge/docs) for the guided path
- [Workflow Reference](https://bcorfman.github.io/phaserforge/docs/reference/editor-workflows) for exact controls and editor flows
- [.repo-memory/product-memory.md](.repo-memory/product-memory.md) for compact repo-wide invariants and [.repo-memory/regression-playbook.md](.repo-memory/regression-playbook.md) for regression-prevention habits

## Requirements

[Node.js](https://nodejs.org) is required to install dependencies and run scripts via `npm`.

## Commands

| Command | Description |
|---------|-------------|
| `npm install` | Install project dependencies |
| `npm run dev` | Start the dev server (defaults to `http://localhost:8080`) |
| `npm run dev:cloud` | Start the dev server + local API (Vite proxies `/api/*` to the API) |
| `npm run build` | Create a production build in `dist/` |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:stories` | Run Storybook-focused tests |
| `npm run test:e2e` | Run Playwright end-to-end tests |
| `npm run test:all` | Run unit + e2e tests |
| `npm run docs:dev` | Start the docs site locally |

> For deeper setup, workflows, testing conventions, and cloud publishing details, use the docs and DeepWiki instead of treating this README as the full manual.

## Lightweight Repo Memory

This repo keeps durable, high-value product memory in `.repo-memory/`:

- `product-memory.md`: short product-wide invariants that future changes should preserve
- `regression-playbook.md`: compact guidance for turning repeated bug classes into lasting guardrails

Everything else stays where it already fits best:

- tests for executable guarantees
- `.plans/` for feature proposals, rollout notes, and workflow history
- scoped `AGENTS.md` files for local rules near the code they govern

## About `log.js`

`npm run dev` / `npm run build` run `node log.js ...` in the background, which sends a lightweight anonymous GET request (event + Phaser version + package name). If you’d rather not send this, use `npm run dev-nolog` / `npm run build-nolog`.
