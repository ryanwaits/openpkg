import { describe, expect, it } from 'bun:test';
import * as ts from 'typescript';
import { formatTypeReference } from '../src/utils/parameter-utils';
import { createTestCompiler, getDeclaration } from './test-helpers';

describe('formatTypeReference', () => {
  it('returns primitive schema for basic types', () => {
    const { checker, sourceFile } = createTestCompiler(`const value: string = 'hello';`);
    const variableStatement = getDeclaration(sourceFile, ts.isVariableStatement);
    const declaration = variableStatement.declarationList.declarations[0];
    const type = checker.getTypeAtLocation(declaration.name);

    const result = formatTypeReference(type, checker, new Map());

    expect(result).toEqual({ type: 'string' });
  });

  it('returns $ref for known referenced types', () => {
    const { checker, sourceFile } = createTestCompiler(`
      interface User { id: string }
      const current: User = { id: '1' };
    `);
    const variableStatement = getDeclaration(sourceFile, (node): node is ts.VariableStatement =>
      ts.isVariableStatement(node) && node.declarationList.declarations[0].name.getText() === 'current',
    );
    const declaration = variableStatement.declarationList.declarations[0];
    const typeNode = declaration.type as ts.TypeNode;
    const type = checker.getTypeFromTypeNode(typeNode);

    const typeRefs = new Map<string, string>([['User', 'User']]);
    const result = formatTypeReference(type, checker, typeRefs);

    expect(result).toEqual({ $ref: '#/types/User' });
  });

  it('serializes union types as anyOf arrays', () => {
    const { checker, sourceFile } = createTestCompiler(`
      interface User { id: string }
      type MaybeUser = User | null;
    `);
    const maybeUser = getDeclaration(
      sourceFile,
      (node): node is ts.TypeAliasDeclaration =>
        ts.isTypeAliasDeclaration(node) && node.name.text === 'MaybeUser',
    );
    const type = checker.getTypeFromTypeNode(maybeUser.type);

    const typeRefs = new Map<string, string>([['User', 'User']]);
    const result = formatTypeReference(type, checker, typeRefs);

    expect(result).toEqual({
      anyOf: [{ type: 'null' }, { $ref: '#/types/User' }],
    });
  });

  it('extracts literal values as enums', () => {
    const { checker, sourceFile } = createTestCompiler(`const status = 'ready' as const;`);
    const variableStatement = getDeclaration(sourceFile, ts.isVariableStatement);
    const declaration = variableStatement.declarationList.declarations[0];
    const type = checker.getTypeAtLocation(declaration.name);

    const result = formatTypeReference(type, checker, new Map());

    expect(result).toEqual({ enum: ['ready'] });
  });
});
