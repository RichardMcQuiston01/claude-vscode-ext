# Roadmap

A multi-agent, multi-stage plan for building **claude-settings-builder**, the
VS Code extension described in [CLAUDE.md](./CLAUDE.md). This roadmap breaks
the project into independent, reviewable stages, assigns each stage to a
named agent role, and defines the branching model all work follows.

## Branching model

```
main
 └── dev                              (integration branch, always buildable)
      ├── feature/scaffold-project
      ├── feature/schema-provider
      ├── feature/settings-file-io
      ├── feature/extension-host
      ├── feature/webview-ui
      ├── feature/three-target-flow
      ├── feature/offline-fallback
      ├── feature/testing-ci
      └── feature/docs-packaging
```

- `main` — release branch. Only receives merges from `dev` when a stage set
  is complete, tested, and ready to tag.
- `dev` — integration branch. All feature branches stem from `dev` and merge
  back into `dev` via pull request. `dev` must always build and pass lint.
- `feature/<stage-name>` — one branch per stage (or per agent task within a
  stage, for larger stages). Rebase on `dev` before opening a PR; squash-merge
  into `dev` once reviewed.
- No stage's feature branch merges directly to `main`. No agent pushes
  directly to `dev` or `main`.

Each stage below lists the feature branch(es) it uses, the agent role
responsible, its deliverables, dependencies on earlier stages, and how it's
verified before merge.

## Stage 0 — Project scaffolding

**Branch:** `feature/scaffold-project`
**Agent:** Scaffold Agent
**Depends on:** nothing

- Initialize `package.json` (extension manifest: name, activation events,
  `contributes.commands`, `contributes.viewsContainers` as needed).
- Set up TypeScript strict-mode config (`tsconfig.json`) per the Google
  TypeScript Style Guide.
- Set up `webview-ui/` as a Vite + React + TailwindCSS app with its own
  `vite.config.ts`, building to `dist/webview`.
- Add `npm run build`, `npm run watch`, `npm run lint` scripts wired to both
  the extension host and webview-ui builds.
- Add ESLint/Prettier config matching the Google TypeScript Style Guide.

**Verification:** `npm install && npm run build` succeeds from a clean
checkout; `npm run lint` runs with zero configured rules violated on the
scaffold itself.

## Stage 1 — Schema provider

**Branch:** `feature/schema-provider`
**Agent:** Schema Agent
**Depends on:** Stage 0

- Implement `src/schemaProvider.ts`: fetch
  `https://json.schemastore.org/claude-code-settings.json`, cache it
  (e.g. in extension global storage), and expose a typed accessor.
- Bundle an offline fallback copy at
  `schema/claude-code-settings.fallback.json`.
- On fetch failure, fall back to the bundled copy and surface a specific,
  non-silent warning (per CLAUDE.md's "fail loudly" and "offline resilience"
  requirements).
- Unit-test schema parsing and fallback branching with mocked network calls.

**Verification:** Unit tests cover both the live-fetch-success and
live-fetch-failure/fallback paths. No network calls happen outside this
module.

## Stage 2 — Settings file read/write/merge logic

**Branch:** `feature/settings-file-io`
**Agent:** File I/O Agent
**Depends on:** Stage 1 (needs schema for validation)

- Implement `src/settingsFile.ts`:
  - Read/parse each of the three targets: workspace `.claude/settings.json`,
    workspace `.claude/settings.local.json`, user `~/.claude/settings.json`.
  - Validate proposed writes against the schema from Stage 1; reject and
    report specific validation errors rather than writing invalid JSON.
  - Merge form output into the existing file's parsed JSON so unknown keys
    survive — never overwrite the file wholesale.
  - Wrap all file I/O in try/catch; on failure, return a specific error the
    caller must handle (no swallowed failures).
- Unit-test: merge preserves unknown keys, validation rejects bad shapes,
  I/O failures surface specific messages.

**Verification:** Tests confirm a file with an unrecognized key round-trips
that key unchanged after a save that only touches known fields.

## Stage 3 — Extension host & webview panel lifecycle

**Branch:** `feature/extension-host`
**Agent:** Host Agent
**Depends on:** Stage 0 (scaffold); can proceed in parallel with Stages 1–2

- Implement `src/extension.ts`: `activate`/`deactivate`, command
  registration (e.g. "Open Claude Settings Builder").
