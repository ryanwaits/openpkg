import { describe, expect, it } from 'bun:test';
import * as ts from 'typescript';
import { collectReferencedTypes } from '../src/utils/type-utils';
import { createTestCompiler, getDeclaration } from './test-helpers';

describe('collectReferencedTypes', () => {
  it('collects referenced generic type arguments', () => {
    const { checker, sourceFile } = createTestCompiler(`
      interface User { id: string }
      type Result = Promise<User>;
    `);
    const typeAlias = getDeclaration(
      sourceFile,
      (node): node is ts.TypeAliasDeclaration =>
        ts.isTypeAliasDeclaration(node) && node.name.text === 'Result',
    );
    const type = checker.getTypeFromTypeNode(typeAlias.type);
    const referenced = new Set<string>();

    collectReferencedTypes(type, checker, referenced);

    expect(Array.from(referenced)).toEqual(['User']);
  });

  it('collects each branch in union types', () => {
    const { checker, sourceFile } = createTestCompiler(`
      interface Alpha { id: string }
      interface Beta { name: string }
      type Node = Alpha | Beta | null;
    `);
    const typeAlias = getDeclaration(
      sourceFile,
      (node): node is ts.TypeAliasDeclaration =>
        ts.isTypeAliasDeclaration(node) && node.name.text === 'Node',
    );
    const type = checker.getTypeFromTypeNode(typeAlias.type);
    const referenced = new Set<string>();

    collectReferencedTypes(type, checker, referenced);

    expect(new Set(referenced)).toEqual(new Set(['Alpha', 'Beta']));
  });
});
