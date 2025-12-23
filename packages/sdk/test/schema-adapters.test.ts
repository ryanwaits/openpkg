/**
 * Schema Adapter Tests
 *
 * Tests static type extraction from schema validation libraries.
 */
import { describe, expect, it } from 'bun:test';
import * as path from 'node:path';
import ts from 'typescript';
import {
  extractSchemaOutputType,
  extractSchemaType,
  findAdapter,
  getSupportedLibraries,
  isSchemaType,
} from '../src/extract/schema';

const FIXTURES_DIR = path.join(import.meta.dir, '../src/__fixtures__/schema-libs');

/**
 * Helper to create a TypeScript program and checker for a fixture file.
 */
function createTestProgram(file: string) {
  const filePath = path.join(FIXTURES_DIR, file);

  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.Latest,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
  };

  const program = ts.createProgram([filePath], compilerOptions);
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(filePath);

  if (!sourceFile) {
    throw new Error(`Could not load source file: ${filePath}`);
  }

  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
  if (!moduleSymbol) {
    throw new Error(`Could not get module symbol for: ${filePath}`);
  }

  const exports = checker.getExportsOfModule(moduleSymbol);

  return {
    checker,
    getExportType: (name: string): ts.Type | null => {
      const symbol = exports.find((s) => s.name === name);
      if (!symbol) return null;

      // Skip type-only exports
      const decls = symbol.getDeclarations();
      if (!decls || decls.length === 0) return null;
      if (ts.isTypeAliasDeclaration(decls[0]) || ts.isInterfaceDeclaration(decls[0])) {
        return null;
      }

      return checker.getTypeOfSymbol(symbol);
    },
  };
}

describe('getSupportedLibraries', () => {
  it('returns all supported library names', () => {
    const libs = getSupportedLibraries();
    expect(libs).toContain('zod');
    expect(libs).toContain('valibot');
    expect(libs).toContain('@sinclair/typebox');
    expect(libs).toContain('arktype');
  });
});

describe('Zod Adapter', () => {
  it('detects Zod schema types', () => {
    const { checker, getExportType } = createTestProgram('zod-basic.ts');
    const type = getExportType('UserSchema');
    expect(type).not.toBeNull();
    expect(isSchemaType(type!, checker)).toBe(true);

    const adapter = findAdapter(type!, checker);
    expect(adapter?.id).toBe('zod');
  });

  it('extracts output type from z.object', () => {
    const { checker, getExportType } = createTestProgram('zod-basic.ts');
    const type = getExportType('UserSchema');
    expect(type).not.toBeNull();

    const outputType = extractSchemaOutputType(type!, checker);
    expect(outputType).not.toBeNull();

    const typeStr = checker.typeToString(outputType!);
    expect(typeStr).toContain('name: string');
    expect(typeStr).toContain('age: number');
    expect(typeStr).toContain('email: string');
  });

  it('extracts output type from z.array', () => {
    const { checker, getExportType } = createTestProgram('zod-basic.ts');
    const type = getExportType('StringArraySchema');
    expect(type).not.toBeNull();

    const outputType = extractSchemaOutputType(type!, checker);
    expect(outputType).not.toBeNull();

    const typeStr = checker.typeToString(outputType!);
    expect(typeStr).toBe('string[]');
  });

  it('handles optional fields', () => {
    const { checker, getExportType } = createTestProgram('zod-basic.ts');
    const type = getExportType('UserWithOptionalSchema');
    expect(type).not.toBeNull();

    const outputType = extractSchemaOutputType(type!, checker);
    expect(outputType).not.toBeNull();

    const typeStr = checker.typeToString(outputType!);
    expect(typeStr).toContain('age?:');
  });

  it('handles nested objects', () => {
    const { checker, getExportType } = createTestProgram('zod-basic.ts');
    const type = getExportType('NestedSchema');
    expect(type).not.toBeNull();

    const outputType = extractSchemaOutputType(type!, checker);
    expect(outputType).not.toBeNull();

    const typeStr = checker.typeToString(outputType!);
    expect(typeStr).toContain('user:');
    expect(typeStr).toContain('metadata:');
  });
});

describe('Valibot Adapter', () => {
  it('detects Valibot schema types', () => {
    const { checker, getExportType } = createTestProgram('valibot-basic.ts');
    const type = getExportType('UserSchema');
    expect(type).not.toBeNull();
    expect(isSchemaType(type!, checker)).toBe(true);

    const adapter = findAdapter(type!, checker);
    expect(adapter?.id).toBe('valibot');
  });

  it('extracts output type from v.object', () => {
    const { checker, getExportType } = createTestProgram('valibot-basic.ts');
    const type = getExportType('UserSchema');
    expect(type).not.toBeNull();

    const outputType = extractSchemaOutputType(type!, checker);
    expect(outputType).not.toBeNull();

    const typeStr = checker.typeToString(outputType!);
    expect(typeStr).toContain('name: string');
    expect(typeStr).toContain('age: number');
  });

  it('extracts output type from v.array', () => {
    const { checker, getExportType } = createTestProgram('valibot-basic.ts');
    const type = getExportType('StringArraySchema');
    expect(type).not.toBeNull();

    const outputType = extractSchemaOutputType(type!, checker);
    expect(outputType).not.toBeNull();

    const typeStr = checker.typeToString(outputType!);
    expect(typeStr).toBe('string[]');
  });

  it('extracts picklist/enum types', () => {
    const { checker, getExportType } = createTestProgram('valibot-basic.ts');
    const type = getExportType('StatusSchema');
    expect(type).not.toBeNull();

    const outputType = extractSchemaOutputType(type!, checker);
    expect(outputType).not.toBeNull();

    const typeStr = checker.typeToString(outputType!);
    expect(typeStr).toContain('pending');
    expect(typeStr).toContain('active');
    expect(typeStr).toContain('completed');
  });
});

