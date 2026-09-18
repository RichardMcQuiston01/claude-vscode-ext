import {useState} from 'react';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, test, vi} from 'vitest';
import {SchemaForm} from './SchemaForm';
import type {JsonObject, JsonSchema} from './types';

/**
 * Feeds `onChange` back into `values`, the way `App.tsx` really drives
 * `SchemaForm` — needed to test typing multiple characters into a
 * controlled field, since a static `values` prop resets the DOM's value
 * after every keystroke.
 */
function StatefulSchemaForm({
  schema,
  onChange,
}: {
  schema: JsonSchema;
  onChange: (values: JsonObject) => void;
}) {
  const [values, setValues] = useState<JsonObject>({});
  return (
    <SchemaForm
      schema={schema}
      values={values}
      onChange={nextValues => {
        setValues(nextValues);
        onChange(nextValues);
      }}
    />
  );
}

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

  test('renders theme (an anyOf of an enum plus a pattern-matched custom string) as a text input with preset suggestions, not raw JSON', async () => {
    // The real `theme` schema node from schema/claude-code-settings.fallback.json.
    const THEME_SCHEMA: JsonSchema = {
      type: 'object',
      properties: {
        theme: {
          anyOf: [
            {
              type: 'string',
              enum: [
                'auto',
                'dark',
                'light',
                'dark-daltonized',
                'light-daltonized',
                'dark-ansi',
                'light-ansi',
              ],
            },
            {
              type: 'string',
              pattern: '^custom:.+',
              description:
                'Reference to a custom theme defined in ~/.claude/themes/, in the form "custom:<slug>"',
            },
          ],
          description:
            'Color theme for the interface: auto, dark, light, the daltonized variants (deuteranopia-friendly), the ansi variants (16-color terminals), or a custom theme reference such as custom:<slug> or custom:<plugin-name>:<slug>.',
        },
      },
    };
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<StatefulSchemaForm schema={THEME_SCHEMA} onChange={onChange} />);

    expect(screen.queryByText(/no dedicated editor/i)).not.toBeInTheDocument();
    // An <input> wired to a <datalist> via `list` has an implicit ARIA role
    // of "combobox", not "textbox" — that's what distinguishes it here from
    // the sidebar's plain-textbox filter input.
    const input = screen.getByRole('combobox');
    expect(input.tagName).toBe('INPUT');

    const datalistId = input.getAttribute('list');
    expect(datalistId).toBeTruthy();
    const options = Array.from(
      document.getElementById(datalistId ?? '')?.querySelectorAll('option') ??
        [],
    ).map(option => option.getAttribute('value'));
    expect(options).toEqual([
      'auto',
      'dark',
      'light',
      'dark-daltonized',
      'light-daltonized',
      'dark-ansi',
      'light-ansi',
    ]);

    await user.type(input, 'custom:my-theme');

    expect(onChange).toHaveBeenLastCalledWith({theme: 'custom:my-theme'});
  });
});
