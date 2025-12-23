/**
 * TypeBox Basic Fixtures
 * Tests TypeBox schema patterns for type extraction
 */
import { Type, type Static } from '@sinclair/typebox';

// Basic primitives
export const StringSchema = Type.String();
export const NumberSchema = Type.Number();
export const BooleanSchema = Type.Boolean();

// Object schema
export const UserSchema = Type.Object({
  name: Type.String(),
  age: Type.Number(),
  email: Type.String({ format: 'email' }),
});

// Optional fields
export const UserWithOptionalSchema = Type.Object({
  name: Type.String(),
  age: Type.Optional(Type.Number()),
  nickname: Type.Union([Type.String(), Type.Null()]),
});

// Array schema
export const StringArraySchema = Type.Array(Type.String());
export const UserArraySchema = Type.Array(UserSchema);

// Nested objects
export const NestedSchema = Type.Object({
  user: UserSchema,
  metadata: Type.Object({
    createdAt: Type.String({ format: 'date-time' }),
    updatedAt: Type.String({ format: 'date-time' }),
  }),
});

// Union
export const StringOrNumberSchema = Type.Union([Type.String(), Type.Number()]);

// Enum/Literal union
export const StatusSchema = Type.Union([
  Type.Literal('pending'),
  Type.Literal('active'),
  Type.Literal('completed'),
]);

// Record
export const RecordSchema = Type.Record(Type.String(), Type.Number());

// Tuple
export const TupleSchema = Type.Tuple([Type.String(), Type.Number(), Type.Boolean()]);

// Intersect
export const BaseSchema = Type.Object({ id: Type.String() });
export const ExtendedSchema = Type.Intersect([
  BaseSchema,
  Type.Object({ name: Type.String() }),
]);

// Pick/Omit
export const FullSchema = Type.Object({ a: Type.String(), b: Type.Number(), c: Type.Boolean() });
export const PickedSchema = Type.Pick(FullSchema, ['a', 'b']);
export const OmittedSchema = Type.Omit(FullSchema, ['c']);

// Partial/Required
export const PartialSchema = Type.Partial(Type.Object({ name: Type.String(), age: Type.Number() }));

// Inferred types
export type User = Static<typeof UserSchema>;
export type UserWithOptional = Static<typeof UserWithOptionalSchema>;
export type Nested = Static<typeof NestedSchema>;
export type Status = Static<typeof StatusSchema>;
export type Extended = Static<typeof ExtendedSchema>;
