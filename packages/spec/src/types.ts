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

export type SpecSignatureParameter = {
  name: string;
  required?: boolean;
  schema: SpecSchema;
};

export type SpecSignatureReturn = {
  schema: SpecSchema;
  description?: string;
};

export type SpecSignature = {
  parameters?: SpecSignatureParameter[];
  returns?: SpecSignatureReturn;
  description?: string;
};

export type SpecMember = unknown;

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
  kind: SpecExportKind;
  signatures?: SpecSignature[];
  members?: SpecMember[];
  type?: string | SpecSchema;
  schema?: SpecSchema;
  description?: string;
  examples?: string[];
  source?: SpecSource;
  flags?: Record<string, unknown>;
  tags?: SpecTag[];
};

export type SpecType = {
  id: string;
  name: string;
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
  openpkg: '0.1.0';
  meta: OpenPkgMeta;
  exports: SpecExport[];
  types?: SpecType[];
  examples?: SpecExample[];
  extensions?: SpecExtension;
};
