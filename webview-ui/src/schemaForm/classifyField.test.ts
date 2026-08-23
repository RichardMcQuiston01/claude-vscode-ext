import {describe, expect, test} from 'vitest';
import {classifyField} from './classifyField';
import type {JsonSchema} from './types';

const ROOT: JsonSchema = {
  $defs: {
    permissionRule: {type: 'string', pattern: '^Bash'},
  },
};

describe('classifyField', () => {
  test('classifies a boolean', () => {
    expect(classifyField({type: 'boolean'}, ROOT)).toEqual({kind: 'boolean'});
  });

  test('classifies a number and an integer', () => {
    expect(classifyField({type: 'number'}, ROOT)).toEqual({kind: 'number'});
    expect(classifyField({type: 'integer'}, ROOT)).toEqual({kind: 'number'});
  });

  test('classifies a plain string', () => {
    expect(classifyField({type: 'string'}, ROOT)).toEqual({
      kind: 'string',
      enumValues: undefined,
    });
  });

  test('classifies an enum string, dropping non-string enum members', () => {
    expect(
      classifyField(
        {type: 'string', enum: ['stable', 'latest', 42]},
        ROOT,
      ),
    ).toEqual({kind: 'string', enumValues: ['stable', 'latest']});
  });

  test('classifies an array of plain strings as stringArray', () => {
    expect(
      classifyField({type: 'array', items: {type: 'string'}}, ROOT),
    ).toEqual({kind: 'stringArray'});
  });

  test('treats an array of enum strings as unsupported (not a plain string array)', () => {
    expect(
      classifyField(
        {type: 'array', items: {type: 'string', enum: ['a', 'b']}},
        ROOT,
      ),
    ).toEqual({kind: 'unsupported'});
  });

  test('treats an array of objects as unsupported', () => {
    expect(
      classifyField({type: 'array', items: {type: 'object'}}, ROOT),
    ).toEqual({kind: 'unsupported'});
  });

  test('classifies an object with a fixed properties map', () => {
    const properties = {allow: {type: 'array', items: {type: 'string'}}};
    expect(classifyField({type: 'object', properties}, ROOT)).toEqual({
      kind: 'object',
      properties,
    });
  });

  test('treats a free-form map object (no properties) as unsupported', () => {
    expect(
      classifyField(
        {type: 'object', additionalProperties: {type: 'string'}},
        ROOT,
      ),
    ).toEqual({kind: 'unsupported'});
  });

  test('treats oneOf/anyOf/allOf as unsupported', () => {
    expect(
      classifyField({oneOf: [{type: 'string'}, {type: 'number'}]}, ROOT),
    ).toEqual({kind: 'unsupported'});
    expect(
      classifyField({anyOf: [{type: 'string'}, {type: 'number'}]}, ROOT),
    ).toEqual({kind: 'unsupported'});
  });

  test('resolves a $ref before classifying', () => {
    expect(classifyField({$ref: '#/$defs/permissionRule'}, ROOT)).toEqual({
      kind: 'string',
      enumValues: undefined,
    });
  });

  test('treats an unresolvable $ref as unsupported', () => {
    expect(classifyField({$ref: '#/$defs/missing'}, ROOT)).toEqual({
      kind: 'unsupported',
    });
  });
});
