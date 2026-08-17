# claude-settings-builder

A VS Code extension that provides a GUI for building and editing Claude Code's
`.claude/settings.json` and `.claude/settings.local.json` files, driven by
Anthropic's published JSON schema so every documented setting is discoverable
through form fields instead of hand-written JSON.

## Project goals

- Read Anthropic's Claude Code settings schema
  (https://json.schemastore.org/claude-code-settings.json) and render it as a
  navigable form inside a VS Code webview.
- Support editing three targets: workspace `.claude/settings.json`, workspace
  `.claude/settings.local.json`, and user-level `~/.claude/settings.json`.
- Validate against the schema before writing. Never write invalid JSON.
- Preserve any keys already present in a file that the schema doesn't know
  about — the schema can lag behind real options, and we must not silently
  strip user config on save.
- Fail loudly and specifically. No silent no-ops.

## Tech stack

- **Language:** TypeScript (strict mode), typed variables everywhere
- **Extension host:** VS Code Extension API
- **Webview UI:** Vite + React + TailwindCSS, bundled to `dist/webview`
- **Style guide:** Google TypeScript Style Guide
- **Package manager:** npm

## Conventions

- Variables: descriptive names, camelCase
- Functions return a value the caller checks — no swallowed failures
- Error messages are specific ("Failed to parse .claude/settings.json: unexpected
  token at line 12" — not "Something went wrong")
- All file I/O wrapped in try/catch; on failure, show a VS Code error
  notification with the specific cause and abort the operation
- JSON only for any data interchange — no other serialization formats
- Prefer small, reusable components in the webview over large monolithic ones

## Architecture

```
claude-settings-builder/
├── src/                    # Extension host (Node/VS Code API side)
│   ├── extension.ts         # activate/deactivate, command registration
│   ├── settingsFile.ts       # read/write/merge logic for target files
│   ├── schemaProvider.ts     # fetch + cache the settings schema, offline fallback
│   └── panel.ts               # webview panel lifecycle
├── webview-ui/              # Vite + React + Tailwind app
│   ├── src/
│   └── vite.config.ts
├── schema/
│   └── claude-code-settings.fallback.json   # bundled offline copy
├── package.json              # extension manifest (contributes, activation events)
├── tsconfig.json
├── README.md
└── CLAUDE.md
```

## Key behaviors to preserve

1. **Schema-driven forms**: form fields are grouped by schema section (env
   vars, permissions, hooks, MCP servers, etc.), each with the schema's own
   description shown inline.
2. **Non-destructive writes**: on save, merge form output into the existing
   file's JSON rather than overwriting wholesale, so unknown keys survive.
3. **Three-target awareness**: the UI must make it unambiguous which file
   (workspace settings, workspace local settings, or user settings) is
   currently being edited before any write happens.
4. **Offline resilience**: if the live schema fetch fails, fall back to the
   bundled copy in `schema/` and warn the user it may be stale.

## Commands / testing

- `npm install` — install dependencies (extension host + webview-ui)
- `npm run build` — build both the extension host and the Vite webview bundle
- `npm run watch` — rebuild on change during development
- Press `F5` in VS Code to launch the Extension Development Host for manual testing
- `npm run lint` — run linting against the Google TypeScript Style Guide config

## Out of scope (for now)

- Editing `CLAUDE.md` files themselves
- Managing MCP server credentials/secrets (link out to docs instead of storing)
- Any telemetry or network calls beyond fetching the public schema
