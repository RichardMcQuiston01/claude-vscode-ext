/**
 * A parsed JSON Schema document, or a node within one. Mirrors
 * `schemaProvider.ts`'s `JsonSchema` in the extension host (duplicated,
 * not imported — see the note in `App.tsx`).
 */
export type JsonSchema = Record<string, unknown>;

export type JsonObject = Record<string, unknown>;
