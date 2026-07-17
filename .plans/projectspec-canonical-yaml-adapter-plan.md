# ProjectSpec Canonical, YAML Adapter Plan

Status: proposed plan; implementation not started.

## Durable Rule

`ProjectSpec` is the canonical project model for editor state, persistence, publish, and runtime compilation. YAML remains a supported human-readable import/export and compatibility adapter, but should not be required for internal persistence or publishing.

## Goals

- Publish games directly from validated `ProjectSpec` / editor state without serializing through YAML.
- Keep YAML import/export available for human-readable backups, bug reports, examples, and compatibility tests.
- Make structured project snapshots the authority for local/cloud persistence where available.
- Preserve backward compatibility with existing YAML projects and legacy cached YAML records.

## Non-Goals

- Removing YAML import/export.
- Breaking existing project files or tests that intentionally exercise YAML compatibility.
- Replacing `ProjectSpec` with a second runtime-only schema in this increment.

## Phase 1 — Inventory Current YAML Coupling

- [ ] Identify every path that calls `serializeProjectToYaml` or `parseProjectYaml`.
- [ ] Classify each usage as:
  - user-facing import/export;
  - persistence/cache compatibility;
  - publish/runtime build;
  - tests/fixtures/debug tooling.
- [ ] Record which paths must remain YAML-based and which should switch to structured `ProjectSpec`.

## Phase 2 — Define Canonical Snapshot Contract

- [ ] Add or document a versioned structured project snapshot format based on `ProjectSpec`.
- [ ] Ensure validation and canonicalization can run on structured snapshots without YAML parse/stringify.
- [ ] Define migration order when both structured project data and YAML are present: latest valid structured `ProjectSpec` wins, YAML is fallback/import compatibility.
- [ ] Add tests proving structured snapshots preserve optional scene appearance, entity tint, scatter layout params, event blocks, attachment value sources, assets, audio, input maps, collections, counters, and patterns.

## Phase 3 — Publish Without YAML

- [ ] Find the publish path that currently depends on YAML text.
- [ ] Refactor publish to compile/package directly from validated `ProjectSpec`.
- [ ] Keep YAML export as a separate user action and optional debugging artifact.
- [ ] Add publish tests proving YAML serialization is not called on the primary publish path.

## Phase 4 — Persistence Without YAML as Authority

- [ ] Prefer structured `ProjectSpec` records for IndexedDB/local persistence writes.
- [ ] Prefer structured `ProjectSpec` records for cloud persistence writes where the API supports it.
- [ ] Keep YAML reads as fallback for legacy records and explicit import flows.
- [ ] Add reload/reopen tests for structured persistence precedence over stale YAML/cache data.

## Phase 5 — Keep YAML Honest as an Adapter

- [ ] Keep YAML round-trip tests for human-readable export/import compatibility.
- [ ] Keep migration tests for legacy YAML formats.
- [ ] Add a small docs note explaining YAML's role: portable import/export, not the canonical internal transport.
- [ ] Make test names and helper names avoid implying YAML is the project authority except in YAML-specific suites.

## Verification

- [ ] Unit tests for structured snapshot validation/canonicalization.
- [ ] Persistence unit tests and reload/reopen E2E.
- [ ] Publish tests proving direct `ProjectSpec` compilation/package.
- [ ] Existing YAML import/export tests still pass.
- [ ] Chromium smoke if editor/publish UI changes are touched.
