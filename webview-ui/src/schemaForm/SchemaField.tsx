import {classifyField} from './classifyField';
import {BooleanField} from './fields/BooleanField';
import {JsonFallbackField} from './fields/JsonFallbackField';
import {NumberField} from './fields/NumberField';
import {ObjectFields} from './fields/ObjectFields';
import {StringArrayField} from './fields/StringArrayField';
import {StringField} from './fields/StringField';
import type {JsonSchema} from './types';

interface SchemaFieldProps {
  name: string;
  schema: JsonSchema;
  root: JsonSchema;
  value: unknown;
  onChange: (value: unknown) => void;
}

/** Renders one schema property as whichever widget `classifyField` picks. */
export function SchemaField({name, schema, root, value, onChange}: SchemaFieldProps) {
  const description =
    typeof schema.description === 'string' ? schema.description : undefined;
  const kind = classifyField(schema, root);

  switch (kind.kind) {
    case 'boolean':
      return (
        <BooleanField
          label={name}
          description={description}
          value={typeof value === 'boolean' ? value : false}
          onChange={onChange}
        />
      );
    case 'number':
      return (
        <NumberField
          label={name}
          description={description}
          value={typeof value === 'number' ? value : 0}
          onChange={onChange}
        />
      );
    case 'string':
      return (
        <StringField
          label={name}
          description={description}
          value={typeof value === 'string' ? value : ''}
          enumValues={kind.enumValues}
          onChange={onChange}
        />
      );
    case 'stringArray':
      return (
        <StringArrayField
          label={name}
          description={description}
          value={
            Array.isArray(value)
              ? value.filter((item): item is string => typeof item === 'string')
              : []
          }
          onChange={onChange}
        />
      );
    case 'object':
      return (
        <ObjectFields
          name={name}
          description={description}
          properties={kind.properties}
          root={root}
          value={
            value && typeof value === 'object' && !Array.isArray(value)
              ? (value as Record<string, unknown>)
              : {}
          }
          onChange={onChange}
        />
      );
    case 'unsupported':
      return (
        <JsonFallbackField
          label={name}
          description={description}
          value={value ?? null}
          onChange={onChange}
        />
      );
  }
}
