/**
 * Zod Basic Fixtures
 * Tests basic Zod schema patterns for type extraction
 */
import { z } from 'zod';

// Basic primitives
export const StringSchema = z.string();
export const NumberSchema = z.number();
export const BooleanSchema = z.boolean();

// Object schema - most common pattern
export const UserSchema = z.object({
  name: z.string(),
  age: z.number(),
  email: z.string().email(),
});

// Optional fields
export const UserWithOptionalSchema = z.object({
  name: z.string(),
  age: z.number().optional(),
  nickname: z.string().nullable(),
});

// Array schema
export const StringArraySchema = z.array(z.string());
export const UserArraySchema = z.array(UserSchema);

// Nested objects
export const NestedSchema = z.object({
  user: UserSchema,
  metadata: z.object({
    createdAt: z.date(),
    updatedAt: z.date(),
  }),
});

// Inferred types (what we want to extract)
export type User = z.infer<typeof UserSchema>;
export type UserWithOptional = z.infer<typeof UserWithOptionalSchema>;
export type Nested = z.infer<typeof NestedSchema>;
