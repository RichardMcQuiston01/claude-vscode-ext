import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, test, vi} from 'vitest';
import {TargetPicker} from './TargetPicker';

describe('TargetPicker', () => {
  test('lists all three targets with the current one selected', () => {
    render(
      <TargetPicker
        target="userSettings"
        availableTargets={['workspaceSettings', 'workspaceLocalSettings', 'userSettings']}
        onSelect={() => {}}
      />,
    );

    const select = screen.getByLabelText('Editing:') as HTMLSelectElement;
    expect(select.value).toBe('userSettings');
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  test('disables targets the host reports as unavailable', () => {
    render(
      <TargetPicker
        target="userSettings"
        availableTargets={['userSettings']}
        onSelect={() => {}}
      />,
    );

    expect(
      screen.getByRole('option', {
        name: /Workspace Settings.*no workspace open/,
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole('option', {name: /User Settings/}),
    ).not.toBeDisabled();
  });

  test('calls onSelect with the newly chosen target', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <TargetPicker
        target="workspaceSettings"
        availableTargets={['workspaceSettings', 'workspaceLocalSettings', 'userSettings']}
        onSelect={onSelect}
      />,
    );

    await user.selectOptions(screen.getByLabelText('Editing:'), 'userSettings');

    expect(onSelect).toHaveBeenCalledWith('userSettings');
  });
});
