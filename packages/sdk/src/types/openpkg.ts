import type { OpenPkg } from '@openpkg-ts/spec';
import { z } from 'zod';

// OpenAPI-style schema definition
// biome-ignore lint/suspicious/noExplicitAny: Required for recursive Zod schema type
const schemaSchema: z.ZodSchema<any> = z.lazy(() =>
  z.union([
    // Primitive types
    z.object({
      type: z.enum(['string', 'number', 'boolean', 'integer', 'null', 'array', 'object']),
    }),
    // Reference
    z.object({
      $ref: z.string(),
    }),
    // Array with items
    z.object({
      type: z.literal('array'),
      items: schemaSchema.optional(),
      description: z.string().optional(),
    }),
    // Object with properties
    z.object({
      type: z.literal('object'),
      properties: z.record(z.string(), schemaSchema).optional(),
      required: z.array(z.string()).optional(),
      description: z.string().optional(),
      additionalProperties: z.union([z.boolean(), schemaSchema]).optional(),
    }),
    // Composition schemas
    z.object({
      oneOf: z.array(schemaSchema),
      description: z.string().optional(),
    }),
    z.object({
      anyOf: z.array(schemaSchema),
      description: z.string().optional(),
    }),
    z.object({
      allOf: z.array(schemaSchema),
      description: z.string().optional(),
    }),
    // Enum
    z.object({
      enum: z.array(z.union([z.string(), z.number(), z.null()])),
      description: z.string().optional(),
    }),
  ]),
);

// Parameter following OpenAPI style
const parameterSchema = z.object({
  name: z.string(),
  in: z.literal('query').optional(), // We could extend this later
  required: z.boolean().optional(),
  schema: schemaSchema,
});

// Return type with schema
const returnTypeSchema = z.object({
  schema: schemaSchema,
  description: z.string().optional(),
});

const classMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(['method', 'property', 'constructor', 'accessor']),
  visibility: z.enum(['public', 'private', 'protected']).optional(),
  signatures: z
    .array(
      z.object({
        parameters: z.array(parameterSchema).optional(),
        returns: returnTypeSchema.optional(),
        description: z.string().optional(),
      }),
    )
    .optional(),
  schema: schemaSchema.optional(), // For properties
  description: z.string().optional(),
  examples: z.array(z.string()).optional(),
  flags: z.record(z.string(), z.boolean()).optional(),
});

const enumMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  value: z.union([z.string(), z.number()]).optional(),
  description: z.string().optional(),
});

const memberSchema = z.union([classMemberSchema, enumMemberSchema]);

export const openPkgSchema: z.ZodTypeAny = z.object({
  $schema: z.string().optional(),
  openpkg: z.literal('0.1.0'),
  meta: z.object({
    name: z.string(),
    version: z.string(),
    description: z.string().optional(),
    license: z.string().optional(),
    repository: z.string().optional(),
    ecosystem: z.string().default('js/ts'),
  }),
  exports: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      kind: z.enum([
        'function',
        'class',
        'variable',
        'interface',
        'type',
        'enum',
        'module',
        'namespace',
        'reference',
      ]),
      signatures: z
        .array(
          z.object({
            parameters: z.array(parameterSchema).optional(),
            returns: returnTypeSchema.optional(),
            description: z.string().optional(),
          }),
        )
        .optional(),
      members: z.array(memberSchema).optional(),
      type: z.union([z.string(), schemaSchema]).optional(),
      schema: schemaSchema.optional(), // For variables/constants
      description: z.string().optional(),
      examples: z.array(z.string()).optional(),
      source: z
        .object({
          file: z.string().optional(),
          line: z.number().optional(),
          url: z.string().optional(),
        })
        .optional(),
      flags: z.record(z.string(), z.unknown()).optional(),
      tags: z
        .array(
          z.object({
            name: z.string(),
            text: z.string(),
          }),
        )
        .optional(),
    }),
  ),
  types: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        kind: z.enum(['class', 'interface', 'type', 'enum']),
        description: z.string().optional(),
        // Schema defines the shape of the type
        schema: schemaSchema.optional(),
        type: z.union([z.string(), schemaSchema]).optional(),
        // Members (class, enum, etc.)
        members: z.array(memberSchema).optional(),
        source: z
          .object({
            file: z.string().optional(),
            line: z.number().optional(),
            url: z.string().optional(),
          })
          .optional(),
        // JSDoc tags
        tags: z
          .array(
            z.object({
              name: z.string(),
              text: z.string(),
            }),
          )
          .optional(),
        // Raw comments fallback
        rawComments: z.string().optional(),
      }),
    )
    .optional(),
  examples: z.array(z.object({})).optional(),
  extensions: z.record(z.string(), z.unknown()).optional(),
});

export type OpenPkgSpec = OpenPkg;
