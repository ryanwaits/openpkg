import type ts from 'typescript';
import type { SpecSignatureParameter } from '@openpkg-ts/spec';

export function extractParameters(
  signature: ts.Signature,
  checker: ts.TypeChecker,
): SpecSignatureParameter[] {
  return signature.getParameters().map((param) => {
    const type = checker.getTypeOfSymbolAtLocation(param, param.valueDeclaration!);
    return {
      name: param.getName(),
      schema: { type: checker.typeToString(type) },
      required: !(param.flags & 16777216 /* Optional */),
    };
  });
}
