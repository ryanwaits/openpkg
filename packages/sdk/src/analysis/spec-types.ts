import type { OpenPkgSpec } from '../types/openpkg';

export type ExportDefinition = OpenPkgSpec['exports'][number];
export type TypeDefinition = NonNullable<OpenPkgSpec['types']>[number];
export type TypeReference = Record<string, unknown> | string;
