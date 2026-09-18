import type {JsonSchema} from './types';

const MAX_REF_HOPS = 5;

function isJsonSchema(value: unknown): value is JsonSchema {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Resolves a schema node's `$ref` against `root.$defs`, following up to
 * `MAX_REF_HOPS` hops so a `$defs` entry that is itself just another `$ref`
 * still resolves. Returns the node unchanged if it isn't a `$ref`, and
 * `undefined` if a `$ref` can't be resolved (points outside `#/$defs/...`,
 * names an entry that doesn't exist, or the chain is longer than we
 * support) — callers treat that as "no dedicated widget for this shape".
 */
export function resolveSchema(
  node: JsonSchema,
  root: JsonSchema,
): JsonSchema | undefined {
  let current: JsonSchema = node;
  for (let hop = 0; hop < MAX_REF_HOPS; hop++) {
    const ref = current['$ref'];
    if (typeof ref !== 'string') {
      return current;
    }
    const match = /^#\/\$defs\/([^/]+)$/.exec(ref);
    if (!match) {
      return undefined;
    }
    const defs = root['$defs'];
    if (!isJsonSchema(defs)) {
      return undefined;
    }
    const next = defs[match[1]];
    if (!isJsonSchema(next)) {
      return undefined;
    }
    current = next;
  }
  return undefined;
}
