import {describe, expect, test} from 'vitest';
import {resolveSchema} from './resolveSchema';
import type {JsonSchema} from './types';

describe('resolveSchema', () => {
  test('returns the node unchanged when it has no $ref', () => {
    const node: JsonSchema = {type: 'string'};
    expect(resolveSchema(node, {})).toEqual(node);
  });

  test('resolves a single-hop $ref against root.$defs', () => {
    const root: JsonSchema = {
      $defs: {permissionRule: {type: 'string', pattern: '^Bash'}},
    };
    const node: JsonSchema = {$ref: '#/$defs/permissionRule'};
    expect(resolveSchema(node, root)).toEqual({
      type: 'string',
      pattern: '^Bash',
    });
  });

  test('follows a chain of $refs', () => {
    const root: JsonSchema = {
      $defs: {
        a: {$ref: '#/$defs/b'},
        b: {type: 'boolean'},
      },
    };
    expect(resolveSchema({$ref: '#/$defs/a'}, root)).toEqual({
      type: 'boolean',
    });
  });

  test('returns undefined for a $ref outside #/$defs/', () => {
    expect(
      resolveSchema({$ref: 'https://example.com/other.json'}, {}),
    ).toBeUndefined();
  });

  test('returns undefined for a $ref naming a missing $defs entry', () => {
    expect(
      resolveSchema({$ref: '#/$defs/missing'}, {$defs: {}}),
    ).toBeUndefined();
  });
});
