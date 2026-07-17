# Project Data

`ProjectSpec` is PhaserForge's canonical project model. The editor state, cloud save API, local structured snapshots, publish packaging, and runtime loading all use validated `ProjectSpec` data.

YAML remains supported as a portable import/export format for backups, examples, bug reports, and compatibility testing. Opening YAML imports it into `ProjectSpec`; saving YAML exports the current `ProjectSpec`. YAML is not the canonical internal transport for persistence or publishing.
