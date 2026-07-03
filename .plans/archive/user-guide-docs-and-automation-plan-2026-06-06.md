# User Guide Docs Structure + Automation Plan

## Summary
Create an in-repo docs site for first-time PhaserForge users that:
- walks a user through the `pattern_demo` workflow step by step
- then walks the same user through publishing that demo to GitHub Pages
- reuses the workflow language already defined in [editor-workflows-inventory.md](/home/bcorfman/dev/phaserforge/.plans/editor-workflows-inventory.md)
- automates as much of the reference content and imagery as practical so the guide does not become a manual-maintenance burden

Recommended delivery shape:
- author the guide in Markdown/MDX inside the repo
- publish it as a GitHub Pages docs site
- generate workflow-reference pages from `.plans/editor-workflows-inventory.md`
- generate close-up panel images from Storybook and targeted Playwright screenshots

## Goals
- Give first-time users a single guided path from blank editor to published demo.
- Keep the guide aligned with current editor workflows and naming.
- Favor cropped, panel-level images over noisy full-window captures.
- Make docs updates reviewable in PRs like product code.
- Minimize manual screenshot recapture work after UI changes.

## Non-goals
- Do not use the GitHub wiki as the primary authoring surface.
- Do not attempt to auto-generate the full tutorial narrative from workflows alone.
- Do not make the docs system block normal app development if screenshots temporarily lag behind.
- Do not redesign editor workflows in this plan; this is a documentation and automation plan.

## Recommendation
Use an in-repo static docs site, preferably VitePress.

Why VitePress:
- Markdown-first and easy to author in the same repo as the app
- low setup cost compared with Docusaurus or a custom docs app
- straightforward GitHub Pages deployment
- works well with generated Markdown pages and copied static assets

If MDX-level interactivity becomes important later, Docusaurus is the strongest alternative. It is not necessary for phase 1.

## Source of Truth Model
Split the docs into authored content and generated reference content.

### Authored content
Authored pages should live under `docs/` and contain:
- the first-time-user tutorial
- publishing walkthroughs
- troubleshooting
- short conceptual explanations where workflow inventories are not enough

These pages are curated and step-by-step. They should be optimized for learning, not exhaustiveness.

### Generated content
Generated pages should be derived from repo sources and rebuilt by script:
- workflow reference pages generated from `.plans/editor-workflows-inventory.md`
- optionally, extracted action IDs and workflow IDs for consistent cross-linking
- screenshot manifest pages if needed later

These pages are optimized for accuracy and maintenance, not tutorial tone.

## Proposed Docs Structure
Recommended top-level layout:

```text
docs/
  index.md
  getting-started/
    index.md
    pattern-demo.md
    publish-to-github-pages.md
  reference/
    editor-workflows.md
    workflow-glossary.md
  troubleshooting/
    github-pages-publish.md
  assets/
    screenshots/
      storybook/
      playwright/
  .vitepress/
    config.ts
scripts/
  docs/
    generate-workflow-reference.mjs
    capture-storybook-screenshots.mjs
    capture-docs-screenshots.mjs
    screenshot-manifest.json
```

## Content Architecture
The guide should not mirror the workflow inventory one-to-one. It should use the inventory as a backing reference while presenting a simpler learner path.

### Page 1: Getting Started
`docs/getting-started/pattern-demo.md`

Purpose:
- take a new user from empty scene to working pattern demo

Structure:
1. What the user will build
2. Before you start
3. Create a new empty scene
4. Import the ship asset and create the seven sprites
5. Lay out the sprites using the canvas and layout tools
6. Add the text labels
7. Attach each movement pattern
8. Run the demo in Play mode
9. Save the YAML
10. What to do next

Rules:
- each section should reference the underlying workflow IDs where useful, but not lead with them
- each section should use 1 to 3 close-up images
- each step should end with a visible success check

### Page 2: Publish to GitHub Pages
`docs/getting-started/publish-to-github-pages.md`

Purpose:
- take the finished demo and publish it via the Cloud pane to GitHub Pages

