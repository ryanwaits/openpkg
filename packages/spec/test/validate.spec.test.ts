import { describe, expect, it } from 'bun:test';
import { normalize, validateSpec, type OpenPkg } from '../src/index';

describe('validateSpec', () => {
  it('accepts specs with inline object schemas and unpkg $schema url', () => {
    const spec: OpenPkg = {
      $schema: 'https://unpkg.com/@openpkg-ts/spec/schemas/v0.1.0/openpkg.schema.json',
      openpkg: '0.1.0',
      meta: {
        name: 'fixture',
        ecosystem: 'js/ts',
      },
      exports: [],
      types: [
        {
          id: 'Widget',
          name: 'Widget',
          kind: 'interface',
          description: 'Example interface with object schema',
          schema: {
            type: 'object',
            properties: {
              value: {
                type: 'string',
                description: 'Widget value',
              },
              nested: {
                type: 'object',
                properties: {
                  count: { type: 'integer' },
                },
                required: ['count'],
                additionalProperties: false,
              },
            },
            required: ['value'],
            additionalProperties: false,
          },
          members: [],
          tags: [],
        },
        {
          id: 'WidgetInput',
          name: 'WidgetInput',
          kind: 'type',
          description: 'Union referencing other shapes',
          schema: {
            anyOf: [
              {
                type: 'object',
                properties: {
                  asset: { $ref: '#/types/Asset' },
                  value: { type: 'number' },
                },
                required: ['asset', 'value'],
                additionalProperties: false,
              },
              {
                type: 'object',
                properties: {
                  asset: { $ref: '#/types/Asset' },
                  reason: { type: 'string' },
                },
                required: ['asset', 'reason'],
                additionalProperties: false,
              },
            ],
          },
          members: [],
          tags: [],
        },
        {
          id: 'Asset',
          name: 'Asset',
          kind: 'interface',
          schema: {
            type: 'object',
            properties: {
              id: { type: 'string' },
            },
            required: ['id'],
            additionalProperties: false,
          },
          members: [],
          tags: [],
        },
      ],
      examples: [],
      extensions: {},
    };

    const normalized = normalize(spec);
    const result = validateSpec(normalized);
    expect(result.ok).toBe(true);
  });
});
