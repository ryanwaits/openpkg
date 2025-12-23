/**
 * ArkType Basic Fixtures
 * Tests ArkType schema patterns for type extraction
 */
import { type } from 'arktype';

// Basic primitives
export const StringSchema = type('string');
export const NumberSchema = type('number');
export const BooleanSchema = type('boolean');

// Object schema
export const UserSchema = type({
  name: 'string',
  age: 'number',
  email: 'string.email',
});

// Optional fields
export const UserWithOptionalSchema = type({
  name: 'string',
  'age?': 'number',
  'nickname?': 'string | null',
});

// Array schema
export const StringArraySchema = type('string[]');
export const UserArraySchema = type({
  name: 'string',
  age: 'number',
}).array();

// Nested objects
export const NestedSchema = type({
  user: UserSchema,
  metadata: {
    createdAt: 'Date',
    updatedAt: 'Date',
  },
});

// Union
export const StringOrNumberSchema = type('string | number');

// Enum-like (literal union)
export const StatusSchema = type("'pending' | 'active' | 'completed'");

// Tuple
export const TupleSchema = type(['string', 'number', 'boolean']);

// Intersection
export const BaseSchema = type({ id: 'string' });
export const ExtendedSchema = type({ name: 'string' }).and(BaseSchema);

// Inferred types
export type User = typeof UserSchema.infer;
export type UserWithOptional = typeof UserWithOptionalSchema.infer;
export type Nested = typeof NestedSchema.infer;
export type Status = typeof StatusSchema.infer;
