/**
 * Spike Script: Schema Type Extraction Research
 *
 * Goal: Understand how TypeScript Compiler API exposes types from
 * Zod, Valibot, TypeBox, and ArkType schema libraries.
 *
 * Run with: bun packages/sdk/scripts/spike-schema-extraction.ts
 */
import * as path from 'node:path';
import ts from 'typescript';

const FIXTURES_DIR = path.join(import.meta.dir, '../src/__fixtures__/schema-libs');

interface ExportInfo {
  name: string;
  typeString: string;
  typeFlags: string[];
  isTypeReference: boolean;
  typeArguments?: string[];
  symbol?: string;
}

function getTypeFlags(flags: ts.TypeFlags): string[] {
  const result: string[] = [];
  for (const [key, value] of Object.entries(ts.TypeFlags)) {
    if (typeof value === 'number' && (flags & value) !== 0) {
      result.push(key);
    }
  }
  return result;
}

function analyzeFile(filePath: string): ExportInfo[] {
  const configPath = ts.findConfigFile(FIXTURES_DIR, ts.sys.fileExists, 'tsconfig.json');

  let compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.Latest,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
  };

  if (configPath) {
    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    const parsed = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      path.dirname(configPath),
    );
    compilerOptions = { ...compilerOptions, ...parsed.options };
  }

  const program = ts.createProgram([filePath], compilerOptions);
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(filePath);

  if (!sourceFile) {
    console.error(`Could not load source file: ${filePath}`);
    return [];
  }

  const exports: ExportInfo[] = [];
  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);

  if (!moduleSymbol) {
    console.error(`Could not get module symbol for: ${filePath}`);
    return [];
  }

  const exportedSymbols = checker.getExportsOfModule(moduleSymbol);

  for (const symbol of exportedSymbols) {
    // Skip type-only exports (type aliases, interfaces)
    const declarations = symbol.getDeclarations();
    if (!declarations || declarations.length === 0) continue;

    const firstDecl = declarations[0];
    if (ts.isTypeAliasDeclaration(firstDecl) || ts.isInterfaceDeclaration(firstDecl)) {
      continue; // Skip type exports, we want runtime values
    }

    const type = checker.getTypeOfSymbol(symbol);
    const typeString = checker.typeToString(type, undefined, ts.TypeFormatFlags.NoTruncation);
    const flags = getTypeFlags(type.flags);

    const isTypeRef =
      !!(type.flags & ts.TypeFlags.Object) &&
      !!(type as ts.ObjectType).objectFlags &&
      !!((type as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference);

    let typeArgs: string[] | undefined;
    if (isTypeRef) {
      const typeRef = type as ts.TypeReference;
      const args = checker.getTypeArguments(typeRef);
      if (args && args.length > 0) {
        typeArgs = args.map(
          (arg, i) =>
            `[${i}] ${checker.typeToString(arg, undefined, ts.TypeFormatFlags.NoTruncation)}`,
        );
      }
    }

    exports.push({
      name: symbol.name,
      typeString,
      typeFlags: flags,
      isTypeReference: isTypeRef,
      typeArguments: typeArgs,
      symbol: symbol.valueDeclaration ? ts.SyntaxKind[symbol.valueDeclaration.kind] : undefined,
    });
  }

  return exports;
}

