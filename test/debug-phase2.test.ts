import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { createCompilerAPIService } from '../src/services/compiler-api';
import { CompilerAPITypeResolver } from '../src/services/type-resolver-compiler';
import { EnhancedTypeResolution } from '../src/services/type-resolution-enhanced';

const testDir = path.join(__dirname, 'temp-debug');
const ensureTestDir = () => {
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
};

const cleanupTestDir = () => {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true });
  }
};

describe('Debug Phase 2 Tests', () => {
  test('debug custom mapped type readonly', () => {
    ensureTestDir();
    
    const testFile = path.join(testDir, 'mapped.ts');
    fs.writeFileSync(testFile, `
      type Readonly<T> = {
        readonly [P in keyof T]: T[P];
      };
      
      interface User {
        name: string;
        age: number;
      }
      
      export type ReadonlyUser = Readonly<User>;
    `);

    const service = createCompilerAPIService();
    const program = service.createProgram([testFile]);
    const typeChecker = service.getTypeChecker();
    const enhanced = new EnhancedTypeResolution(typeChecker);
    const sourceFile = program.getSourceFile(testFile)!;
    
    const typeAlias = sourceFile.statements.find(
      stmt => ts.isTypeAliasDeclaration(stmt) && stmt.name.text === 'ReadonlyUser'
    ) as ts.TypeAliasDeclaration;

    const type = typeChecker.getTypeAtLocation(typeAlias);
    const properties = enhanced.resolveMappedType(type);
    
    console.log('\n=== Mapped Type Debug ===');
    console.log('Type string:', typeChecker.typeToString(type));
    console.log('Type flags:', type.flags);
    console.log('Object flags:', (type as any).objectFlags);
    console.log('Is mapped type:', enhanced.isMappedType(type));
    console.log('\nProperties:');
    properties.forEach(prop => {
      console.log(`- ${prop.name}: readonly=${prop.readonly}`);
      
      // Deep inspection of property
      const symbol = type.getProperty(prop.name);
      if (symbol) {
        console.log(`  Symbol flags: ${symbol.flags}`);
        console.log(`  CheckFlags: ${(symbol as any).checkFlags}`);
        if (symbol.valueDeclaration) {
          console.log(`  Modifiers: ${ts.getCombinedModifierFlags(symbol.valueDeclaration as ts.Declaration)}`);
        }
      }
    });
    
    cleanupTestDir();
  });

  test('debug nested array type', () => {
    ensureTestDir();
    
    const testFile = path.join(testDir, 'nested.ts');
    fs.writeFileSync(testFile, `
      export type NestedArray = Array<Array<string>>;
    `);

    const service = createCompilerAPIService();
    const program = service.createProgram([testFile]);
    const typeChecker = service.getTypeChecker();
    const resolver = new CompilerAPITypeResolver(typeChecker);
    const sourceFile = program.getSourceFile(testFile)!;
    
    const typeAlias = sourceFile.statements.find(
      stmt => ts.isTypeAliasDeclaration(stmt) && stmt.name.text === 'NestedArray'
    ) as ts.TypeAliasDeclaration;

    const type = typeChecker.getTypeAtLocation(typeAlias);
    const resolved = resolver.resolveType(typeAlias);
    
    console.log('\n=== Nested Array Debug ===');
    console.log('Type string:', typeChecker.typeToString(type));
    console.log('Resolved:', JSON.stringify(resolved, null, 2));
    
    // Check element type
    if (resolved.elementType) {
      console.log('\nElement type:');
      console.log('- Type string:', resolved.elementType.typeString);
      console.log('- Is array:', resolved.elementType.isArray);
      console.log('- Is generic:', resolved.elementType.isGeneric);
    }
    
    // Direct type inspection
    console.log('\nDirect type inspection:');
    if ((type as any).typeArguments) {
      const firstArg = (type as any).typeArguments[0];
      console.log('First type argument:', typeChecker.typeToString(firstArg));
      console.log('First arg is array:', resolver['isArrayType'](firstArg));
    }
    
    cleanupTestDir();
  });
});