/**
 * Mixed Schema Libraries Fixture
 * Tests handling multiple schema libraries in one file
 */

import { type Static, Type } from '@sinclair/typebox';
import * as v from 'valibot';
import { z } from 'zod';

// Zod schema
export const ZodUserSchema = z.object({
  name: z.string(),
  age: z.number(),
});

// Valibot schema
export const ValibotUserSchema = v.object({
  name: v.string(),
  age: v.number(),
});

// TypeBox schema
export const TypeBoxUserSchema = Type.Object({
  name: Type.String(),
  age: Type.Number(),
});

// Regular TypeScript (no schema library)
export interface PlainUser {
  name: string;
  age: number;
}

export function createUser(name: string, age: number): PlainUser {
  return { name, age };
}

// Type exports
export type ZodUser = z.infer<typeof ZodUserSchema>;
export type ValibotUser = v.InferOutput<typeof ValibotUserSchema>;
export type TypeBoxUser = Static<typeof TypeBoxUserSchema>;
