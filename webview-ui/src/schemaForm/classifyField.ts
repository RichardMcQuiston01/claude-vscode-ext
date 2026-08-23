import {resolveSchema} from './resolveSchema';
import type {JsonSchema} from './types';

export type FieldKind =
  | {kind: 'boolean'}
  | {kind: 'number'}
  | {kind: 'string'; enumValues?: string[]}
  | {kind: 'stringArray'}
  | {kind: 'object'; properties: Record<string, JsonSchema>}
  | {kind: 'unsupported'};

const UNSUPPORTED: FieldKind = {kind: 'unsupported'};

function isJsonSchema(value: unknown): value is JsonSchema {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Picks which form widget a schema node should render as. Resolves a
 * single level of `$ref` first (see `resolveSchema`), then covers the
 * subset of JSON Schema this form has a dedicated widget for: boolean,
 * number/integer, string (plain or enum), an array of plain strings, and
 * an object with a fixed `properties` map (recursed into by the caller).
 * Everything else — `oneOf`/`anyOf`/`allOf`, free-form maps
 * (`additionalProperties` with no `properties`), arrays of non-strings,
 * unresolvable `$ref`s — is `'unsupported'`, which the caller renders as a
 * raw-JSON fallback field rather than silently dropping the setting.
 */
export function classifyField(node: JsonSchema, root: JsonSchema): FieldKind {
  const resolved = resolveSchema(node, root);
  if (!resolved) {
    return UNSUPPORTED;
  }
  if ('oneOf' in resolved || 'anyOf' in resolved || 'allOf' in resolved) {
    return UNSUPPORTED;
  }

  const type = resolved['type'];

  if (type === 'boolean') {
    return {kind: 'boolean'};
  }

  if (type === 'number' || type === 'integer') {
    return {kind: 'number'};
  }

  if (type === 'string') {
    const enumValue = resolved['enum'];
    const enumValues = Array.isArray(enumValue)
      ? enumValue.filter((value): value is string => typeof value === 'string')
      : undefined;
    return {kind: 'string', enumValues};
  }

  if (type === 'array') {
    const items = resolved['items'];
    if (isJsonSchema(items)) {
      const itemKind = classifyField(items, root);
      if (itemKind.kind === 'string' && !itemKind.enumValues) {
        return {kind: 'stringArray'};
      }
    }
    return UNSUPPORTED;
  }

  if (type === 'object') {
    const properties = resolved['properties'];
    if (isJsonSchema(properties)) {
      return {kind: 'object', properties: properties as Record<string, JsonSchema>};
    }
    return UNSUPPORTED;
  }

  return UNSUPPORTED;
}
