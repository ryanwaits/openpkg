# Clarity Language Support Implementation Plan

## Overview

Add Clarity smart contract language support to DocCov, leveraging:
- `@secondlayer/clarity-docs@0.2.1` - ClarityDoc parser, validator, coverage calculator
- `@secondlayer/clarity-types` - TypeScript definitions for Clarity ABIs
- `@hirosystems/clarinet-sdk` - Clarinet integration for contract analysis

## Current State

DocCov is **heavily TypeScript-coupled**:
- 118+ `ts.is*Declaration` checks across codebase
- 8 serializers tied to TS AST nodes
- Hardcoded `ecosystem: 'js/ts'` at `spec-builder.ts:67`
- No language abstraction layer exists

## Implementation Phases

---

### Phase 0: Language Abstraction Layer (1-2 weeks)

**Goal:** Decouple analysis from TypeScript-specific APIs to enable multi-language support.

#### 0.1 Define Language-Agnostic Interfaces

Create `packages/sdk/src/analysis/languages/types.ts`:

```typescript
interface LanguageAnalyzer {
  language: string;
  ecosystem: string;

  // Project detection
  detectProject(fs: FileSystem, dir: string): Promise<LanguageProjectInfo | null>;

  // Program creation
  createProgram(projectInfo: LanguageProjectInfo): Promise<LanguageProgram>;

  // Export extraction
  getExportedSymbols(program: LanguageProgram): LanguageSymbol[];

  // Serialization
  serializeExport(symbol: LanguageSymbol, program: LanguageProgram): ExportDefinition;

  // Type formatting
  formatType(type: LanguageType): SpecSchema;

  // Documentation extraction
  extractDocumentation(symbol: LanguageSymbol, source: string): ParsedDocumentation | null;
}

interface LanguageProgram {
  getSourceFile(path: string): LanguageSourceFile | undefined;
  getSourceFiles(): LanguageSourceFile[];
  getDiagnostics(): LanguageDiagnostic[];
}

interface LanguageSymbol {
  name: string;
  kind: SymbolKind;
  declarations: LanguageDeclaration[];
  documentation?: string;
  tags?: DocTag[];
}

type SymbolKind =
  | 'function' | 'class' | 'interface' | 'type'
  | 'enum' | 'variable' | 'constant' | 'module'
  | 'map' | 'trait' | 'token';  // Clarity-specific
```

#### 0.2 Refactor TypeScript as First Analyzer

Create `packages/sdk/src/analysis/languages/typescript/`:
```
typescript/
├── index.ts              # TypeScriptAnalyzer class
├── program.ts            # Wrap ts.createProgram
├── symbols.ts            # Wrap ts.Symbol → LanguageSymbol
├── serializers/          # Move existing serializers
│   ├── functions.ts
│   ├── classes.ts
│   ├── interfaces.ts
│   ├── type-aliases.ts
│   ├── enums.ts
│   ├── variables.ts
│   └── namespaces.ts
└── type-formatter.ts     # Existing type-formatter adapted
```

Key changes:
1. Move `program.ts`, `context.ts` → `languages/typescript/`
2. Implement `LanguageAnalyzer` interface
3. Keep internal TS API usage, but expose via abstraction

#### 0.3 Update Spec Builder

Modify `packages/sdk/src/analysis/spec-builder.ts`:

```typescript
// Before
export function buildOpenPkgSpec(context: AnalysisContext, ...) {
  // ... hardcoded TypeScript logic
  ecosystem: 'js/ts',
}

// After
export function buildOpenPkgSpec(
  analyzer: LanguageAnalyzer,
  program: LanguageProgram,
  options: BuildSpecOptions
) {
  const symbols = analyzer.getExportedSymbols(program);
  const spec: OpenPkgSpec = {
    meta: {
      ecosystem: analyzer.ecosystem,  // Dynamic
      // ...
    },
    exports: symbols.map(s => analyzer.serializeExport(s, program)),
  };
}
```

#### 0.4 Create Analyzer Registry

Create `packages/sdk/src/analysis/languages/registry.ts`:

```typescript
class AnalyzerRegistry {
  private analyzers = new Map<string, LanguageAnalyzer>();

  register(analyzer: LanguageAnalyzer): void;

  async detectLanguage(fs: FileSystem, dir: string): Promise<LanguageAnalyzer | null> {
    for (const analyzer of this.analyzers.values()) {
      const info = await analyzer.detectProject(fs, dir);
      if (info) return analyzer;
    }
    return null;
  }

  get(language: string): LanguageAnalyzer | undefined;
}

export const registry = new AnalyzerRegistry();
registry.register(new TypeScriptAnalyzer());
```

---

### Phase 1: Clarity Analyzer (3-5 days)

**Goal:** Implement ClarityAnalyzer using existing secondlayer packages.

#### 1.1 Add Dependencies

```bash
bun add @secondlayer/clarity-types @secondlayer/clarity-docs @hirosystems/clarinet-sdk
```

#### 1.2 Create Clarity Analyzer Structure

Create `packages/sdk/src/analysis/languages/clarity/`:
```
clarity/
├── index.ts              # ClarityAnalyzer class
├── program.ts            # Clarinet SDK integration
├── symbols.ts            # Map ABI → LanguageSymbol
├── serializers.ts        # Clarity → ExportDefinition
├── type-formatter.ts     # ClarityType → SpecSchema
└── detection.ts          # Clarinet.toml detection
```

#### 1.3 Implement ClarityAnalyzer

```typescript
// packages/sdk/src/analysis/languages/clarity/index.ts
import { initSimnet } from '@hirosystems/clarinet-sdk';
import { extractDocs, calculateCoverage } from '@secondlayer/clarity-docs';
import type { ClarityContract } from '@secondlayer/clarity-types';

export class ClarityAnalyzer implements LanguageAnalyzer {
  language = 'clarity';
  ecosystem = 'stacks';

  async detectProject(fs: FileSystem, dir: string): Promise<ClarityProjectInfo | null> {
    const clarinetPath = path.join(dir, 'Clarinet.toml');
    if (!await fs.exists(clarinetPath)) return null;

    const content = await fs.readFile(clarinetPath);
    const config = toml.parse(content);

    return {
      type: 'clarity',
      manifestPath: clarinetPath,
      contracts: Object.entries(config.contracts || {}).map(([name, cfg]) => ({
        name,
        path: cfg.path || `contracts/${name}.clar`,
      })),
    };
  }

  async createProgram(projectInfo: ClarityProjectInfo): Promise<ClarityProgram> {
    const simnet = await initSimnet(projectInfo.manifestPath);
    const interfaces = simnet.getContractsInterfaces();

    // Load sources for doc extraction
    const sources = new Map<string, string>();
    for (const contract of projectInfo.contracts) {
      const source = await fs.readFile(path.join(projectInfo.dir, contract.path));
      sources.set(contract.name, source);
    }

    return { interfaces, sources, simnet };
  }

  getExportedSymbols(program: ClarityProgram): ClaritySymbol[] {
    const symbols: ClaritySymbol[] = [];

    for (const [contractId, abi] of program.interfaces) {
      const source = program.sources.get(contractId.split('.')[1]);
      const docs = source ? extractDocs(source) : null;

      // Public/read-only functions
      for (const fn of abi.functions) {
        if (fn.access !== 'private') {
          symbols.push({
            name: fn.name,
            kind: 'function',
            contractId,
            definition: fn,
            documentation: docs?.functions.get(fn.name),
          });
        }
      }

      // Maps
      for (const map of abi.maps || []) {
        symbols.push({
          name: map.name,
          kind: 'map',
          contractId,
          definition: map,
          documentation: docs?.maps.get(map.name),
        });
      }

      // Variables
      for (const v of abi.variables || []) {
        symbols.push({
          name: v.name,
          kind: 'variable',
          contractId,
          definition: v,
          documentation: docs?.variables.get(v.name),
        });
      }

      // Traits
      for (const trait of abi.defined_traits || []) {
        symbols.push({
          name: trait.name,
          kind: 'trait',
          contractId,
          definition: trait,
          documentation: docs?.traits.get(trait.name),
        });
      }

      // Tokens
      for (const ft of abi.fungible_tokens || []) {
        symbols.push({ name: ft.name, kind: 'token', contractId, tokenType: 'fungible' });
      }
      for (const nft of abi.non_fungible_tokens || []) {
        symbols.push({ name: nft.name, kind: 'token', contractId, tokenType: 'non-fungible' });
      }
    }

    return symbols;
  }
}
```

