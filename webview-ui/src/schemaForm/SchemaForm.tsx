import {useMemo, useState} from 'react';
import {SchemaField} from './SchemaField';
import type {JsonObject, JsonSchema} from './types';

interface SchemaFormProps {
  schema: JsonSchema;
  values: JsonObject;
  onChange: (values: JsonObject) => void;
}

/**
 * Top-level schema-driven form: a filterable, navigable sidebar of the
 * schema's top-level sections (one per top-level property — `env`,
 * `permissions`, `hooks`, etc., per CLAUDE.md's "form fields are grouped
 * by schema section"), with the selected section's field(s) shown next to
 * it.
 */
export function SchemaForm({schema, values, onChange}: SchemaFormProps) {
  const properties = useMemo(() => {
    const props = schema.properties;
    return props && typeof props === 'object' && !Array.isArray(props)
      ? (props as Record<string, JsonSchema>)
      : {};
  }, [schema]);

  const sectionNames = useMemo(
    () => Object.keys(properties).sort(),
    [properties],
  );
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<string | undefined>(
    sectionNames[0],
  );

  const filteredSections = sectionNames.filter(name =>
    name.toLowerCase().includes(filter.toLowerCase()),
  );

  const selectedSchema = selected ? properties[selected] : undefined;

  return (
    <div className="flex h-full gap-4">
      <nav className="flex w-56 flex-shrink-0 flex-col gap-2">
        <input
          type="text"
          placeholder="Filter settings…"
          aria-label="Filter settings"
          className="rounded border border-gray-300 px-2 py-1 text-sm"
          value={filter}
          onChange={event => setFilter(event.target.value)}
        />
        <ul className="flex flex-col overflow-y-auto text-sm">
          {filteredSections.map(name => (
            <li key={name}>
              <button
                type="button"
                className={`w-full rounded px-2 py-1 text-left ${
                  name === selected
                    ? 'bg-gray-200 font-medium'
                    : 'hover:bg-gray-100'
                }`}
                onClick={() => setSelected(name)}
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0 flex-1 overflow-y-auto">
        {selected && selectedSchema ? (
          <SchemaField
            name={selected}
            schema={selectedSchema}
            root={schema}
            value={values[selected]}
            onChange={nextValue =>
              onChange({...values, [selected]: nextValue})
            }
          />
        ) : (
          <p className="text-sm text-gray-500">
            No settings match your filter.
          </p>
        )}
      </div>
    </div>
  );
}
