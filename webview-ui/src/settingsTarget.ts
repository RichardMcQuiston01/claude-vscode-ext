/**
 * Mirrors `SettingsTarget` from `src/settingsFile.ts` in the extension
 * host (duplicated, not imported — see the note in `App.tsx`).
 */
export type SettingsTarget =
  | 'workspaceSettings'
  | 'workspaceLocalSettings'
  | 'userSettings';
