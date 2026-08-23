import {act, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, test, vi} from 'vitest';
import App from './App';
import {vscodeApi} from './vscode';

function postFromHost(data: unknown) {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', {data}));
  });
}

const SAMPLE_SCHEMA = {
  type: 'object',
  properties: {env: {type: 'object', additionalProperties: true}},
};

function loadSettingsMessage(overrides: Record<string, unknown> = {}) {
  return {
    type: 'loadSettings',
    schema: SAMPLE_SCHEMA,
    target: 'workspaceSettings',
    availableTargets: ['workspaceSettings', 'workspaceLocalSettings', 'userSettings'],
    values: {},
    ...overrides,
  };
}

describe('App', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('shows a connecting message before the host responds', () => {
    render(<App />);
    expect(
      screen.getByText('Connecting to the extension host…'),
    ).toBeInTheDocument();
  });

  test('posts ready to the host on mount', () => {
    const postMessage = vi.spyOn(vscodeApi, 'postMessage');
    render(<App />);
    expect(postMessage).toHaveBeenCalledWith({type: 'ready'});
  });

  test('renders the schema form and target picker once the host sends loadSettings', () => {
    render(<App />);

    postFromHost(loadSettingsMessage());

    expect(screen.getByRole('button', {name: 'env'})).toBeInTheDocument();
    expect(screen.getByText('Editing:')).toBeInTheDocument();
  });

  test('shows the warning banner when the host loaded a fallback schema', () => {
    render(<App />);

    postFromHost(
      loadSettingsMessage({
        schema: {type: 'object', properties: {}},
        warning: 'Using the bundled copy, which may be stale.',
      }),
    );

    expect(
      screen.getByText('Using the bundled copy, which may be stale.'),
    ).toBeInTheDocument();
  });

  test('shows a specific error message when the host fails to load a schema', () => {
    render(<App />);

    postFromHost({
      type: 'loadError',
      message: 'Failed to read bundled settings schema at /ext/schema.json',
    });

    expect(
      screen.getByText(
        'Failed to load settings: Failed to read bundled settings schema at /ext/schema.json',
      ),
    ).toBeInTheDocument();
  });

  test('selecting a different target posts selectTarget and shows connecting again', async () => {
    const user = userEvent.setup();
    const postMessage = vi.spyOn(vscodeApi, 'postMessage');
    render(<App />);
    postFromHost(loadSettingsMessage());

    await user.selectOptions(screen.getByLabelText('Editing:'), 'userSettings');

    expect(postMessage).toHaveBeenCalledWith({
      type: 'selectTarget',
      target: 'userSettings',
    });
    expect(
      screen.getByText('Connecting to the extension host…'),
    ).toBeInTheDocument();
  });

  test('clicking Save posts the current target and values', async () => {
    const user = userEvent.setup();
    const postMessage = vi.spyOn(vscodeApi, 'postMessage');
    render(<App />);
    postFromHost(loadSettingsMessage({values: {env: {FOO: 'bar'}}}));

    await user.click(screen.getByRole('button', {name: 'Save'}));

    expect(postMessage).toHaveBeenCalledWith({
      type: 'save',
      target: 'workspaceSettings',
      values: {env: {FOO: 'bar'}},
    });
  });

  test('shows a success message after a successful save', async () => {
    const user = userEvent.setup();
    render(<App />);
    postFromHost(loadSettingsMessage());

    await user.click(screen.getByRole('button', {name: 'Save'}));
    postFromHost({type: 'saveResult', target: 'workspaceSettings', ok: true});

    expect(screen.getByText('Saved.')).toBeInTheDocument();
  });

  test('shows a specific error message after a failed save', async () => {
    const user = userEvent.setup();
    render(<App />);
    postFromHost(loadSettingsMessage());

    await user.click(screen.getByRole('button', {name: 'Save'}));
    postFromHost({
      type: 'saveResult',
      target: 'workspaceSettings',
      ok: false,
      error: 'Settings failed schema validation:\n/env must be object',
    });

    expect(
      screen.getByText(/Settings failed schema validation:[\s\S]*\/env must be object/),
    ).toBeInTheDocument();
  });

  test('ignores a saveResult for a target that is no longer selected', async () => {
    const user = userEvent.setup();
    render(<App />);
    postFromHost(loadSettingsMessage());

    await user.click(screen.getByRole('button', {name: 'Save'}));
    postFromHost({type: 'saveResult', target: 'userSettings', ok: true});

    expect(screen.queryByText('Saved.')).not.toBeInTheDocument();
  });
});
