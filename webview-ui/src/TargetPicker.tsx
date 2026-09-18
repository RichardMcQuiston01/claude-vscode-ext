import type {SettingsTarget} from './settingsTarget';

const TARGET_LABELS: Record<SettingsTarget, string> = {
  workspaceSettings: 'Workspace Settings (.claude/settings.json)',
  workspaceLocalSettings:
    'Workspace Local Settings (.claude/settings.local.json)',
  userSettings: 'User Settings (~/.claude/settings.json)',
};

const ALL_TARGETS = Object.keys(TARGET_LABELS) as SettingsTarget[];

interface TargetPickerProps {
  target: SettingsTarget;
  availableTargets: SettingsTarget[];
  onSelect: (target: SettingsTarget) => void;
}

/**
 * Makes it unambiguous which of the three settings files is being edited
 * before any write happens (CLAUDE.md's "three-target awareness"). Targets
 * the host reports as unavailable (workspace-scoped targets with no
 * workspace folder open) are still listed, but disabled, so the picker
 * itself explains why they can't be selected rather than just omitting
 * them.
 */
export function TargetPicker({
  target,
  availableTargets,
  onSelect,
}: TargetPickerProps) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="font-medium">Editing:</span>
      <select
        className="rounded border border-gray-300 px-2 py-1"
        value={target}
        onChange={event => onSelect(event.target.value as SettingsTarget)}
      >
        {ALL_TARGETS.map(key => (
          <option key={key} value={key} disabled={!availableTargets.includes(key)}>
            {TARGET_LABELS[key]}
            {availableTargets.includes(key) ? '' : ' (no workspace open)'}
          </option>
        ))}
      </select>
    </label>
  );
}