function printExports(title: string, exports: ExportInfo[]): void {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📦 ${title}`);
  console.log('='.repeat(80));

  for (const exp of exports) {
    console.log(`\n🔹 ${exp.name}`);
    console.log(
      `   Type: ${exp.typeString.substring(0, 200)}${exp.typeString.length > 200 ? '...' : ''}`,
    );
    console.log(`   Flags: ${exp.typeFlags.join(', ')}`);
    console.log(`   Is TypeReference: ${exp.isTypeReference}`);
    if (exp.typeArguments) {
      console.log(`   Type Arguments:`);
      for (const arg of exp.typeArguments) {
        console.log(`     ${arg.substring(0, 150)}${arg.length > 150 ? '...' : ''}`);
      }
    }
  }
}

// Deeper analysis for specific schema patterns
function analyzeSchemaPattern(filePath: string, exportName: string): void {
  const _configPath = ts.findConfigFile(FIXTURES_DIR, ts.sys.fileExists, 'tsconfig.json');

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

  if (!sourceFile) return;

  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
  if (!moduleSymbol) return;

  const exportedSymbols = checker.getExportsOfModule(moduleSymbol);
  const symbol = exportedSymbols.find((s) => s.name === exportName);

  if (!symbol) {
    console.log(`Export ${exportName} not found`);
    return;
  }

  const type = checker.getTypeOfSymbol(symbol);

  console.log(`\n${'-'.repeat(60)}`);
  console.log(`Deep Analysis: ${exportName}`);
  console.log('-'.repeat(60));

  // Full type string
  console.log('\nFull Type String:');
  console.log(
    checker.typeToString(
      type,
      undefined,
      ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.MultilineObjectLiterals,
    ),
  );

  // Check if it's an object type with call signatures
  if (type.flags & ts.TypeFlags.Object) {
    const objType = type as ts.ObjectType;
    console.log(
      '\nObject Flags:',
      Object.entries(ts.ObjectFlags)
        .filter(([_, v]) => typeof v === 'number' && (objType.objectFlags & v) !== 0)
        .map(([k]) => k)
        .join(', '),
    );

    // Get properties
    const props = type.getProperties();
    if (props.length > 0 && props.length < 20) {
      console.log('\nProperties:');
      for (const prop of props.slice(0, 10)) {
        const propType = checker.getTypeOfSymbol(prop);
        console.log(`  ${prop.name}: ${checker.typeToString(propType).substring(0, 100)}`);
      }
    }

    // If it's a reference, get type arguments
    if (objType.objectFlags & ts.ObjectFlags.Reference) {
      const typeRef = type as ts.TypeReference;
      const args = checker.getTypeArguments(typeRef);
      console.log('\nType Arguments (detailed):');
      for (let i = 0; i < args.length && i < 6; i++) {
        const arg = args[i];
        const argStr = checker.typeToString(arg, undefined, ts.TypeFormatFlags.NoTruncation);
        console.log(`  [${i}]: ${argStr.substring(0, 200)}${argStr.length > 200 ? '...' : ''}`);

        // If this arg is an object, show its properties
        if (arg.flags & ts.TypeFlags.Object) {
          const argProps = arg.getProperties();
          if (argProps.length > 0 && argProps.length < 10) {
            console.log(`       Properties of arg[${i}]:`);
            for (const p of argProps.slice(0, 5)) {
              const pType = checker.getTypeOfSymbol(p);
              console.log(`         ${p.name}: ${checker.typeToString(pType).substring(0, 80)}`);
            }
          }
        }
      }
    }

    // Get the target type (for generics)
    if ('target' in objType && objType.target) {
      const target = objType.target as ts.GenericType;
      console.log(
        '\nTarget Type:',
        checker.typeToString(target as unknown as ts.Type).substring(0, 100),
      );
    }
  }
}

// Main execution
console.log('🔬 Schema Type Extraction Research Spike');
console.log('=========================================\n');

const fixtures = [
  { file: 'zod-basic.ts', name: 'Zod Basic' },
  { file: 'valibot-basic.ts', name: 'Valibot Basic' },
  { file: 'typebox-basic.ts', name: 'TypeBox Basic' },
  { file: 'arktype-basic.ts', name: 'ArkType Basic' },
];

for (const fixture of fixtures) {
  const filePath = path.join(FIXTURES_DIR, fixture.file);
  try {
    const exports = analyzeFile(filePath);
    printExports(fixture.name, exports);
  } catch (err) {
    console.error(`Error analyzing ${fixture.file}:`, err);
  }
}

// Deep dive into specific exports to understand type argument positions
console.log('\n\n📊 DEEP ANALYSIS: Finding Output Types');
console.log('========================================');

// Zod UserSchema - we want to find { name: string; age: number; email: string }
analyzeSchemaPattern(path.join(FIXTURES_DIR, 'zod-basic.ts'), 'UserSchema');

// Valibot UserSchema
analyzeSchemaPattern(path.join(FIXTURES_DIR, 'valibot-basic.ts'), 'UserSchema');

// TypeBox UserSchema
analyzeSchemaPattern(path.join(FIXTURES_DIR, 'typebox-basic.ts'), 'UserSchema');

// ArkType UserSchema
analyzeSchemaPattern(path.join(FIXTURES_DIR, 'arktype-basic.ts'), 'UserSchema');
