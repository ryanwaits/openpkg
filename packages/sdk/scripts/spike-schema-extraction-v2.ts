/**
 * Spike Script v2: Targeted Output Type Extraction
 *
 * Based on findings from v1, this script tests specific extraction strategies:
 * - ArkType: Direct from arg[0] - EASY
 * - Valibot: From ~types.output property
 * - Zod: Need to find _output or recursively unwrap
 * - TypeBox: Need to access static property or unwrap
 *
 * Run with: bun packages/sdk/scripts/spike-schema-extraction-v2.ts
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

function inspectTypeProperties(checker: ts.TypeChecker, type: ts.Type, prefix = ''): void {
  const props = type.getProperties();
  for (const prop of props.slice(0, 15)) {
    const propType = checker.getTypeOfSymbol(prop);
    const typeStr = checker.typeToString(propType);
    console.log(`${prefix}${prop.name}: ${typeStr.substring(0, 100)}`);
  }
}

// ============================================================================
// STRATEGY 1: ArkType - Direct from type argument
// ============================================================================
function extractArkTypeOutput(checker: ts.TypeChecker, type: ts.Type): ts.Type | null {
  // ArkType: Type<Output, Input>
  // Output is directly at arg[0]
  if (!(type.flags & ts.TypeFlags.Object)) return null;

  const objType = type as ts.ObjectType;
  if (!(objType.objectFlags & ts.ObjectFlags.Reference)) return null;

  const typeRef = type as ts.TypeReference;
  const typeName = checker.typeToString(type);

  // Check if it's an ArkType Type<...>
  if (!typeName.startsWith('Type<')) return null;

  const args = checker.getTypeArguments(typeRef);
  if (args.length < 1) return null;

  // arg[0] is the output type
  return args[0];
}

// ============================================================================
// STRATEGY 2: Valibot - From ~types.output property
// ============================================================================
function extractValibotOutput(checker: ts.TypeChecker, type: ts.Type): ts.Type | null {
  // Look for ~types property which has { input, output }
  const typesSymbol = type.getProperty('~types');
  if (!typesSymbol) return null;

  const typesType = checker.getTypeOfSymbol(typesSymbol);
  const outputSymbol = typesType.getProperty('output');
  if (!outputSymbol) return null;

  return checker.getTypeOfSymbol(outputSymbol);
}

// ============================================================================
// STRATEGY 3: Zod - From _output property or type reconstruction
// ============================================================================
function extractZodOutput(checker: ts.TypeChecker, type: ts.Type): ts.Type | null {
  // First, try to find _output property (Zod stores this internally)
  const outputSymbol = type.getProperty('_output');
  if (outputSymbol) {
    return checker.getTypeOfSymbol(outputSymbol);
  }

  // Alternative: Look for the output in the generic type
  // ZodObject has shape ZodType<Output, ZodTypeDef, Input>
  // For ZodObject specifically, we need to look at the $inferOutput
  const inferSymbol = type.getProperty('_type');
  if (inferSymbol) {
    return checker.getTypeOfSymbol(inferSymbol);
  }

  return null;
}

// ============================================================================
// STRATEGY 4: TypeBox - From static property or type reconstruction
// ============================================================================
function extractTypeBoxOutput(checker: ts.TypeChecker, type: ts.Type): ts.Type | null {
  // TypeBox schemas have a 'static' property that contains the output type
  const staticSymbol = type.getProperty('static');
  if (staticSymbol) {
    return checker.getTypeOfSymbol(staticSymbol);
  }

  return null;
}

// ============================================================================
// Test all strategies
// ============================================================================
function testStrategy(
  name: string,
  file: string,
  exportName: string,
  extractor: (checker: ts.TypeChecker, type: ts.Type) => ts.Type | null,
): void {
  const filePath = path.join(FIXTURES_DIR, file);
  const { checker, sourceFile } = createProgram(filePath);

  if (!sourceFile) {
    console.log(`❌ ${name}: Could not load source file`);
    return;
  }

  const type = getExportType(checker, sourceFile, exportName);
  if (!type) {
    console.log(`❌ ${name}: Could not find export ${exportName}`);
    return;
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${name}`);
  console.log(`Export: ${exportName}`);
  console.log(`Raw Type: ${checker.typeToString(type).substring(0, 100)}`);
  console.log('='.repeat(60));

  // Show all properties of the type
  console.log('\nType Properties:');
  inspectTypeProperties(checker, type, '  ');

  const outputType = extractor(checker, type);
  if (outputType) {
    console.log('\n✅ EXTRACTED OUTPUT TYPE:');
    console.log(
      `   ${checker.typeToString(outputType, undefined, ts.TypeFormatFlags.NoTruncation)}`,
    );

    // If it's an object, show its properties
    if (outputType.flags & ts.TypeFlags.Object) {
      const props = outputType.getProperties();
      if (props.length > 0 && props.length < 10) {
        console.log('\n   Properties:');
        for (const p of props) {
          const pType = checker.getTypeOfSymbol(p);
          const optional = p.flags & ts.SymbolFlags.Optional ? '?' : '';
          console.log(`     ${p.name}${optional}: ${checker.typeToString(pType)}`);
        }
      }
    }
  } else {
    console.log('\n❌ Could not extract output type');
  }
}

// Run tests
console.log('🔬 Schema Output Type Extraction - Strategy Testing\n');

// ArkType - should work directly
testStrategy('ArkType UserSchema', 'arktype-basic.ts', 'UserSchema', extractArkTypeOutput);
testStrategy(
  'ArkType StringArraySchema',
  'arktype-basic.ts',
  'StringArraySchema',
  extractArkTypeOutput,
);
testStrategy('ArkType StatusSchema', 'arktype-basic.ts', 'StatusSchema', extractArkTypeOutput);

// Valibot - should work via ~types.output
testStrategy('Valibot UserSchema', 'valibot-basic.ts', 'UserSchema', extractValibotOutput);
testStrategy(
  'Valibot StringArraySchema',
  'valibot-basic.ts',
  'StringArraySchema',
  extractValibotOutput,
);

// Zod - try _output property
testStrategy('Zod UserSchema', 'zod-basic.ts', 'UserSchema', extractZodOutput);
testStrategy('Zod StringArraySchema', 'zod-basic.ts', 'StringArraySchema', extractZodOutput);

// TypeBox - try static property
testStrategy('TypeBox UserSchema', 'typebox-basic.ts', 'UserSchema', extractTypeBoxOutput);
testStrategy(
  'TypeBox StringArraySchema',
  'typebox-basic.ts',
  'StringArraySchema',
  extractTypeBoxOutput,
);

// Additional exploration for problematic libraries
console.log('\n\n📊 ADDITIONAL EXPLORATION');
console.log('='.repeat(60));

// Let's look at all properties for Zod and TypeBox to find the output type
const zodFile = path.join(FIXTURES_DIR, 'zod-basic.ts');
const { checker: zodChecker, sourceFile: zodSource } = createProgram(zodFile);
if (zodSource) {
  const zodType = getExportType(zodChecker, zodSource, 'UserSchema');
  if (zodType) {
    console.log('\nZod UserSchema - All Properties:');
    const props = zodType.getProperties();
    for (const prop of props) {
      const propType = zodChecker.getTypeOfSymbol(prop);
      const typeStr = zodChecker.typeToString(propType, undefined, ts.TypeFormatFlags.NoTruncation);
      // Highlight properties that look promising
      if (
        prop.name.includes('output') ||
        prop.name.includes('type') ||
        prop.name.includes('infer') ||
        prop.name === '_type' ||
        prop.name === '_output'
      ) {
        console.log(`  ⭐ ${prop.name}: ${typeStr.substring(0, 150)}`);
      }
    }
  }
}

const typeboxFile = path.join(FIXTURES_DIR, 'typebox-basic.ts');
const { checker: tbChecker, sourceFile: tbSource } = createProgram(typeboxFile);
if (tbSource) {
  const tbType = getExportType(tbChecker, tbSource, 'UserSchema');
  if (tbType) {
    console.log('\nTypeBox UserSchema - All Properties:');
    const props = tbType.getProperties();
    for (const prop of props) {
      const propType = tbChecker.getTypeOfSymbol(prop);
      const typeStr = tbChecker.typeToString(propType, undefined, ts.TypeFormatFlags.NoTruncation);
      // Highlight properties that look promising
      if (
        prop.name.includes('static') ||
        prop.name.includes('type') ||
        prop.name.includes('Type') ||
        prop.name === 'static'
      ) {
        console.log(`  ⭐ ${prop.name}: ${typeStr.substring(0, 150)}`);
      }
    }
  }
}
