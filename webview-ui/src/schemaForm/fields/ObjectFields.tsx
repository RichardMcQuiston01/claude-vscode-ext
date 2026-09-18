import {SchemaField} from '../SchemaField';
import type {JsonObject, JsonSchema} from '../types';

interface ObjectFieldsProps {
  name: string;
  description?: string;
  properties: Record<string, JsonSchema>;
  root: JsonSchema;
  value: JsonObject;
  onChange: (value: JsonObject) => void;
}

export function ObjectFields({
  name,
  description,
  properties,
  root,
  value,
  onChange,
}: ObjectFieldsProps) {
  return (
    <fieldset className="flex flex-col gap-3 rounded border border-gray-200 p-3">
      <legend className="px-1 text-sm font-medium">{name}</legend>
      {description && <p className="text-xs text-gray-500">{description}</p>}
      {Object.entries(properties).map(([key, propSchema]) => (
        <SchemaField
          key={key}
          name={key}
          schema={propSchema}
          root={root}
          value={value[key]}
          onChange={nextValue => onChange({...value, [key]: nextValue})}
        />
      ))}
    </fieldset>
  );
}
