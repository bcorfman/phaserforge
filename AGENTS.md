# AGENTS.md for phaserforge

## Project Guidelines

### Read Before You Act
For feature work or bug fixes, read the smallest useful set of files in this order:

1. `AGENTS.md`
2. `.repo-memory/product-memory.md`
3. `.repo-memory/regression-playbook.md`
4. Relevant scoped `AGENTS.md`
5. Relevant tests and implementation
6. Relevant `.plans/*` file only when needed for workflow history, feature background, or rollout context

The goal is to keep durable repo memory compact and reusable, while leaving detailed feature history in plans and executable guarantees in tests.

### TDD Requirement
All phases and implementation changes should be TDD-driven. Each gesture or editing behavior starts with store/helper tests, then scene-level interaction tests where practical, then implementation. Maintain comprehensive test coverage for reducers, helpers, and integrations.

### Completion Verification (E2E Required; Must Be Non-Flaky)
Before reporting any **code** changes (including new code) as completed, run the required E2E checks for the type of change and ensure they pass with **zero flakes**.

#### Local E2E policy (what `npm dev test:e2e` means)
Locally, **only after making GUI changes**, run **Chromium smoke** E2E tests:
- GUI changes include anything under `src/editor/**`, `src/App.tsx`, or `src/phaser/EditorScene.ts` (and any other user-visible UI/editor workflow changes).
- Treat running `npm dev test:e2e` locally as: “run Playwright E2E smoke on Chromium only”.
  - Implementation detail: run `npm run test:e2e -- --project=chromium --grep @smoke` (equivalently `PW_PROJECTS=chromium npm run test:e2e -- --grep @smoke`).

For non-GUI-only changes (server, data, helpers, etc.), prefer unit/integration tests and run E2E only when the change reasonably impacts editor behavior, app boot, or user-visible flows.

Important: GitHub Actions CI is configured to fail on flaky E2E tests. The bar for completion is:
- All E2E tests pass, and
- No E2E test is marked flaky (in any shard / browser / retry path).

#### Local Repro Requirement (When Fixing a Specific Browser Failure)
When addressing a reported E2E failure that is tied to a specific browser/project (e.g. `[edge]`, `[webkit]`, etc.), the agent MUST run that same Playwright project locally (at least the failing spec) as part of verification before declaring the fix complete, in addition to the baseline local E2E policy for the change (e.g. Chromium smoke for GUI changes).

WebKit local note for this Ubuntu 26.04 setup only:
- This is a machine-specific workaround for an Ubuntu 26.04 environment. Do **not** assume other developers or CI need it.
- Prefer the normal Playwright project invocation first on other machines. Only use the fallback below if native local WebKit repro is blocked by Ubuntu 26 host/runtime mismatches.
- `npm run test:e2e:webkit -- <spec>` uses the current repo's Ubuntu 26 native-workaround path.
- `npm run test:e2e:webkit:docker -- <spec>` is the preferred fallback on this machine when Docker is available, because it avoids most of the Ubuntu 26 native WebKit dependency churn.
- The repo-local `.playwright-lib-compat/` shim directory exists only to bridge Ubuntu 26 SONAME mismatches (`icu`, `xml2`, `jxl`) for this setup. Treat it as an environment workaround, not a cross-machine standard.

Non-code-only changes (docs, plans, mockups, etc.) do not require an E2E run. If E2E cannot be run (environment/tooling constraints), explicitly say so and report results of the closest equivalent verification performed.

#### Flake Policy (Fix vs Test Redesign)
When addressing an E2E failure:
- First, weigh whether a **direct product fix** is appropriate, or whether the test should be **redesigned to be less brittle** (prefer stable user-visible invariants over timing/cursor/style assumptions).
- If a direct product fix has been attempted and has failed to eliminate the flake **more than twice**, the agent **MUST redesign the test** to be less brittle (and keep coverage meaningful).

### ArcadeActions Reference Only
The `arcadeactions` directory is for reference only. Do not modify or add files to it. Use it to understand formations, actions, and arrange functions, but all changes must stay within `phaserforge`. For expandability, rely on external config files and editor-side logic.

### Playwright Workers Default (Do Not Change)
Do not change the default Playwright worker count in `playwright.config.ts`. The default must remain `3` (overridable only via `PW_WORKERS`).

## Editor UX / Workflow Policy

These rules apply to any changes under `src/editor/**`, `src/App.tsx`, or `src/phaser/EditorScene.ts`.

### Priorities (in order)
1. Intuitive primary workflow
2. Fewer total steps
3. Shorter mouse pointer travel distance
4. Style consistency (match established editor patterns)

### Significant Change Confirmation (ask before implementing)
Ask the user to confirm before implementing any change that is likely to:
- Significantly change a workflow (primary entrypoint, gesture/shortcut, selection semantics, moving controls across panes, or adding a second way to do the same task).
- Introduce, remove, or materially alter a style contract (examples: paired inputs become stacked; context menus added/removed/moved; actions moved from near-cursor surfaces to inspector/toolbar).

When asking for confirmation, include:
- Workflow(s) impacted (use `.plans/editor-workflows-inventory.md` names when available).
- Current vs proposed primary path (brief steps).
- Entry points added/removed/merged (buttons/menus/shortcuts/gestures).
- Expected change in steps and pointer travel.
- Style contract impacted (what rule changes and why).

### Style vs Workflow Tie-break
If an established style would be violated but the user may benefit from a simpler/shorter workflow, pause and ask which to prioritize before implementing. Provide 1–2 alternatives that preserve style.

### Documentation Update (only when workflows materially change)
If a workflow is added/removed/meaningfully altered, update:
- `.plans/editor-workflows-inventory.md`
- `.plans/ux-checklist-workflow-simplification.md` (only if decisions/checklist need updating)

## PhaserForge code navigation rule
For PhaserForge architecture work, use Serena first to locate and inspect relevant symbols before reading whole files.

Common targets:
- Phaser scene/editor classes
- action graph / behavior graph code
- serialization/deserialization logic
- command, selection, drag/drop, and undo/redo systems
- integration points between the visual editor and runtime actions

Do not scan the repo broadly first. Use Serena to identify the smallest relevant set of files and symbols, then read those files as needed.

## Repo Memory Rule

Use `.repo-memory/product-memory.md` for durable product invariants that should survive future refactors and feature work.

Use `.repo-memory/regression-playbook.md` for recurring bug classes and where their guardrails belong.

Do not turn `.plans/` into the canonical source of product truth. Plans are for proposals, feature history, and rollout detail; move durable conclusions into `.repo-memory/` when they should guide future work.