#### 1.4 Implement Type Formatter

```typescript
// packages/sdk/src/analysis/languages/clarity/type-formatter.ts
import type { ClarityType } from '@secondlayer/clarity-types';
import { isClarityOptional, isClarityList, isClarityTuple, isClarityResponse } from '@secondlayer/clarity-types';

export function clarityTypeToSchema(type: ClarityType): SpecSchema {
  if (type === 'uint128') return { type: 'integer', format: 'uint128', minimum: 0 };
  if (type === 'int128') return { type: 'integer', format: 'int128' };
  if (type === 'bool') return { type: 'boolean' };
  if (type === 'principal') return { type: 'string', format: 'stacks-principal' };
  if (type === 'none') return { type: 'null' };

  if (typeof type === 'object') {
    if ('buffer' in type) return { type: 'string', format: 'hex', maxLength: type.buffer.length * 2 };
    if ('string-ascii' in type) return { type: 'string', maxLength: type['string-ascii'].length };
    if ('string-utf8' in type) return { type: 'string', maxLength: type['string-utf8'].length };

    if (isClarityOptional(type)) {
      return { oneOf: [clarityTypeToSchema(type.optional), { type: 'null' }] };
    }

    if (isClarityList(type)) {
      return { type: 'array', items: clarityTypeToSchema(type.list.type), maxItems: type.list.length };
    }

    if (isClarityTuple(type)) {
      const properties: Record<string, SpecSchema> = {};
      for (const [key, val] of Object.entries(type.tuple)) {
        properties[key] = clarityTypeToSchema(val);
      }
      return { type: 'object', properties, required: Object.keys(properties) };
    }

    if (isClarityResponse(type)) {
      return {
        oneOf: [
          { type: 'object', properties: { ok: clarityTypeToSchema(type.response.ok) } },
          { type: 'object', properties: { err: clarityTypeToSchema(type.response.error) } },
        ]
      };
    }

    if ('trait_reference' in type) {
      return { $ref: `#/types/${type.trait_reference.name}` };
    }
  }

  return { type: 'unknown', tsType: JSON.stringify(type) };
}
```

#### 1.5 Implement Serializers

```typescript
// packages/sdk/src/analysis/languages/clarity/serializers.ts

export function serializeClarityFunction(
  symbol: ClaritySymbol,
  program: ClarityProgram
): ExportDefinition {
  const fn = symbol.definition as ClarityFunction;
  const doc = symbol.documentation;

  return {
    id: `${symbol.contractId}::${fn.name}`,
    name: fn.name,
    kind: 'function',
    description: doc?.notice,
    signatures: [{
      parameters: fn.args.map((arg, i) => ({
        name: arg.name,
        schema: clarityTypeToSchema(arg.type),
        description: doc?.params.find(p => p.name === arg.name)?.description,
        required: true,  // Clarity has no optional params
      })),
      returns: {
        schema: clarityTypeToSchema(fn.outputs),
        description: doc?.return,
      },
    }],
    tags: [
      { name: 'access', value: fn.access },  // public | read-only
    ],
    source: { file: symbol.contractId, line: 0 },  // TODO: get line from source
  };
}

export function serializeClarityMap(symbol: ClaritySymbol): ExportDefinition {
  const map = symbol.definition as ClarityMap;
  const doc = symbol.documentation;

  return {
    id: `${symbol.contractId}::${map.name}`,
    name: map.name,
    kind: 'variable',  // Maps as variables with special schema
    description: doc?.notice,
    schema: {
      type: 'object',
      properties: {
        key: clarityTypeToSchema(map.key),
        value: clarityTypeToSchema(map.value),
      },
    },
    tags: [{ name: 'clarity-type', value: 'map' }],
  };
}

