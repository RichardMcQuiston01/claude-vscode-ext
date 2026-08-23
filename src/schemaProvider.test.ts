import assert from 'node:assert/strict';
import {test} from 'node:test';
import {resolveSettingsSchema} from './schemaProvider.js';

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
