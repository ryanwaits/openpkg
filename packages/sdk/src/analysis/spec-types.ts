import type { OpenPkg, SpecSchema } from '@openpkg-ts/spec';

export type OpenPkgSpec = OpenPkg;

export type ExportDefinition = OpenPkgSpec['exports'][number];
export type TypeDefinition = NonNullable<OpenPkgSpec['types']>[number];
// TypeReference is the SDK's internal representation during serialization
// It uses SpecSchema for type-safety but the actual shapes are produced at runtime
export type TypeReference = SpecSchema;
