export type SpecTag = {
  name: string;
  text: string;
};

export type SpecSource = {
  file?: string;
  line?: number;
  url?: string;
};

export type SpecSchema = unknown;

export type SpecExample = Record<string, unknown>;

export type SpecExtension = Record<string, unknown>;

export type SpecDocSignal = 'description' | 'params' | 'returns' | 'examples';

export type SpecDocDrift = {
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
    | 'example-assertion-failed'
    | 'broken-link';
  target?: string;
  issue: string;
  suggestion?: string;
};

export type SpecVisibility = 'public' | 'protected' | 'private';

export type SpecDocsMetadata = {
  coverageScore?: number;
  missing?: SpecDocSignal[];
  drift?: SpecDocDrift[];
};

export type SpecTypeParameter = {
  name: string;
  constraint?: string;
  default?: string;
};

export type SpecSignatureParameter = {
  name: string;
  required?: boolean;
  description?: string;
  schema: SpecSchema;
};

export type SpecSignatureReturn = {
  schema: SpecSchema;
  description?: string;
  tsType?: string;
};

export type SpecSignature = {
  parameters?: SpecSignatureParameter[];
  returns?: SpecSignatureReturn;
  description?: string;
  typeParameters?: SpecTypeParameter[];
};

export type SpecMember = {
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

export type SpecExportKind =
  | 'function'
  | 'class'
  | 'variable'
  | 'interface'
  | 'type'
  | 'enum'
  | 'module'
  | 'namespace'
  | 'reference';

export type SpecTypeKind = 'class' | 'interface' | 'type' | 'enum';

export type SpecExport = {
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

export type SpecType = {
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

export type OpenPkgMeta = {
  name: string;
  version?: string;
  description?: string;
  license?: string;
  repository?: string;
  ecosystem?: string;
};

export type OpenPkg = {
  $schema?: string;
  openpkg: '0.2.0';
  meta: OpenPkgMeta;
  exports: SpecExport[];
  types?: SpecType[];
  examples?: SpecExample[];
  docs?: SpecDocsMetadata;
  extensions?: SpecExtension;
};
