import {resolveSchema} from './resolveSchema';
import type {JsonSchema} from './types';

export type FieldKind =
  | {kind: 'boolean'}
  | {kind: 'number'}
  | {kind: 'string'; enumValues?: string[]; allowCustom?: boolean}
  | {kind: 'stringArray'}
  | {kind: 'object'; properties: Record<string, JsonSchema>}
  | {kind: 'unsupported'};

const UNSUPPORTED: FieldKind = {kind: 'unsupported'};

function isJsonSchema(value: unknown): value is JsonSchema {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Handles the common `anyOf`/`oneOf` idiom of "an enum, or a string
 * matching some pattern" (e.g. `theme`'s fixed presets plus
 * `custom:<slug>`). Resolves each branch and requires all of them to be
 * type `string`; a branch with no `enum` means the field also accepts
 * free text beyond the collected enum values. Returns `undefined` for any
 * union with a non-string branch, which callers treat as unsupported.
 */
function classifyStringUnion(
  branches: unknown,
  root: JsonSchema,
): {enumValues: string[]; allowCustom: boolean} | undefined {
  if (!Array.isArray(branches) || branches.length === 0) {
    return undefined;
  }
  const enumValues: string[] = [];
  let allowCustom = false;
  for (const branch of branches) {
    if (!isJsonSchema(branch)) {
      return undefined;
    }
    const resolvedBranch = resolveSchema(branch, root);
    if (!resolvedBranch || resolvedBranch['type'] !== 'string') {
      return undefined;
    }
    const branchEnum = resolvedBranch['enum'];
    if (Array.isArray(branchEnum)) {
      for (const value of branchEnum) {
        if (typeof value === 'string' && !enumValues.includes(value)) {
          enumValues.push(value);
        }
      }
    } else {
      allowCustom = true;
    }
  }
  return {enumValues, allowCustom};
}

/**
 * Picks which form widget a schema node should render as. Resolves a
 * single level of `$ref` first (see `resolveSchema`), then covers the
 * subset of JSON Schema this form has a dedicated widget for: boolean,
 * number/integer, string (plain or enum), an `anyOf`/`oneOf` union of
 * string branches (e.g. an enum plus a pattern-matched custom string,
 * like `theme`), an array of plain strings, and an object with a fixed
 * `properties` map (recursed into by the caller). Everything else —
 * `allOf`, a union with a non-string branch, free-form maps
 * (`additionalProperties` with no `properties`), arrays of non-strings,
 * unresolvable `$ref`s — is `'unsupported'`, which the caller renders as a
 * raw-JSON fallback field rather than silently dropping the setting.
 */
export function classifyField(node: JsonSchema, root: JsonSchema): FieldKind {
  const resolved = resolveSchema(node, root);
  if (!resolved) {
    return UNSUPPORTED;
  }
  if ('oneOf' in resolved || 'anyOf' in resolved) {
    const branches = resolved['oneOf'] ?? resolved['anyOf'];
    const union = classifyStringUnion(branches, root);
    if (union) {
      return {
        kind: 'string',
        enumValues: union.enumValues.length > 0 ? union.enumValues : undefined,
        ...(union.allowCustom ? {allowCustom: true} : {}),
      };
    }
    return UNSUPPORTED;
  }
  if ('allOf' in resolved) {
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
