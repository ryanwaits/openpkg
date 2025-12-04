import { z } from 'zod';

/**
 * Schema for POST /scan request body
 * Validates and restricts URLs to GitHub only
 */
export const scanRequestSchema = z.object({
  url: z
    .string()
    .url('Invalid URL format')
    .regex(/^https:\/\/github\.com\//, 'Only GitHub URLs are allowed'),
  ref: z.string().optional(),
  package: z.string().optional(),
});

export type ScanRequestBody = z.infer<typeof scanRequestSchema>;
