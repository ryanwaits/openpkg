export type SpecTag = {
  name: string;
  text: string;
  // Structured fields for known JSDoc tags
  paramName?: string;
  typeAnnotation?: string;
  reference?: string;
  language?: string;
  version?: string;
  reason?: string;
};

// Priority 2: Type alias structural representation
export type SpecTypeAliasKind = 'alias' | 'conditional' | 'mapped' | 'template-literal' | 'infer';

export type SpecConditionalType = {
  checkType: string;
  extendsType: string;
  trueType: string;
  falseType: string;
};

export type SpecMappedType = {
  typeParameter: string;
  nameType?: string;
  valueType?: string;
  readonly?: '+' | '-' | true;
  optional?: '+' | '-' | true;
};

// Priority 2: Decorator representation
export type SpecDecorator = {
  name: string;
  arguments?: unknown[];
  argumentsText?: string[];
};

// Priority 2: Throws documentation
export type SpecThrows = {
  type?: string;
  description?: string;
};

export type SpecSource = {
  file?: string;
  line?: number;
  url?: string;
};

// Priority 3: SpecSchema DSL - Proper discriminated union for type schemas

// Primitive types
export type SpecSchemaPrimitive =
  | { type: 'string'; format?: string; enum?: string[] }
  | { type: 'number'; enum?: number[] }
  | { type: 'boolean'; enum?: boolean[] }
  | { type: 'integer'; format?: string }
  | { type: 'null' }
  | { type: 'undefined' }
  | { type: 'any' }
  | { type: 'unknown' }
  | { type: 'never' }
  | { type: 'void' };

// Composite types
export type SpecSchemaComposite =
  | { type: 'array'; items?: SpecSchema }
  | { type: 'tuple'; items: SpecSchema[]; minItems?: number; maxItems?: number }
  | {
      type: 'object';
      properties?: Record<string, SpecSchema>;
      required?: string[];
      additionalProperties?: boolean | SpecSchema;
      description?: string;
    }
  | { type: 'function'; signatures?: SpecSignature[] };

// Combinators
export type SpecSchemaCombinator =
  | { anyOf: SpecSchema[]; discriminator?: { propertyName: string } }
  | { allOf: SpecSchema[] }
  | { oneOf: SpecSchema[] };

// Reference
export type SpecSchemaRef = { $ref: string };

// Fallback for complex TS types
export type SpecSchemaFallback = { type: string; tsType?: string };

// Generic object for SDK compatibility (allows Record<string, unknown> produced at runtime)
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type SpecSchemaGeneric = Record<string, unknown>;

// Main union - flexible JSON Schema patterns
// Note: SpecSchemaGeneric is last to allow type inference for the more specific variants first
export type SpecSchema =
  | string // Shorthand: "string", "number", etc.
  | SpecSchemaPrimitive
  | SpecSchemaComposite
  | SpecSchemaCombinator
  | SpecSchemaRef
  | SpecSchemaFallback
  | SpecSchemaGeneric;

// Priority 3: Structured example metadata
export type SpecExampleLanguage = 'ts' | 'js' | 'tsx' | 'jsx' | 'shell' | 'json';

export type SpecExample = {
  code: string;
  title?: string;
  description?: string;
  language?: SpecExampleLanguage;
  runnable?: boolean;
  expectedOutput?: string;
  tags?: string[];
};

// Priority 3: Related exports linking
export type SpecRelationType =
  | 'uses'
  | 'returns'
  | 'implements'
  | 'extends'
  | 'see-also'
  | 'companion';

export type SpecRelation = {
  type: SpecRelationType;
  target: string;
  description?: string;
};

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
    | 'async-mismatch'
    | 'property-type-drift'
    | 'example-drift'
    | 'example-syntax-error'
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
  default?: unknown;
  rest?: boolean;
  decorators?: SpecDecorator[];
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
  overloadIndex?: number;
  isImplementation?: boolean;
  throws?: SpecThrows[];
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
  decorators?: SpecDecorator[];
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
  | 'reference'
  | 'external';

export type SpecTypeKind = 'class' | 'interface' | 'type' | 'enum' | 'external';

export type SpecExport = {
  id: string;
  name: string;
  slug?: string;
  displayName?: string;
  alias?: string;
  category?: string;
  importPath?: string;
  kind: SpecExportKind;
  signatures?: SpecSignature[];
  typeParameters?: SpecTypeParameter[];
  members?: SpecMember[];
  type?: string | SpecSchema;
  schema?: SpecSchema;
  description?: string;
  examples?: (string | SpecExample)[];
  source?: SpecSource;
  deprecated?: boolean;
  flags?: Record<string, unknown>;
  tags?: SpecTag[];
  extends?: string;
  implements?: string[];
  // Priority 2: Type alias structural fields
  typeAliasKind?: SpecTypeAliasKind;
  conditionalType?: SpecConditionalType;
  mappedType?: SpecMappedType;
  // Priority 2: Decorators
  decorators?: SpecDecorator[];
  // Priority 2: Module augmentation
  isAugmentation?: boolean;
  augmentedModule?: string;
  // Priority 3: Related exports linking
  related?: SpecRelation[];
};

export type SpecType = {
  id: string;
  name: string;
  slug?: string;
  displayName?: string;
  alias?: string;
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
  extends?: string;
  implements?: string[];
  // Priority 2: Type alias structural fields
  typeAliasKind?: SpecTypeAliasKind;
  conditionalType?: SpecConditionalType;
  mappedType?: SpecMappedType;
  // Priority 3: Related exports linking
  related?: SpecRelation[];
};

export type OpenPkgMeta = {
  name: string;
  version?: string;
  description?: string;
  license?: string;
  repository?: string;
  ecosystem?: string;
};

/** Supported OpenPkg spec versions */
export type OpenPkgVersion = '0.2.0' | '0.3.0';

export type OpenPkg = {
  $schema?: string;
  openpkg: OpenPkgVersion;
  meta: OpenPkgMeta;
  exports: SpecExport[];
  types?: SpecType[];
  examples?: SpecExample[];
  extensions?: SpecExtension;
};