Structure:
1. What publishing requires
2. Sign in to PhaserForge
3. Connect GitHub
4. Open the Cloud pane
5. Fill in title and repository name
6. Run publish precheck
7. Publish and confirm overwrite behavior if needed
8. Verify the Pages URL
9. Troubleshooting common publish failures

This page should align to `W16` and the `A63` through `A66` workflow family.

### Page 3: Generated Workflow Reference
`docs/reference/editor-workflows.md`

Purpose:
- expose the atomic and composite workflows in a cleaner reader-facing format
- provide stable anchors that tutorial pages can link to

Generated sections:
- atomic workflows
- composite workflows
- repetitive/redundant workflows
- missing/incomplete workflows

### Optional Page 4: Workflow Glossary
`docs/reference/workflow-glossary.md`

Purpose:
- explain editor terms like scene graph, inspector, cloud pane, selection bar, layout popover, and handler

This can be authored manually if first-time users need vocabulary help.

## Image Strategy
Use two screenshot sources, each for a different problem.

### 1) Storybook screenshots for panel close-ups
Use existing stories for stable, cropped images of individual surfaces such as:
- Inspector pane
- Entity list
- Viewbar YAML controls
- Cloud account panel
- Toolbar

Why:
- cleaner framing
- less visual noise
- deterministic states
- easier to update after UI tweaks

Expected output location:
- `docs/assets/screenshots/storybook/*.png`

### 2) Playwright screenshots for workflow-context captures
Use Playwright only where the user needs real editor context:
- dragging assets to canvas
- multi-select plus layout popover
- attaching actions/patterns in the live editor
- publish precheck and final publish flow

Use locator-level screenshots or clipped screenshots rather than whole-window captures whenever possible.

Expected output location:
- `docs/assets/screenshots/playwright/*.png`

## Screenshot Automation Pipeline
Automate screenshots around a manifest rather than by hardcoding each capture in prose.

### Screenshot manifest
Create a machine-readable manifest:

`scripts/docs/screenshot-manifest.json`

Each entry should define:
- `id`
- `source`: `storybook` or `playwright`
- `storyId` or `spec`
- target viewport
- route or setup state
- locator or clip region
- output path
- optional annotation metadata

Example categories:
- `entity-list-selected-row`
- `layout-popover-spacing-x`
- `inspector-text-entity`
- `cloud-pane-github-connected`
- `publish-precheck-success`

### Storybook capture script
`scripts/docs/capture-storybook-screenshots.mjs`

Responsibilities:
- launch Storybook
- open each listed story
- wait for stable render
- capture the component root or named locator
- write images into `docs/assets/screenshots/storybook/`

Preferred approach:
- use Playwright against running Storybook
- avoid browser-specific image differences by standardizing on Chromium

### Docs Playwright capture script
`scripts/docs/capture-docs-screenshots.mjs`

Responsibilities:
- launch the app in a controlled test state
- seed the editor into known tutorial checkpoints
- capture clipped images of real workflows
- write images into `docs/assets/screenshots/playwright/`

Implementation approach:
- build on existing Playwright test infrastructure
- create reusable setup helpers for:
  - empty project state
  - imported demo asset state
  - pattern-demo mid-progress state
  - signed-in cloud state with mocked publish responses where needed

## Reference Generation Pipeline
Generate the workflow reference page from `.plans/editor-workflows-inventory.md`.

### Generator script
`scripts/docs/generate-workflow-reference.mjs`

Responsibilities:
- read `.plans/editor-workflows-inventory.md`
- extract atomic and composite workflow sections
- normalize headings and anchors
- emit `docs/reference/editor-workflows.md`
- optionally generate a compact glossary/index table

Important rule:
- the generator should preserve human-authored intro/outro blocks if they exist, or write clearly marked generated content blocks
- generated output should include a notice saying the source file is `.plans/editor-workflows-inventory.md`

### Linking model
Tutorial pages should link to workflow anchors when they mention editor affordances, for example:
- “Use the layout popover” linking to the relevant atomic workflow
- “Publish to GitHub Pages” linking to the publish workflow reference

