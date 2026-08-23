import {act, render, screen} from '@testing-library/react';
import {describe, expect, test} from 'vitest';
import App from './App';

function postFromHost(data: unknown) {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', {data}));
  });
}

describe('App', () => {
  test('shows a connecting message before the host responds', () => {
    render(<App />);
    expect(
      screen.getByText('Connecting to the extension host…'),
    ).toBeInTheDocument();
  });

  test('renders the schema form once the host sends loadSettings', () => {
    render(<App />);

    postFromHost({
      type: 'loadSettings',
      schema: {
        type: 'object',
        properties: {env: {type: 'object', additionalProperties: true}},
      },
      values: {},
    });

    expect(screen.getByRole('button', {name: 'env'})).toBeInTheDocument();
  });

  test('shows the warning banner when the host loaded a fallback schema', () => {
    render(<App />);

    postFromHost({
      type: 'loadSettings',
      schema: {type: 'object', properties: {}},
      values: {},
      warning: 'Using the bundled copy, which may be stale.',
    });

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
});
