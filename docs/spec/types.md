# Types Reference

Complete type definitions from `@openpkg-ts/spec`.

## OpenPkg (Root)

The root spec object:

```typescript
type OpenPkg = {
  $schema?: string;
  openpkg: '0.2.0';
  meta: OpenPkgMeta;
  exports: SpecExport[];
  types?: SpecType[];
  examples?: SpecExample[];
  docs?: SpecDocsMetadata;
  extensions?: SpecExtension;
};
```

## OpenPkgMeta

Package metadata:

```typescript
type OpenPkgMeta = {
  name: string;
  version?: string;
  description?: string;
  license?: string;
  repository?: string;
  ecosystem?: string;
};
```

## SpecExport

An exported function, class, variable, or type:

```typescript
type SpecExport = {
  id: string;
  name: string;
  slug?: string;
  displayName?: string;
  category?: string;
  importPath?: string;
  kind: SpecExportKind;
  signatures?: SpecSignature[];
  typeParameters?: SpecTypeParameter[];
  members?: SpecMember[];
  type?: string | SpecSchema;
  schema?: SpecSchema;
  description?: string;
  examples?: string[];
  docs?: SpecDocsMetadata;
  source?: SpecSource;
  deprecated?: boolean;
  flags?: Record<string, unknown>;
  tags?: SpecTag[];
};
```

## SpecExportKind

Export kinds:

```typescript
type SpecExportKind =
  | 'function'
  | 'class'
  | 'variable'
  | 'interface'
  | 'type'
  | 'enum'
  | 'module'
  | 'namespace'
  | 'reference';
```

## SpecType

A type definition:

```typescript
type SpecType = {
  id: string;
  name: string;
  slug?: string;
  displayName?: string;
  category?: string;
  importPath?: string;
  kind: SpecTypeKind;
  description?: string;
  schema?: SpecSchema;
  type?: string | SpecSchema;
  members?: SpecMember[];
  source?: SpecSource;
  tags?: SpecTag[];
  rawComments?: string;
};

type SpecTypeKind = 'class' | 'interface' | 'type' | 'enum';
```

## SpecSignature

Function/method signature:

```typescript
type SpecSignature = {
  parameters?: SpecSignatureParameter[];
  returns?: SpecSignatureReturn;
  description?: string;
  typeParameters?: SpecTypeParameter[];
};

type SpecSignatureParameter = {
  name: string;
  required?: boolean;
  description?: string;
  schema: SpecSchema;
};

type SpecSignatureReturn = {
  schema: SpecSchema;
  description?: string;
  tsType?: string;
};
```

## SpecTypeParameter

Generic type parameter:

```typescript
type SpecTypeParameter = {
  name: string;
  constraint?: string;
  default?: string;
};
```

## SpecMember

Class/interface member:

```typescript
type SpecMember = {
  id?: string;
  name?: string;
  kind?: string;
  description?: string;
  tags?: SpecTag[];
  visibility?: SpecVisibility;
  flags?: Record<string, unknown>;
  schema?: SpecSchema;
  signatures?: SpecSignature[];
};

type SpecVisibility = 'public' | 'protected' | 'private';
```

## SpecDocsMetadata

Documentation coverage info:

```typescript
type SpecDocsMetadata = {
  coverageScore?: number;
  missing?: SpecDocSignal[];
  drift?: SpecDocDrift[];
};

type SpecDocSignal = 'description' | 'params' | 'returns' | 'examples';
```

## SpecDocDrift

A drift issue:

```typescript
type SpecDocDrift = {
  type:
    | 'param-mismatch'
    | 'param-type-mismatch'
    | 'return-type-mismatch'
    | 'generic-constraint-mismatch'
    | 'optionality-mismatch'
    | 'deprecated-mismatch'
    | 'visibility-mismatch'
    | 'example-drift'
    | 'example-runtime-error'
    | 'broken-link';
  target?: string;
  issue: string;
  suggestion?: string;
};
```

## SpecSource

Source location:

```typescript
type SpecSource = {
  file?: string;
  line?: number;
  url?: string;
};
```

## SpecTag

JSDoc tag:

```typescript
type SpecTag = {
  name: string;
  text: string;
};
```

## SpecSchema

Type schema (JSON Schema-like):

```typescript
type SpecSchema = unknown;
// Can be { type: 'string' }, { $ref: '#/types/User' }, etc.
```

## See Also

- [Overview](./overview.md) - Package overview
- [Drift Types](./drift-types.md) - Drift detection reference