- Implement `src/panel.ts`: webview panel creation, message-passing contract
  between host and webview (load current file, request save, report
  validation errors), panel disposal/reuse.
- Define the host↔webview message protocol as typed messages shared between
  `src/` and `webview-ui/src/`.

**Verification:** Manual smoke test via `F5` Extension Development Host —
panel opens, closes, and reopens without leaking listeners; messages round
trip in the Debug Console.

## Stage 4 — Webview UI: schema-driven forms

**Branch:** `feature/webview-ui`
**Agent:** UI Agent
**Depends on:** Stage 1 (schema shape), Stage 3 (message protocol)

- Build the React + Tailwind app in `webview-ui/src/`.
- Render form fields grouped by schema section (env vars, permissions,
  hooks, MCP servers, etc.), each showing the schema's own description
  inline.
- Favor small, reusable field/section components over large monolithic
  views, per CLAUDE.md conventions.
- Wire form state to the host↔webview message protocol from Stage 3.

**Verification:** Component-level tests (e.g. React Testing Library) for
field rendering from a sample schema fixture; manual pass in the Extension
Development Host confirms every top-level schema section renders a
navigable group.

## Stage 5 — Three-target awareness & save flow

**Branch:** `feature/three-target-flow`
**Agent:** Integration Agent
**Depends on:** Stages 2, 3, 4

- Add explicit UI affordance (e.g. a persistent header/badge) making it
  unambiguous which of the three targets — workspace settings, workspace
  local settings, or user settings — is being edited before any write.
- Wire the "Save" action through: form → validate (Stage 1/2) → merge
  (Stage 2) → write → success/error notification.
- On any failure, show a VS Code error notification with the specific
  cause and abort the write (no partial writes).

**Verification:** Manual test matrix covering all three targets × (valid
save, schema-invalid save, file-permission failure) = 9 cases, each showing
the expected notification and file result.

## Stage 6 — Offline resilience hardening

**Branch:** `feature/offline-fallback`
**Agent:** Resilience Agent (can be the Schema Agent revisiting Stage 1)
**Depends on:** Stages 1, 5

- End-to-end verification that a fully offline session (network fetch
  disabled) still opens the panel, loads the bundled fallback schema, warns
  the user it may be stale, and still allows a valid save.
- Add a manual "refresh schema" command that retries the live fetch.

**Verification:** Extension Development Host launched with network access
blocked; full open → edit → save flow completes using the fallback schema.

## Stage 7 — Testing & CI

**Branch:** `feature/testing-ci`
**Agent:** QA Agent
**Depends on:** Stages 0–6 substantially complete

- Consolidate unit tests for `settingsFile.ts`, `schemaProvider.ts`, and
  webview components under a single `npm test` entry point.
- Add a CI workflow (GitHub Actions) running `npm install`, `npm run lint`,
  `npm run build`, and `npm test` on every PR into `dev`.
- Require CI green as a merge gate for all `feature/*` → `dev` PRs.

**Verification:** CI workflow passes on a clean PR and fails intentionally
when a lint rule or test is broken (smoke-test the gate itself).

## Stage 8 — Docs & packaging

**Branch:** `feature/docs-packaging`
**Agent:** Docs/Release Agent
**Depends on:** Stages 0–7

- Flesh out `README.md`: install/usage instructions, screenshots of the
  three-target picker and a schema-driven form section.
- Add a `CHANGELOG.md` entry for the initial release.
- Configure `vsce` packaging (or equivalent) to produce a `.vsix` from
  `npm run build` output.
- Confirm out-of-scope items from CLAUDE.md (editing `CLAUDE.md` files,
  managing MCP credentials, extra telemetry) are not present anywhere in
  the shipped extension.

**Verification:** `.vsix` installs cleanly in a fresh VS Code profile and
the documented usage steps work as written.

## Merge flow summary

1. Agent opens `feature/<stage-name>` from the latest `dev`.
2. Agent implements the stage's deliverables and verification steps above.
3. Agent rebases onto current `dev`, opens a PR into `dev`.
4. CI (Stage 7 onward) must pass; otherwise a reviewer signs off on the
   verification steps manually.
5. Squash-merge into `dev`.
6. Once a coherent set of stages is complete and `dev` is stable, open a
   release PR from `dev` into `main` and tag a version.
