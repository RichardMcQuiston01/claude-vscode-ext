import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';
import {
  mergeSettings,
  parseSettingsJson,
  validateAgainstSchema,
} from './settingsFile.js';
import type {JsonSchema} from './schemaProvider.js';

const bundledSchema: JsonSchema = JSON.parse(
  readFileSync(
    path.join(process.cwd(), 'schema', 'claude-code-settings.fallback.json'),
    'utf8',
  ),
) as JsonSchema;

// -- parseSettingsJson --------------------------------------------------

void test('parseSettingsJson treats empty content as an empty object', () => {
  assert.deepEqual(parseSettingsJson(''), {ok: true, value: {}});
  assert.deepEqual(parseSettingsJson('   \n'), {ok: true, value: {}});
});

void test('parseSettingsJson parses a valid settings object', () => {
  const result = parseSettingsJson('{"env": {"FOO": "bar"}}');
  assert.deepEqual(result, {ok: true, value: {env: {FOO: 'bar'}}});
});

void test('parseSettingsJson reports a specific error for invalid JSON', () => {
  const result = parseSettingsJson('{not valid json');
  assert.equal(result.ok, false);
  assert.match(!result.ok ? result.error : '', /Failed to parse/);
});

void test('parseSettingsJson rejects a non-object top level', () => {
  const result = parseSettingsJson('[1, 2, 3]');
  assert.equal(result.ok, false);
  assert.match(!result.ok ? result.error : '', /must be an object/);
});

// -- mergeSettings --------------------------------------------------------

void test('mergeSettings overwrites top-level scalars and arrays', () => {
  const existing = {model: 'old-model', tags: ['a', 'b']};
  const updates = {model: 'new-model', tags: ['c']};
  assert.deepEqual(mergeSettings(existing, updates), {
    model: 'new-model',
    tags: ['c'],
  });
});

void test('mergeSettings preserves unknown top-level keys not present in updates', () => {
  const existing = {someFutureSetting: true, env: {FOO: '1'}};
  const updates = {env: {FOO: '2'}};
  assert.deepEqual(mergeSettings(existing, updates), {
    someFutureSetting: true,
    env: {FOO: '2'},
  });
});

void test('mergeSettings recursively merges nested objects, preserving unknown nested keys', () => {
  const existing = {
    permissions: {allow: ['Bash'], someUnknownNestedKey: 'keep-me'},
  };
  const updates = {permissions: {allow: ['Bash', 'Edit']}};
  assert.deepEqual(mergeSettings(existing, updates), {
    permissions: {allow: ['Bash', 'Edit'], someUnknownNestedKey: 'keep-me'},
  });
});

// -- validateAgainstSchema -------------------------------------------------

const testSchema: JsonSchema = {
  type: 'object',
  properties: {
    env: {type: 'object'},
    count: {type: 'number'},
  },
  additionalProperties: false,
};

void test('validateAgainstSchema accepts a matching object', () => {
  const result = validateAgainstSchema(testSchema, {env: {FOO: 'bar'}});
  assert.deepEqual(result, {ok: true, value: undefined});
});

void test('validateAgainstSchema reports specific errors for a mismatched object', () => {
  const result = validateAgainstSchema(testSchema, {count: 'not-a-number'});
  assert.equal(result.ok, false);
  assert.match(!result.ok ? result.error : '', /\/count/);
  assert.match(!result.ok ? result.error : '', /must be number/);
});

void test('validateAgainstSchema can validate the same schema object more than once', () => {
  // Regression test: Ajv registers a compiled schema by its `$id` and
  // throws if the same `$id` is compiled twice, so repeated validation
  // against one already-loaded schema object must not recompile it.
  assert.deepEqual(validateAgainstSchema(testSchema, {env: {}}), {
    ok: true,
    value: undefined,
  });
  assert.deepEqual(validateAgainstSchema(testSchema, {count: 1}), {
    ok: true,
    value: undefined,
  });
});

void test('validateAgainstSchema works against the real bundled Claude Code settings schema', () => {
  const valid = validateAgainstSchema(bundledSchema, {
    env: {FOO: 'bar'},
    permissions: {allow: ['Bash(npm run build)']},
  });
  assert.deepEqual(valid, {ok: true, value: undefined});

  const invalid = validateAgainstSchema(bundledSchema, {
    permissions: {allow: [123]},
  });
  assert.equal(invalid.ok, false);
  assert.match(!invalid.ok ? invalid.error : '', /\/permissions\/allow\/0/);
});