// Similar for variables, traits, tokens...
```

---

### Phase 2: Documentation Integration (Mapping clarity-docs → DocCov)

`@secondlayer/clarity-docs@0.2.1` provides exactly what DocCov needs:

#### API Surface to Use

```typescript
import {
  extractDocs,           // Parse source → ContractDoc
  validateDocs,          // ContractDoc + ABI → ValidationResult
  calculateCoverage,     // ContractDoc + ABI → CoverageMetrics
} from '@secondlayer/clarity-docs';

import type {
  ContractDoc,
  FunctionDoc,
  MapDoc,
  VariableDoc,
  TraitDoc,
  CoverageMetrics,
  ValidationResult,
} from '@secondlayer/clarity-docs';
```

#### Type Mapping: clarity-docs → DocCov

| clarity-docs | DocCov |
|--------------|--------|
| `FunctionDoc.desc` | `ExportDefinition.description` |
| `FunctionDoc.params[]` | `SpecSignatureParameter[]` |
| `FunctionDoc.ok` | `SpecSignatureReturn.description` |
| `FunctionDoc.errs[]` | `SpecThrows[]` |
| `FunctionDoc.examples[]` | `ExportDefinition.examples` |
| `FunctionDoc.deprecated` | `ExportDefinition.deprecated` |
| `FunctionDoc.see[]` | `ExportDefinition.related[]` |
| `FunctionDoc.startLine` | `ExportDefinition.source.line` |
| `MapDoc.key` | Schema property description |
| `MapDoc.value` | Schema property description |
| `CoverageMetrics.overallCoverage` | `CoverageSummary.score` |

#### Serializer Implementation

```typescript
// packages/sdk/src/analysis/languages/clarity/serializers.ts

function serializeClarityFunction(
  fn: ClarityFunction,           // From ABI
  doc: FunctionDoc | undefined,  // From clarity-docs
  contractId: string
): ExportDefinition {
  return {
    id: `${contractId}::${fn.name}`,
    name: fn.name,
    kind: 'function',
    description: doc?.desc,
    deprecated: doc?.deprecated ? true : undefined,
    signatures: [{
      parameters: fn.args.map(arg => ({
        name: arg.name,
        schema: clarityTypeToSchema(arg.type),
        description: doc?.params.find(p => p.name === arg.name)?.description,
        required: true,
      })),
      returns: {
        schema: clarityTypeToSchema(fn.outputs),
        description: doc?.ok,
      },
      throws: doc?.errs.map(e => ({
        type: e.code,
        description: e.description,
      })),
    }],
    examples: doc?.examples,
    tags: [
      { name: 'access', value: fn.access },
      ...(doc?.callers?.map(c => ({ name: 'caller', value: c })) || []),
    ],
    related: doc?.see?.map(s => ({ type: 'see', target: s })),
    source: doc ? { file: contractId, line: doc.startLine } : undefined,
  };
}

function serializeClarityMap(
  map: ClarityMap,
  doc: MapDoc | undefined,
  contractId: string
): ExportDefinition {
  return {
    id: `${contractId}::${map.name}`,
    name: map.name,
    kind: 'variable',
    description: doc?.desc,
    deprecated: doc?.deprecated ? true : undefined,
    schema: {
      type: 'object',
      description: 'Clarity map',
      properties: {
        key: {
          ...clarityTypeToSchema(map.key),
          description: doc?.key,
        },
        value: {
          ...clarityTypeToSchema(map.value),
          description: doc?.value,
        },
      },
    },
    tags: [{ name: 'clarity-type', value: 'map' }],
    source: doc ? { file: contractId, line: doc.startLine } : undefined,
  };
}
```

#### Coverage Mapping

```typescript
// Map clarity-docs CoverageMetrics → DocCov CoverageSummary
function mapCoverage(metrics: CoverageMetrics): Partial<CoverageSummary> {
  return {
    score: Math.round(metrics.overallCoverage),
    totalExports: metrics.totalFunctions + metrics.totalMaps + metrics.totalVariables,
    documentedExports: metrics.documentedFunctions + metrics.documentedMaps + metrics.documentedVariables,
  };
}
```

#### Validation → Drift Mapping

```typescript
// Map clarity-docs ValidationResult → DocCov drift
function mapValidationToDrift(result: ValidationResult): SpecDocDrift[] {
  return result.diagnostics
    .filter(d => d.severity === 'warning' || d.severity === 'error')
    .map(d => ({
      type: mapDiagnosticType(d),  // param-mismatch, missing-description, etc.
      target: d.target,
      issue: d.message,
      suggestion: undefined,  // clarity-docs doesn't provide suggestions yet
    }));
}
```

#### Lazy Loading Implementation

```typescript
// packages/sdk/src/analysis/languages/clarity/index.ts

