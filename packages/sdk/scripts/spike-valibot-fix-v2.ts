/**
 * Spike: Fix Valibot - Handle union with undefined
 */
import * as path from 'node:path';
import ts from 'typescript';

const FIXTURES_DIR = path.join(import.meta.dir, '../src/__fixtures__/schema-libs');

function createProgram(filePath: string) {
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

  return { program, checker, sourceFile };
}

function getExportType(
  checker: ts.TypeChecker,
  sourceFile: ts.SourceFile,
  exportName: string,
): ts.Type | null {
  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
  if (!moduleSymbol) return null;

  const exports = checker.getExportsOfModule(moduleSymbol);
  const symbol = exports.find((s) => s.name === exportName);
  if (!symbol) return null;

  return checker.getTypeOfSymbol(symbol);
}

/**
 * Get the non-nullable part of a type (remove undefined/null from union)
 */
function getNonNullableType(type: ts.Type, _checker: ts.TypeChecker): ts.Type {
  // If it's a union, filter out undefined and null
  if (type.isUnion()) {
    const nonNullableTypes = type.types.filter(
      (t) => !(t.flags & ts.TypeFlags.Undefined) && !(t.flags & ts.TypeFlags.Null),
    );

    if (nonNullableTypes.length === 1) {
      return nonNullableTypes[0];
    }
    // If multiple non-nullable types remain, we can't simplify
    // This shouldn't happen for ~types which is { ... } | undefined
  }

  return type;
}

function extractValibotOutput(checker: ts.TypeChecker, type: ts.Type): ts.Type | null {
  // Look for ~types property
  const typesSymbol = type.getProperty('~types');
  if (!typesSymbol) {
    console.log('  No ~types property found');
    return null;
  }

  // Get the type of ~types (might be { input, output, issue } | undefined)
  let typesType = checker.getTypeOfSymbol(typesSymbol);
  console.log(`  ~types raw type: ${checker.typeToString(typesType)}`);

  // Remove undefined from union
  typesType = getNonNullableType(typesType, checker);
  console.log(`  ~types non-nullable: ${checker.typeToString(typesType)}`);

  // Now get the 'output' property
  const outputSymbol = typesType.getProperty('output');
  if (!outputSymbol) {
    console.log('  No output property in ~types');
    return null;
  }

  return checker.getTypeOfSymbol(outputSymbol);
}

// Test
const filePath = path.join(FIXTURES_DIR, 'valibot-basic.ts');
const { checker, sourceFile } = createProgram(filePath);

if (!sourceFile) {
  console.log('Could not load source file');
  process.exit(1);
}

console.log('Testing Valibot extraction with undefined handling:\n');

const exports = ['UserSchema', 'StringArraySchema', 'StatusSchema', 'NestedSchema'];

for (const exportName of exports) {
  console.log(`\n--- ${exportName} ---`);

  const type = getExportType(checker, sourceFile, exportName);
  if (!type) {
    console.log('  Export not found');
    continue;
  }

  const outputType = extractValibotOutput(checker, type);
  if (outputType) {
    console.log(
      `  ✅ OUTPUT: ${checker.typeToString(outputType, undefined, ts.TypeFormatFlags.NoTruncation)}`,
    );
  } else {
    console.log('  ❌ Could not extract output');
  }
}
