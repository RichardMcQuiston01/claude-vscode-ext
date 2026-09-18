import type {Uri} from 'vscode';
import Ajv from 'ajv';
import type {ValidateFunction} from 'ajv';
import addFormats from 'ajv-formats';
import type {JsonSchema} from './schemaProvider.js';

export type JsonObject = Record<string, unknown>;

export type SettingsTarget =
  'workspaceSettings' | 'workspaceLocalSettings' | 'userSettings';

export type Result<T> = {ok: true; value: T} | {ok: false; error: string};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function describeType(value: unknown): string {
  return Array.isArray(value) ? 'an array' : `a ${typeof value}`;
}

/**
 * Parses raw settings file text. Empty/whitespace-only content parses to
 * `{}` (a settings file that doesn't exist yet, or is empty, is not an
 * error). Anything that fails to parse, or doesn't parse to a JSON object,
 * is a specific `Result` error rather than a thrown exception, per this
 * project's "caller checks a return value" convention.
 */
export function parseSettingsJson(raw: string): Result<JsonObject> {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return {ok: true, value: {}};
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    return {
      ok: false,
      error: `Failed to parse settings JSON: ${errorMessage(error)}`,
    };
  }
  if (!isPlainObject(parsed)) {
    return {
      ok: false,
      error: `Settings JSON must be an object at the top level, not ${describeType(parsed)}.`,
    };
  }
  return {ok: true, value: parsed};
}

/**
 * Deep-merges `updates` into `existing` so keys `updates` doesn't mention —
 * including ones the schema doesn't know about — survive untouched. Plain
 * objects are merged recursively, key by key; arrays and other value types
 * are replaced wholesale by `updates`, since a form always submits a
 * section's complete value for those (there's no sub-key to preserve).
 */
export function mergeSettings(
  existing: JsonObject,
  updates: JsonObject,
): JsonObject {
  const merged: JsonObject = {...existing};
  for (const [key, updateValue] of Object.entries(updates)) {
    const existingValue = merged[key];
    merged[key] =
      isPlainObject(existingValue) && isPlainObject(updateValue)
        ? mergeSettings(existingValue, updateValue)
        : updateValue;
  }
  return merged;
}

// Ajv registers each compiled schema by its `$id` and throws if the same
// `$id` is compiled twice, which happens whenever the *same* schema content
// is loaded more than once (e.g. a live fetch's result vs. the bundled
// fallback both using schemastore.org's `$id`). Caching validators by the
// schema object's identity means each distinct schema object gets its own
// Ajv instance — and therefore its own empty registry — so re-validating
// against a schema we've already compiled never hits that collision.
const validatorCache = new WeakMap<JsonSchema, ValidateFunction>();

function getValidator(schema: JsonSchema): ValidateFunction {
  const cached = validatorCache.get(schema);
  if (cached) {
    return cached;
  }
  const ajv = new Ajv({allErrors: true, strict: false});
  addFormats(ajv);
  const validate = ajv.compile(schema);
  validatorCache.set(schema, validate);
  return validate;
}

function formatValidationErrors(errors: ValidateFunction['errors']): string {
  const messages = (errors ?? []).map(error => {
    const path = error.instancePath || '(root)';
    return `${path} ${error.message ?? 'is invalid'}`;
  });
  return `Settings failed schema validation:\n${messages.join('\n')}`;
}

/** Validates `candidate` against `schema`. Never throws. */
export function validateAgainstSchema(
  schema: JsonSchema,
  candidate: JsonObject,
): Result<void> {
  const validate = getValidator(schema);
  if (validate(candidate)) {
    return {ok: true, value: undefined};
  }
  return {ok: false, error: formatValidationErrors(validate.errors)};
}

/**
 * Resolves the on-disk location for a settings target. `workspaceFolderUri`
 * is required for the two workspace-scoped targets and ignored for
 * `userSettings`; callers are responsible for picking which workspace
 * folder that is when more than one is open (see ROADMAP Stage 5,
 * "three-target awareness").
 */
export async function resolveSettingsFileUri(
  target: SettingsTarget,
  workspaceFolderUri?: Uri,
): Promise<Result<Uri>> {
  const vscode = await import('vscode');
  if (target === 'userSettings') {
    const os = await import('node:os');
    return {
      ok: true,
      value: vscode.Uri.joinPath(
        vscode.Uri.file(os.homedir()),
        '.claude',
        'settings.json',
      ),
    };
  }
  if (!workspaceFolderUri) {
    return {
      ok: false,
      error: `Cannot resolve ${target}: no workspace folder is open.`,
    };
  }
  const fileName =
    target === 'workspaceLocalSettings'
      ? 'settings.local.json'
      : 'settings.json';
  return {
    ok: true,
    value: vscode.Uri.joinPath(workspaceFolderUri, '.claude', fileName),
  };
}

/**
 * Reads and parses a settings file. A missing file is treated as an empty
 * settings object, not an error — every other failure (permissions, a
 * directory where a file was expected, invalid JSON) is a specific `Result`
 * error.
 */
export async function readSettingsFile(uri: Uri): Promise<Result<JsonObject>> {
  const vscode = await import('vscode');
  let bytes: Uint8Array;
  try {
    bytes = await vscode.workspace.fs.readFile(uri);
  } catch (error) {
    if (
      error instanceof vscode.FileSystemError &&
      error.code === 'FileNotFound'
    ) {
      return {ok: true, value: {}};
    }
    return {
      ok: false,
      error: `Failed to read ${uri.fsPath}: ${errorMessage(error)}`,
    };
  }
  return parseSettingsJson(Buffer.from(bytes).toString('utf8'));
}

/**
 * Merges `updates` into the settings file at `uri`, validates the merged
 * result against `schema`, and writes it back only if valid. Never writes
 * on a read, merge, or validation failure — every failure path returns a
 * specific `Result` error instead, so the caller can show it and abort.
 */
export async function writeSettingsFile(
  uri: Uri,
  schema: JsonSchema,
  updates: JsonObject,
): Promise<Result<JsonObject>> {
  const existingResult = await readSettingsFile(uri);
  if (!existingResult.ok) {
    return existingResult;
  }

  const merged = mergeSettings(existingResult.value, updates);

  const validation = validateAgainstSchema(schema, merged);
  if (!validation.ok) {
    return validation;
  }

  const vscode = await import('vscode');
  try {
    await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(uri, '..'));
    await vscode.workspace.fs.writeFile(
      uri,
      Buffer.from(JSON.stringify(merged, null, 2) + '\n', 'utf8'),
    );
  } catch (error) {
    return {
      ok: false,
      error: `Failed to write ${uri.fsPath}: ${errorMessage(error)}`,
    };
  }

  return {ok: true, value: merged};
}
