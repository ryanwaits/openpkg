import { test } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { createCompilerAPIService } from '../src/services/compiler-api';
import { CompilerAPITypeResolver } from '../src/services/type-resolver-compiler';

test('debug Partial<T> resolution', () => {
  const testDir = path.join(__dirname, 'temp-debug-partial');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  
  const testFile = path.join(testDir, 'partial.ts');
  fs.writeFileSync(testFile, `
    interface User {
      id: string;
      name: string;
      email: string;
      age: number;
    }
    
    export type PartialUser = Partial<User>;
  `);

  const service = createCompilerAPIService();
  const program = service.createProgram([testFile]);
  const typeChecker = service.getTypeChecker();
  const resolver = new CompilerAPITypeResolver(typeChecker);
  const sourceFile = program.getSourceFile(testFile)!;
  
  const typeAlias = sourceFile.statements.find(
    stmt => ts.isTypeAliasDeclaration(stmt) && stmt.name.text === 'PartialUser'
  ) as ts.TypeAliasDeclaration;

  const type = typeChecker.getTypeAtLocation(typeAlias);
  
  console.log('\n=== Partial<User> Debug ===');
  console.log('Type string:', typeChecker.typeToString(type));
  console.log('Type flags:', type.flags);
  console.log('Object flags:', (type as any).objectFlags);
  console.log('Has alias symbol:', !!type.aliasSymbol);
  console.log('Alias name:', type.aliasSymbol?.getName());
  
  // Check properties directly
  console.log('\nDirect properties:');
  const props = type.getProperties();
  console.log('Property count:', props.length);
  props.forEach(prop => {
    console.log(`- ${prop.getName()}: optional=${!!(prop.flags & ts.SymbolFlags.Optional)}`);
  });
  
  // Check if it's being resolved properly
  const resolved = resolver.resolveType(typeAlias);
  console.log('\nResolved:', JSON.stringify(resolved, null, 2));
  
  // Try different approaches
  console.log('\n=== Alternative approaches ===');
  
  // Approach 1: Get the actual type without alias
  if (typeAlias.type) {
    const actualType = typeChecker.getTypeFromTypeNode(typeAlias.type);
    console.log('Actual type string:', typeChecker.typeToString(actualType));
    console.log('Actual type properties:', actualType.getProperties().length);
  }
  
  // Approach 2: Expand the type
  const expandedNode = typeChecker.typeToTypeNode(
    type,
    undefined,
    ts.NodeBuilderFlags.InTypeAlias
  );
  if (expandedNode) {
    console.log('Expanded node kind:', ts.SyntaxKind[expandedNode.kind]);
  }
  
  // Cleanup
  fs.rmSync(testDir, { recursive: true });
});