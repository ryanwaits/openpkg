import type { OpenPkg } from '@openpkg-ts/spec';

export type OpenPkgSpec = OpenPkg;

export type ExportDefinition = OpenPkgSpec['exports'][number];
export type TypeDefinition = NonNullable<OpenPkgSpec['types']>[number];
export type TypeReference = Record<string, unknown> | string;
