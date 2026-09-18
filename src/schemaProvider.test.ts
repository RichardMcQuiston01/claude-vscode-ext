import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';
import {resolveSettingsSchema} from './schemaProvider.js';

const BUNDLED_SCHEMA_PATH = path.join(
  process.cwd(),
  'schema',
  'claude-code-settings.fallback.json',
);

function alwaysOfflineFetch(): typeof fetch {
  return (async () => {
    throw new Error('network unreachable');
  }) as unknown as typeof fetch;
}

function jsonResponse(
  body: unknown,
  init: {ok: boolean; status?: number; statusText?: string},
) {
  return {
    ok: init.ok,
    status: init.status ?? (init.ok ? 200 : 500),
    statusText: init.statusText ?? (init.ok ? 'OK' : 'Internal Server Error'),
    json: async () => body,
  } as Response;
}

void test('resolveSettingsSchema returns the live schema when the fetch succeeds', async () => {
  const liveSchema = {title: 'live-schema'};
  const fetchImpl = (async () =>
    jsonResponse(liveSchema, {ok: true})) as unknown as typeof fetch;
  const readBundledSchemaText = async () => {
    throw new Error('should not be called');
  };

  const result = await resolveSettingsSchema(fetchImpl, readBundledSchemaText);

  assert.deepEqual(result, {schema: liveSchema, source: 'live'});
});

void test('resolveSettingsSchema falls back to the bundled schema when the fetch rejects', async () => {
  const bundledSchema = {title: 'bundled-schema'};
  const fetchImpl = (async () => {
    throw new Error('network unreachable');
  }) as unknown as typeof fetch;
  const readBundledSchemaText = async () => JSON.stringify(bundledSchema);

  const result = await resolveSettingsSchema(fetchImpl, readBundledSchemaText);

  assert.equal(result.source, 'bundled');
  assert.deepEqual(result.schema, bundledSchema);
  assert.match(result.warning ?? '', /network unreachable/);
  assert.match(result.warning ?? '', /may be stale/);
});

void test('resolveSettingsSchema falls back to the bundled schema on a non-OK HTTP response', async () => {
  const bundledSchema = {title: 'bundled-schema'};
  const fetchImpl = (async () =>
    jsonResponse(
      {},
      {ok: false, status: 404, statusText: 'Not Found'},
    )) as unknown as typeof fetch;
  const readBundledSchemaText = async () => JSON.stringify(bundledSchema);

  const result = await resolveSettingsSchema(fetchImpl, readBundledSchemaText);

  assert.equal(result.source, 'bundled');
  assert.match(result.warning ?? '', /404/);
});

void test('resolveSettingsSchema throws a specific error when both the fetch and the bundled read fail', async () => {
  const fetchImpl = (async () => {
    throw new Error('network unreachable');
  }) as unknown as typeof fetch;
  const readBundledSchemaText = async () => {
    throw new Error('ENOENT: no such file');
  };

  await assert.rejects(
    resolveSettingsSchema(fetchImpl, readBundledSchemaText),
    /network unreachable/,
  );
  await assert.rejects(
    resolveSettingsSchema(fetchImpl, readBundledSchemaText),
    /ENOENT: no such file/,
  );
});

void test('resolveSettingsSchema throws a specific error when the bundled schema is not valid JSON', async () => {
  const fetchImpl = (async () => {
    throw new Error('network unreachable');
  }) as unknown as typeof fetch;
  const readBundledSchemaText = async () => '{not valid json';

  await assert.rejects(
    resolveSettingsSchema(fetchImpl, readBundledSchemaText),
    /not valid JSON/,
  );
});

void test('a fully offline session loads the real bundled schema with a staleness warning', async () => {
  const readBundledSchemaText = async () =>
    readFileSync(BUNDLED_SCHEMA_PATH, 'utf8');

  const result = await resolveSettingsSchema(
    alwaysOfflineFetch(),
    readBundledSchemaText,
  );

  assert.equal(result.source, 'bundled');
  assert.equal(result.schema.type, 'object');
  assert.ok(
    result.schema.properties && typeof result.schema.properties === 'object',
    'bundled schema should have a properties map',
  );
  assert.match(result.warning ?? '', /may be stale/);
});

void test('every attempt during a fully offline session falls back correctly, not just the first', async () => {
  const bundledSchema = {title: 'bundled-schema'};
  const readBundledSchemaText = async () => JSON.stringify(bundledSchema);
  const fetchImpl = alwaysOfflineFetch();

  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await resolveSettingsSchema(
      fetchImpl,
      readBundledSchemaText,
    );
    assert.equal(result.source, 'bundled');
    assert.deepEqual(result.schema, bundledSchema);
  }
});
