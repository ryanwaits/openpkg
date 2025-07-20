import { z } from "zod";

// Type can be a string, a $ref object, or an inline type definition
const typeRefSchema = z.union([
  z.string(),
  z.object({
    $ref: z.string(), // Reference to a type in the types array
  }),
  z.object({
    name: z.string(),
    kind: z.enum(["class", "interface", "type", "enum"]),
    properties: z.array(
      z.object({
        name: z.string(),
        type: z.string(),
        optional: z.boolean().optional(),
        description: z.string().optional(),
      })
    ).optional(),
    members: z.array(
      z.object({
        name: z.string(),
        value: z.union([z.string(), z.number()]).optional(),
        description: z.string().optional(),
      })
    ).optional(),
    type: z.string().optional(),
  })
]);

const classMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["method", "property", "constructor", "accessor"]),
  visibility: z.enum(["public", "private", "protected"]).optional(),
  signatures: z
    .array(
      z.object({
        parameters: z
          .array(
            z.object({
              name: z.string(),
              type: typeRefSchema.optional(),
              optional: z.boolean().optional(),
              description: z.string().optional(),
            })
          )
          .optional(),
        returnType: typeRefSchema.optional(),
      })
    )
    .optional(),
  type: typeRefSchema.optional(),
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

export const openPkgSchema = z.object({
  openpkg: z.literal("1.0.0"),
  meta: z.object({
    name: z.string(),
    version: z.string(),
    description: z.string().optional(),
    license: z.string().optional(),
    repository: z.string().optional(),
    ecosystem: z.string().default("js/ts"),
  }),
  exports: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      kind: z.enum(["function", "class", "variable", "interface", "type", "enum", "module", "namespace", "reference"]),
      signatures: z
        .array(
          z.object({
            parameters: z
              .array(
                z.object({
                  name: z.string(),
                  type: typeRefSchema.optional(),
                  optional: z.boolean().optional(),
                  description: z.string().optional(),
                })
              )
              .optional(),
            returnType: typeRefSchema.optional(),
          })
        )
        .optional(),
      members: z.array(memberSchema).optional(),
      type: typeRefSchema.optional(), // For variables/accessors
      description: z.string().optional(),
      examples: z.array(z.string()).optional(),
      source: z
        .object({
          file: z.string().optional(),
          line: z.number().optional(),
          url: z.string().optional(),
        })
        .optional(),
      flags: z.record(z.string(), z.unknown()).optional(), // Changed to z.unknown() for flexibility
      tags: z.array(z.object({ 
        name: z.string(), 
        text: z.string() 
      })).optional(),
    })
  ),
  types: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      kind: z.enum(["class", "interface", "type", "enum"]),
      description: z.string().optional(),
      // For classes - constructor parameters define the shape
      parameters: z.array(
        z.object({
          name: z.string(),
          type: z.string(),
          optional: z.boolean().optional(),
          description: z.string().optional(),
        })
      ).optional(),
      // For interfaces and type aliases - properties define the shape
      properties: z.array(
        z.object({
          name: z.string(),
          type: z.string(),
          optional: z.boolean().optional(),
          description: z.string().optional(),
        })
      ).optional(),
      // For enums - members with values
      members: z.array(
        z.object({
          name: z.string(),
          value: z.union([z.string(), z.number()]).optional(),
          description: z.string().optional(),
        })
      ).optional(),
      // For type aliases - the actual type definition
      type: z.string().optional(),
      source: z.object({
        file: z.string().optional(),
        line: z.number().optional(),
        url: z.string().optional(),
      }).optional(),
      // JSDoc tags
      tags: z.array(z.object({ 
        name: z.string(), 
        text: z.string() 
      })).optional(),
      // Raw comments fallback
      rawComments: z.string().optional(),
    })
  ).optional(),
  examples: z.array(z.object({})).optional(),
  extensions: z.record(z.string(), z.unknown()).optional(),
});