describe('TypeBox Adapter', () => {
  it('detects TypeBox schema types', () => {
    const { checker, getExportType } = createTestProgram('typebox-basic.ts');
    const type = getExportType('UserSchema');
    expect(type).not.toBeNull();
    expect(isSchemaType(type!, checker)).toBe(true);

    const adapter = findAdapter(type!, checker);
    expect(adapter?.id).toBe('typebox');
  });

  it('extracts output type from Type.Object', () => {
    const { checker, getExportType } = createTestProgram('typebox-basic.ts');
    const type = getExportType('UserSchema');
    expect(type).not.toBeNull();

    const outputType = extractSchemaOutputType(type!, checker);
    expect(outputType).not.toBeNull();

    const typeStr = checker.typeToString(outputType!);
    expect(typeStr).toContain('name: string');
    expect(typeStr).toContain('age: number');
  });

  it('extracts output type from Type.Array', () => {
    const { checker, getExportType } = createTestProgram('typebox-basic.ts');
    const type = getExportType('StringArraySchema');
    expect(type).not.toBeNull();

    const outputType = extractSchemaOutputType(type!, checker);
    expect(outputType).not.toBeNull();

    const typeStr = checker.typeToString(outputType!);
    expect(typeStr).toBe('string[]');
  });

  it('handles intersections', () => {
    const { checker, getExportType } = createTestProgram('typebox-basic.ts');
    const type = getExportType('ExtendedSchema');
    expect(type).not.toBeNull();

    const outputType = extractSchemaOutputType(type!, checker);
    expect(outputType).not.toBeNull();

    const typeStr = checker.typeToString(outputType!);
    expect(typeStr).toContain('id');
    expect(typeStr).toContain('name');
  });
});

describe('ArkType Adapter', () => {
  it('detects ArkType schema types', () => {
    const { checker, getExportType } = createTestProgram('arktype-basic.ts');
    const type = getExportType('UserSchema');
    expect(type).not.toBeNull();
    expect(isSchemaType(type!, checker)).toBe(true);

    const adapter = findAdapter(type!, checker);
    expect(adapter?.id).toBe('arktype');
  });

  it('extracts output type from type({...})', () => {
    const { checker, getExportType } = createTestProgram('arktype-basic.ts');
    const type = getExportType('UserSchema');
    expect(type).not.toBeNull();

    const outputType = extractSchemaOutputType(type!, checker);
    expect(outputType).not.toBeNull();

    const typeStr = checker.typeToString(outputType!);
    expect(typeStr).toContain('name: string');
    expect(typeStr).toContain('age: number');
  });

  it('extracts array types', () => {
    const { checker, getExportType } = createTestProgram('arktype-basic.ts');
    const type = getExportType('StringArraySchema');
    expect(type).not.toBeNull();

    const outputType = extractSchemaOutputType(type!, checker);
    expect(outputType).not.toBeNull();

    const typeStr = checker.typeToString(outputType!);
    expect(typeStr).toBe('string[]');
  });

  it('extracts literal union types', () => {
    const { checker, getExportType } = createTestProgram('arktype-basic.ts');
    const type = getExportType('StatusSchema');
    expect(type).not.toBeNull();

    const outputType = extractSchemaOutputType(type!, checker);
    expect(outputType).not.toBeNull();

    const typeStr = checker.typeToString(outputType!);
    expect(typeStr).toContain('pending');
    expect(typeStr).toContain('active');
    expect(typeStr).toContain('completed');
  });
});

describe('Mixed Libraries', () => {
  it('correctly identifies each library in mixed file', () => {
    const { checker, getExportType } = createTestProgram('mixed.ts');

    const zodType = getExportType('ZodUserSchema');
    const valibotType = getExportType('ValibotUserSchema');
    const typeboxType = getExportType('TypeBoxUserSchema');

    expect(zodType).not.toBeNull();
    expect(valibotType).not.toBeNull();
    expect(typeboxType).not.toBeNull();

    expect(findAdapter(zodType!, checker)?.id).toBe('zod');
    expect(findAdapter(valibotType!, checker)?.id).toBe('valibot');
    expect(findAdapter(typeboxType!, checker)?.id).toBe('typebox');
  });

  it('returns null for non-schema types', () => {
    const { checker, getExportType } = createTestProgram('mixed.ts');

    const fnType = getExportType('createUser');
    expect(fnType).not.toBeNull();
    expect(isSchemaType(fnType!, checker)).toBe(false);
    expect(extractSchemaOutputType(fnType!, checker)).toBeNull();
  });
});

describe('extractSchemaType (full result)', () => {
  it('returns adapter info with output type', () => {
    const { checker, getExportType } = createTestProgram('zod-basic.ts');
    const type = getExportType('UserSchema');
    expect(type).not.toBeNull();

    const result = extractSchemaType(type!, checker);
    expect(result).not.toBeNull();
    expect(result?.adapter.id).toBe('zod');
    expect(result?.outputType).not.toBeNull();
  });
});
