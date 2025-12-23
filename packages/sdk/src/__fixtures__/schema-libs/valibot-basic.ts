/**
 * Valibot Basic Fixtures
 * Tests Valibot schema patterns for type extraction
 */
import * as v from 'valibot';

// Basic primitives
export const StringSchema = v.string();
export const NumberSchema = v.number();
export const BooleanSchema = v.boolean();

// Object schema
export const UserSchema = v.object({
  name: v.string(),
  age: v.number(),
  email: v.pipe(v.string(), v.email()),
});

// Optional fields
export const UserWithOptionalSchema = v.object({
  name: v.string(),
  age: v.optional(v.number()),
  nickname: v.nullable(v.string()),
});

// Array schema
export const StringArraySchema = v.array(v.string());
export const UserArraySchema = v.array(UserSchema);

// Nested objects
export const NestedSchema = v.object({
  user: UserSchema,
  metadata: v.object({
    createdAt: v.date(),
    updatedAt: v.date(),
  }),
});

// Union
export const StringOrNumberSchema = v.union([v.string(), v.number()]);

// Enum/Picklist
export const StatusSchema = v.picklist(['pending', 'active', 'completed']);

// Record
export const RecordSchema = v.record(v.string(), v.number());

// Tuple
export const TupleSchema = v.tuple([v.string(), v.number(), v.boolean()]);

// Inferred types
export type User = v.InferOutput<typeof UserSchema>;
export type UserWithOptional = v.InferOutput<typeof UserWithOptionalSchema>;
export type Nested = v.InferOutput<typeof NestedSchema>;
export type Status = v.InferOutput<typeof StatusSchema>;
