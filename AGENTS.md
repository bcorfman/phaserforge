# AGENTS.md for phaseractions-studio

## Project Guidelines

### TDD Requirement
All phases and implementation changes should be TDD-driven. Each gesture or editing behavior starts with store/helper tests, then scene-level interaction tests where practical, then implementation. Maintain comprehensive test coverage for reducers, helpers, and integrations.

### ArcadeActions Reference Only
The `arcadeactions` directory is for reference only. Do not modify or add files to it. Use it to understand formations, actions, and arrange functions, but all changes must stay within `phaseractions-studio`. For expandability, rely on external config files and editor-side logic.