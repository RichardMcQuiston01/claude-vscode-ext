# CHANGELOG

## 0.0.1 - Initial release

- Schema-driven settings form: a filterable, navigable sidebar over the
  live Claude Code settings JSON Schema, grouped by top-level section with
  inline descriptions.
- Three-target support: workspace `.claude/settings.json`, workspace
  `.claude/settings.local.json`, and user `~/.claude/settings.json`, with
  an explicit picker showing which one is active and disabling targets
  that aren't available.
- Non-destructive save flow: merges form edits into the existing file's
  JSON and validates against the schema before writing.
- Offline resilience: falls back to a bundled copy of the schema when the
  live fetch fails, with a staleness warning and a manual
  `Claude Settings Builder: Refresh Schema` command to retry.
- CI: lint, build, and test run on every push/PR to `dev` and `main`.
