/**
 * Zod Complex Fixtures
 * Tests advanced Zod schema patterns
 */
import { z } from 'zod';

// Union types
export const StringOrNumberSchema = z.union([z.string(), z.number()]);

// Discriminated unions
export const EventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('click'), x: z.number(), y: z.number() }),
  z.object({ type: z.literal('scroll'), offset: z.number() }),
  z.object({ type: z.literal('keypress'), key: z.string() }),
]);

// Enums
export const StatusSchema = z.enum(['pending', 'active', 'completed']);

// Native enums
enum NativeStatus {
  Pending = 'pending',
  Active = 'active',
}
export const NativeEnumSchema = z.nativeEnum(NativeStatus);

// Transform (output differs from input)
export const TransformSchema = z.string().transform((s) => s.length);

// Pipe (chained transformations)
export const PipeSchema = z.string().pipe(z.coerce.number());

// Lazy (recursive)
interface Category {
  name: string;
  subcategories: Category[];
}
export const CategorySchema: z.ZodType<Category> = z.lazy(() =>
  z.object({
    name: z.string(),
    subcategories: z.array(CategorySchema),
  }),
);

// Extend
const BaseSchema = z.object({ id: z.string() });
export const ExtendedSchema = BaseSchema.extend({
  name: z.string(),
  createdAt: z.date(),
});

// Merge
const Schema1 = z.object({ foo: z.string() });
const Schema2 = z.object({ bar: z.number() });
export const MergedSchema = Schema1.merge(Schema2);

// Pick/Omit
export const PickedSchema = z
  .object({ a: z.string(), b: z.number(), c: z.boolean() })
  .pick({ a: true, b: true });
export const OmittedSchema = z
  .object({ a: z.string(), b: z.number(), c: z.boolean() })
  .omit({ c: true });

// Partial/Required
export const PartialSchema = z.object({ name: z.string(), age: z.number() }).partial();
export const RequiredSchema = z
  .object({ name: z.string().optional(), age: z.number().optional() })
  .required();

// Record
export const RecordSchema = z.record(z.string(), z.number());

// Tuple
export const TupleSchema = z.tuple([z.string(), z.number(), z.boolean()]);

// Inferred types
export type Event = z.infer<typeof EventSchema>;
export type Status = z.infer<typeof StatusSchema>;
export type Transform = z.infer<typeof TransformSchema>;
export type Extended = z.infer<typeof ExtendedSchema>;
export type Merged = z.infer<typeof MergedSchema>;
