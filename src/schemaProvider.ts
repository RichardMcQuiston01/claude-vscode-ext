import type {ExtensionContext, Uri} from 'vscode';

export const SETTINGS_SCHEMA_URL =
  'https://json.schemastore.org/claude-code-settings.json';

const FETCH_TIMEOUT_MS = 5000;
const CACHE_FILE_NAME = 'claude-code-settings.schema.json';
const BUNDLED_SCHEMA_RELATIVE_PATH =
  'schema/claude-code-settings.fallback.json';

/** A parsed JSON Schema document. Structure is validated at use sites. */
export type JsonSchema = Record<string, unknown>;

export type SchemaSource = 'live' | 'bundled';

export interface SchemaResult {
  schema: JsonSchema;
  source: SchemaSource;
  /** Set when `source` is `'bundled'`; explains why the live fetch failed. */
  warning?: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function fetchLiveSchema(fetchImpl: typeof fetch): Promise<JsonSchema> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetchImpl(SETTINGS_SCHEMA_URL, {
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(
        `request failed with HTTP status ${response.status} ${response.statusText}`,
      );
    }
    return (await response.json()) as JsonSchema;
  } finally {
    clearTimeout(timeout);
  }
}

function parseBundledSchema(raw: string): JsonSchema {
  try {
    return JSON.parse(raw) as JsonSchema;
  } catch (error) {
    throw new Error(
      `Bundled settings schema is not valid JSON: ${errorMessage(error)}`,
    );
  }
}

/**
 * Fetches the live schema and, on failure, resolves it via the caller-
 * supplied bundled copy instead. Has no VS Code API dependency (unlike
 * `loadSettingsSchema` below), so it is directly unit-testable outside the
 * Extension Development Host with a mocked `fetchImpl`/
 * `readBundledSchemaText`.
 */
export async function resolveSettingsSchema(
  fetchImpl: typeof fetch,
  readBundledSchemaText: () => Promise<string>,
): Promise<SchemaResult> {
  try {
    const schema = await fetchLiveSchema(fetchImpl);
    return {schema, source: 'live'};
  } catch (fetchError) {
    const reason = errorMessage(fetchError);
    let raw: string;
    try {
      raw = await readBundledSchemaText();
    } catch (readError) {
      throw new Error(
        `Live schema fetch failed (${reason}), and the bundled fallback could not be read: ${errorMessage(readError)}`,
      );
    }
    const schema = parseBundledSchema(raw);
    return {
      schema,
      source: 'bundled',
      warning:
        `Could not fetch the latest Claude Code settings schema (${reason}). ` +
        'Using the bundled copy, which may be stale.',
    };
  }
}

/**
 * Best-effort cache of the last successfully fetched schema, so a future
 * offline session can prefer recently-live data over the bundled copy.
 * Write failures are swallowed: caching must never block a caller that
 * already has a schema in hand.
 */
async function writeSchemaCache(
  globalStorageUri: Uri,
  schema: JsonSchema,
): Promise<void> {
  try {
    const vscode = await import('vscode');
    await vscode.workspace.fs.createDirectory(globalStorageUri);
    const cacheUri = vscode.Uri.joinPath(globalStorageUri, CACHE_FILE_NAME);
    await vscode.workspace.fs.writeFile(
      cacheUri,
      Buffer.from(JSON.stringify(schema), 'utf8'),
    );
  } catch {
    // Best-effort: see doc comment above.
  }
}

export interface LoadSettingsSchemaOptions {
  /** Injectable for tests; defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
}

/**
 * Loads the Claude Code settings JSON Schema, preferring the live copy from
 * schemastore.org and falling back to the bundled copy in `schema/` if the
 * fetch fails. Throws if the bundled fallback is missing or invalid, since
 * that leaves the caller with no schema at all.
 *
 * Only callable inside the Extension Development Host: it loads the real
 * `vscode` module at call time, which is not resolvable in a plain Node
 * process (see `resolveSettingsSchema` for the part that is).
 */
export async function loadSettingsSchema(
  context: ExtensionContext,
  options: LoadSettingsSchemaOptions = {},
): Promise<SchemaResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const vscode = await import('vscode');
  const bundledUri = vscode.Uri.joinPath(
    context.extensionUri,
    BUNDLED_SCHEMA_RELATIVE_PATH,
  );

  const result = await resolveSettingsSchema(fetchImpl, async () => {
    try {
      const bytes = await vscode.workspace.fs.readFile(bundledUri);
      return Buffer.from(bytes).toString('utf8');
    } catch (error) {
      throw new Error(
        `Failed to read bundled settings schema at ${bundledUri.fsPath}: ${errorMessage(error)}`,
      );
    }
  });

  if (result.source === 'live') {
    void writeSchemaCache(context.globalStorageUri, result.schema);
  }
  return result;
}
