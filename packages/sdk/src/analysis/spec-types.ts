import type { z } from 'zod';
import type { openPkgSchema } from '../types/openpkg';

export type OpenPkgSpec = z.infer<typeof openPkgSchema>;
export type ExportDefinition = OpenPkgSpec['exports'][number];
export type TypeDefinition = OpenPkgSpec['types'] extends Array<infer T> ? T : never;
export type TypeReference = Record<string, unknown> | string;
