/**
 * Spike: Fix Valibot Output Type Extraction
 *
 * The ~types property exists but we're not accessing it correctly.
 * Let's debug this.
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

const filePath = path.join(FIXTURES_DIR, 'valibot-basic.ts');
const { checker, sourceFile } = createProgram(filePath);

if (!sourceFile) {
  console.log('Could not load source file');
  process.exit(1);
}

const type = getExportType(checker, sourceFile, 'UserSchema');
if (!type) {
  console.log('Could not find export');
  process.exit(1);
}

console.log('Exploring Valibot UserSchema properties:\n');

const props = type.getProperties();
for (const prop of props) {
  const escapedName = prop.escapedName;
  const name = prop.name;

  console.log(`Property: "${name}" (escaped: "${String(escapedName)}")`);

  // Try to access properties that might contain the output type
  if (name.includes('types') || name.includes('~') || name === '~types') {
    const propType = checker.getTypeOfSymbol(prop);
    console.log(
      `  Full type: ${checker.typeToString(propType, undefined, ts.TypeFormatFlags.NoTruncation)}`,
    );

    // Check if this has 'output' property
    const outputProp = propType.getProperty('output');
    if (outputProp) {
      const outputType = checker.getTypeOfSymbol(outputProp);
      console.log(`  ✅ output: ${checker.typeToString(outputType)}`);
    }

    const inputProp = propType.getProperty('input');
    if (inputProp) {
      const inputType = checker.getTypeOfSymbol(inputProp);
      console.log(`  ✅ input: ${checker.typeToString(inputType)}`);
    }
  }
}

// Try direct access with escaped name
console.log('\n\nDirect property access attempts:');

// Method 1: getProperty with exact name
const typesSymbol1 = type.getProperty('~types');
console.log(`getProperty('~types'): ${typesSymbol1 ? 'FOUND' : 'NOT FOUND'}`);

// Method 2: Find by iterating
const typesSymbol2 = props.find((p) => p.name === '~types');
console.log(`find by name '~types': ${typesSymbol2 ? 'FOUND' : 'NOT FOUND'}`);

// Method 3: Look for any property containing 'types'
const typesSymbol3 = props.find((p) => p.name.includes('types'));
console.log(
  `find containing 'types': ${typesSymbol3 ? `FOUND (name: ${typesSymbol3.name})` : 'NOT FOUND'}`,
);

// If we found it, extract the output
if (typesSymbol3) {
  const typesType = checker.getTypeOfSymbol(typesSymbol3);
  const outputSymbol = typesType.getProperty('output');

  if (outputSymbol) {
    const outputType = checker.getTypeOfSymbol(outputSymbol);
    console.log(`\n✅ EXTRACTED OUTPUT TYPE: ${checker.typeToString(outputType)}`);

    // Show properties
    const outputProps = outputType.getProperties();
    console.log('\nProperties:');
    for (const p of outputProps) {
      const pType = checker.getTypeOfSymbol(p);
      console.log(`  ${p.name}: ${checker.typeToString(pType)}`);
    }
  }
}