// Lazy-load heavy dependencies
let _clarityDocs: typeof import('@secondlayer/clarity-docs') | null = null;
let _clarinetSdk: typeof import('@hirosystems/clarinet-sdk') | null = null;

async function getClarityDocs() {
  if (!_clarityDocs) {
    _clarityDocs = await import('@secondlayer/clarity-docs');
  }
  return _clarityDocs;
}

async function getClarinetSdk() {
  if (!_clarinetSdk) {
    _clarinetSdk = await import('@hirosystems/clarinet-sdk');
  }
  return _clarinetSdk;
}

export class ClarityAnalyzer implements LanguageAnalyzer {
  // Detection is lightweight - just file checks
  async detectProject(fs: FileSystem, dir: string): Promise<ClarityProjectInfo | null> {
    const clarinetPath = path.join(dir, 'Clarinet.toml');
    if (!await fs.exists(clarinetPath)) return null;
    // ... parse TOML without heavy deps
  }

  // Heavy deps only loaded when actually analyzing
  async createProgram(projectInfo: ClarityProjectInfo): Promise<ClarityProgram> {
    const { initSimnet } = await getClarinetSdk();  // Lazy load ~5-10MB
    const simnet = await initSimnet(projectInfo.manifestPath);
    // ...
  }

  async extractDocumentation(source: string): Promise<ContractDoc> {
    const { extractDocs } = await getClarityDocs();  // Lazy load
    return extractDocs(source);
  }
}
```

---

### Phase 3: CLI Integration (2 days)

#### 3.1 Update Options

```typescript
// packages/sdk/src/options.ts
export interface DocCovOptions {
  // ... existing
  language?: 'typescript' | 'clarity' | 'auto';  // New
}
```

#### 3.2 Update Entry Point Detection

```typescript
// packages/sdk/src/detect/index.ts
export async function analyzeProject(fs: FileSystem, options: AnalyzeOptions): Promise<ProjectInfo> {
  // Try Clarity first (Clarinet.toml)
  const clarityInfo = await detectClarityProject(fs, options.cwd);
  if (clarityInfo) {
    return { ...clarityInfo, language: 'clarity', ecosystem: 'stacks' };
  }

  // Fall back to TypeScript/JS
  // ... existing detection
  return { ...existing, language: 'typescript', ecosystem: 'js/ts' };
}
```

#### 3.3 Update CLI Commands

```typescript
// packages/cli/src/commands/check.ts
.option('--language <lang>', 'Force language: typescript, clarity, auto', 'auto')

// In handler
const analyzer = options.language === 'auto'
  ? await registry.detectLanguage(fs, cwd)
  : registry.get(options.language);