This keeps the tutorial readable while still offering deeper reference material.

## Publishing Pipeline
Publish the docs site separately from the app publish flow.

### Recommended deployment
Deploy docs from GitHub Actions to GitHub Pages.

Recommended shape:
- docs build runs on push to `main` and on docs-affecting PRs
- generated reference pages and screenshots are committed to the repo so PR reviewers can inspect diffs
- Pages deploy publishes the built `docs/` site from `main`

Why commit generated assets:
- keeps screenshots reviewable
- avoids “works only in CI” docs artifacts
- makes local preview easier

### Local commands
Recommended future scripts in `package.json`:
- `docs:dev` to run the docs site locally
- `docs:build` to build the docs site
- `docs:generate` to rebuild generated reference pages
- `docs:screenshots` to rebuild screenshot assets
- `docs:check` to verify generated content is up to date

## Phased Rollout
Implement this in four phases.

### Phase 1: Docs foundation
- add VitePress
- add `docs/` structure
- add placeholder pages for:
  - home
  - pattern demo tutorial
  - GitHub Pages publish tutorial
  - workflow reference
- add local preview and build scripts

Definition of done:
- docs site builds locally
- Pages deployment path is proven

### Phase 2: Generated workflow reference
- implement `generate-workflow-reference.mjs`
- generate `docs/reference/editor-workflows.md`
- link tutorial placeholders to the generated reference

Definition of done:
- workflow reference is rebuildable from `.plans/editor-workflows-inventory.md`
- anchor links are stable enough for authored pages to depend on

### Phase 3: Screenshot automation
- add screenshot manifest
- add Storybook capture script
- add Playwright docs capture script
- produce first-pass panel and workflow images for the two getting-started pages

Definition of done:
- screenshots can be recreated by command
- tutorial pages use cropped images, not ad hoc manual captures

### Phase 4: Tutorial authoring and polish
- fully author the pattern demo tutorial
- fully author the publish tutorial
- add troubleshooting pages
- refine navigation and landing page copy

Definition of done:
- a first-time user can follow the docs end-to-end without referencing planning docs

## Verification Strategy
This is a docs/tooling effort, so verification should cover both content generation and asset generation.

### Required verification for implementation phases
- docs site builds successfully
- generated workflow page matches the source inventory
- screenshot scripts complete without missing expected outputs
- changed screenshots are visually inspected in PR review

### Practical test split
- unit-test parsing and generation helpers where they are non-trivial
- use smoke-level Playwright coverage for screenshot capture scripts if they become complex
- avoid brittle pixel-perfect assertions for screenshot contents

## Risks and Mitigations
### Risk: screenshot churn after UI changes
Mitigation:
- prefer Storybook component captures for stable panels
- use locator clipping instead of full-window screenshots

### Risk: generated workflow page diverges from tutorial wording
Mitigation:
- keep tutorial prose authored manually
- use workflow IDs only as backing references

### Risk: publish flow screenshots require auth and external state
Mitigation:
- use mocked or seeded cloud states for most captures
- reserve only a small number of real-environment verification checks for manual review

### Risk: docs pipeline becomes heavier than the product needs
Mitigation:
- phase the work
- ship the authored docs site and reference generator before investing in all screenshot automation

## Acceptance Criteria
- A new in-repo docs site exists and is the primary proposed home for the user guide.
- The docs include two first-time-user pages:
  - pattern demo walkthrough
  - GitHub Pages publish walkthrough
- Workflow reference content is generated from `.plans/editor-workflows-inventory.md`.
- Screenshot generation is automated through manifest-driven scripts using Storybook and Playwright.
- The docs site can be built and deployed to GitHub Pages without relying on GitHub wiki editing.

## Recommended Next Implementation Task
Start with Phase 1 and Phase 2 together:
- scaffold VitePress under `docs/`
- add `docs/getting-started/` and `docs/reference/`
- implement the workflow-reference generator
- wire a basic GitHub Pages docs deploy

That yields a useful docs skeleton quickly and sets up the screenshot automation work without blocking on it.
