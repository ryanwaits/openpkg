import type { SpecTypeParameter } from '@openpkg-ts/spec';
import type * as TS from 'typescript';

import { collectReferencedTypesFromNode } from './type-utils';

export function serializeTypeParameterDeclarations(
  typeParameters: TS.NodeArray<TS.TypeParameterDeclaration> | undefined,
  checker: TS.TypeChecker,
  referencedTypes: Set<string>,
): SpecTypeParameter[] | undefined {
  if (!typeParameters || typeParameters.length === 0) {
    return undefined;
  }

  const serialized: SpecTypeParameter[] = [];
  for (const typeParam of typeParameters) {
    const name = typeParam.name?.getText().trim();
    if (!name) {
      continue;
    }

    let constraint: string | undefined;
    if (typeParam.constraint) {
      collectReferencedTypesFromNode(typeParam.constraint, checker, referencedTypes);
      constraint = typeParam.constraint.getText().trim();
    }

    let defaultType: string | undefined;
    if (typeParam.default) {
      collectReferencedTypesFromNode(typeParam.default, checker, referencedTypes);
      defaultType = typeParam.default.getText().trim();
    }

    serialized.push({
      name,
      ...(constraint ? { constraint } : {}),
      ...(defaultType ? { default: defaultType } : {}),
    });
  }

  return serialized.length > 0 ? serialized : undefined;
}