```

---

### Phase 4: Coverage Rules (1 day)

#### 4.1 Add Clarity-Specific Rules

```typescript
// packages/sdk/src/quality/rules/clarity.ts
export const clarityRules: QualityRule[] = [
  {
    id: 'clarity/public-function-documented',
    name: 'Public functions must have @notice',
    severity: 'error',
    affectsCoverage: true,
    appliesTo: (exp) => exp.kind === 'function' && exp.tags?.some(t => t.name === 'access' && t.value === 'public'),
    check: (exp) => !!exp.description,
  },
  {
    id: 'clarity/params-documented',
    name: 'Function parameters must have @param',
    severity: 'warning',
    affectsCoverage: true,
    appliesTo: (exp) => exp.kind === 'function',
    check: (exp) => {
      const params = exp.signatures?.[0]?.parameters || [];
      return params.every(p => !!p.description);
    },
  },
  {
    id: 'clarity/map-documented',
    name: 'Maps should have @key and @value descriptions',
    severity: 'warning',
    affectsCoverage: true,
    appliesTo: (exp) => exp.tags?.some(t => t.name === 'clarity-type' && t.value === 'map'),
    check: (exp) => !!exp.description,
  },
  {
    id: 'clarity/errors-documented',
    name: 'Error codes should have @error tags',
    severity: 'warning',
    affectsCoverage: false,  // Optional best practice
    appliesTo: (exp) => exp.kind === 'function',
    check: (exp) => true,  // TODO: Check for @error tags
  },
];
```

---

## File Changes Summary

### New Files
```
packages/sdk/src/analysis/languages/
├── types.ts                    # Language-agnostic interfaces
├── registry.ts                 # Analyzer registry
├── typescript/                 # Refactored TS analyzer
│   ├── index.ts
│   ├── program.ts
│   ├── symbols.ts
│   ├── serializers/
│   └── type-formatter.ts
└── clarity/                    # New Clarity analyzer
    ├── index.ts
    ├── program.ts
    ├── symbols.ts
    ├── serializers.ts
    ├── type-formatter.ts
    └── detection.ts
```

### Modified Files
```
packages/sdk/src/analysis/spec-builder.ts     # Use LanguageAnalyzer
packages/sdk/src/analysis/context.ts          # Make language-agnostic
packages/sdk/src/detect/index.ts              # Add Clarity detection
packages/sdk/src/options.ts                   # Add language option
packages/sdk/src/openpkg.ts                   # Use analyzer registry
packages/cli/src/commands/check.ts            # Add --language flag
packages/sdk/src/quality/rules/index.ts       # Register Clarity rules
package.json                                  # Add dependencies
```

---

## Dependencies

```json
{
  "dependencies": {
    "@secondlayer/clarity-types": "^0.x.x",
    "@secondlayer/clarity-docs": "^0.2.1",
    "@hirosystems/clarinet-sdk": "^2.x.x"
  }
}
```

**Note:** Clarinet SDK adds ~5-10MB Wasm bundle. Consider lazy-loading for projects that don't use Clarity.

---

## Testing Strategy

1. **Unit tests** for each serializer (Clarity → ExportDefinition)
2. **Integration tests** with sample Clarity projects
3. **Coverage calculation tests** comparing `@secondlayer/clarity-docs` output
4. **CLI tests** with `--language clarity` and auto-detection

Sample test project:
```
test-fixtures/clarity-project/
├── Clarinet.toml
├── contracts/
│   ├── counter.clar       # Basic contract
│   └── token.clar         # FT/NFT example
└── settings/
    └── Devnet.toml
```

---

## Effort Estimate

| Phase | Description | Effort |
|-------|-------------|--------|
| 0.1-0.4 | Language abstraction layer | 5-7 days |
| 1.1-1.5 | Clarity analyzer implementation | 3-4 days |
| 2 | Documentation integration | 1 day (mostly done) |
| 3 | CLI integration | 1-2 days |
| 4 | Coverage rules | 1 day |
| **Total** | | **~2 weeks** |

---

## Design Decisions

1. **Lazy loading:** Yes - Clarinet SDK will be dynamically imported only when analyzing Clarity projects
2. **Multi-contract output:** Single spec with grouped exports (prefixed by contract name)
3. **PR strategy:** Two separate PRs - Phase 0 (language abstraction) first, then Clarity support

## Remaining Questions

1. **Trait coverage?** How to handle trait implementation coverage?
2. **Line numbers?** Need to extract source locations from Clarity parser

---

## PR Breakdown

### PR #1: Language Abstraction Layer
- Phases 0.1-0.4
- Refactor TypeScript analyzer to implement `LanguageAnalyzer` interface
- Create analyzer registry
- Update spec-builder to use dynamic ecosystem
- **No new dependencies**
- **No breaking changes** (TypeScript behavior unchanged)

### PR #2: Clarity Support
- Phases 1-4
- Add `@secondlayer/clarity-docs`, `@secondlayer/clarity-types`, `@hirosystems/clarinet-sdk`
- Implement `ClarityAnalyzer` with lazy loading
- Add Clarinet.toml detection
- Add `--language` CLI flag
- Add Clarity-specific coverage rules
