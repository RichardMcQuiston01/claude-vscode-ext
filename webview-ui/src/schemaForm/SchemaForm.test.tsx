import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, test, vi} from 'vitest';
import {SchemaForm} from './SchemaForm';
import type {JsonSchema} from './types';

const SAMPLE_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    autoMemoryEnabled: {
      type: 'boolean',
      description: 'Enable automatic memory saves.',
    },
    autoUpdatesChannel: {
      type: 'string',
      enum: ['stable', 'latest'],
      description: 'Release channel to follow for updates.',
    },
    cleanupPeriodDays: {
      type: 'integer',
      description: 'Number of days to retain sessions.',
    },
    claudeMdExcludes: {
      type: 'array',
      items: {type: 'string'},
      description: 'Glob patterns to exclude.',
    },
    env: {
      type: 'object',
      additionalProperties: {type: 'string'},
      description: 'Environment variables.',
    },
  },
};

describe('SchemaForm', () => {
  test('lists every top-level schema section, sorted, in the sidebar', () => {
    render(<SchemaForm schema={SAMPLE_SCHEMA} values={{}} onChange={() => {}} />);

    const items = screen.getAllByRole('button').map(button => button.textContent);
    expect(items).toEqual([
      'autoMemoryEnabled',
      'autoUpdatesChannel',
      'claudeMdExcludes',
      'cleanupPeriodDays',
      'env',
    ]);
  });

  test('shows the first section selected by default, with its description', () => {
    render(<SchemaForm schema={SAMPLE_SCHEMA} values={{}} onChange={() => {}} />);

    expect(
      screen.getByText('Enable automatic memory saves.'),
    ).toBeInTheDocument();
  });

  test('filtering the sidebar narrows the visible sections', async () => {
    const user = userEvent.setup();
    render(<SchemaForm schema={SAMPLE_SCHEMA} values={{}} onChange={() => {}} />);

    await user.type(screen.getByLabelText('Filter settings'), 'auto');

    const items = screen.getAllByRole('button').map(button => button.textContent);
    expect(items).toEqual(['autoMemoryEnabled', 'autoUpdatesChannel']);
  });

  test('selecting a different section shows its field', async () => {
    const user = userEvent.setup();
    render(<SchemaForm schema={SAMPLE_SCHEMA} values={{}} onChange={() => {}} />);

    await user.click(screen.getByRole('button', {name: 'env'}));

    expect(screen.getByText('Environment variables.')).toBeInTheDocument();
  });

  test('editing a boolean field reports the new merged values', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SchemaForm schema={SAMPLE_SCHEMA} values={{}} onChange={onChange} />,
    );

    await user.click(screen.getByRole('checkbox'));

    expect(onChange).toHaveBeenCalledWith({autoMemoryEnabled: true});
  });
});
