import * as ts from 'typescript';
import { ResolvedType, PropertyInfo } from './type-resolver';

export interface TypeStructure {
  name: string;
  kind: string;
  properties?: PropertyInfo[];
  methods?: MethodInfo[];
  extends?: string[];
  implements?: string[];
  typeParameters?: string[];
  enumMembers?: EnumMemberInfo[];
  unionMembers?: TypeStructure[];
  intersectionMembers?: TypeStructure[];
  depth: number;
}

export interface MethodInfo {
  name: string;
  parameters: ParameterStructure[];
  returnType: TypeStructure;
  visibility: 'public' | 'private' | 'protected';
  isStatic: boolean;
  isAsync: boolean;
  typeParameters?: string[];
}

export interface ParameterStructure {
  name: string;
  type: TypeStructure;
  optional: boolean;
  defaultValue?: string;
}

export interface EnumMemberInfo {
  name: string;
  value: string | number | undefined;
}

export interface TypeWalker {
  walk(type: ts.Type, depth: number): TypeStructure;
  visitNode(node: ts.Node): void;
}

export class TypeWalkerImpl implements TypeWalker {
  private visited = new Map<ts.Type, TypeStructure>();
  private maxDepth = 10;
  private typeChecker: ts.TypeChecker;

  constructor(typeChecker: ts.TypeChecker) {
    this.typeChecker = typeChecker;
  }

  walk(type: ts.Type, depth: number = 0): TypeStructure {
    // Check for cycles
    if (this.visited.has(type)) {
      return this.visited.get(type)!;
    }

    // Check max depth
    if (depth > this.maxDepth) {
      return {
        name: '...',
        kind: 'truncated',
        depth
      };
    }

    const structure = this.buildTypeStructure(type, depth);
    this.visited.set(type, structure);
    return structure;
  }

  visitNode(node: ts.Node): void {
    // Visit node and its children
    ts.forEachChild(node, child => {
      this.visitNodeInternal(child);
    });
  }

  private visitNodeInternal(node: ts.Node): void {
    // Process different node kinds
    if (ts.isInterfaceDeclaration(node)) {
      this.visitInterface(node);
    } else if (ts.isClassDeclaration(node)) {
      this.visitClass(node);
    } else if (ts.isTypeAliasDeclaration(node)) {
      this.visitTypeAlias(node);
    } else if (ts.isEnumDeclaration(node)) {
      this.visitEnum(node);
    } else if (ts.isFunctionDeclaration(node)) {
      this.visitFunction(node);
    }

    // Continue visiting children
    ts.forEachChild(node, child => {
      this.visitNodeInternal(child);
    });
  }

  private buildTypeStructure(type: ts.Type, depth: number): TypeStructure {
    const typeString = this.typeChecker.typeToString(type);
    const symbol = type.getSymbol();

    // Handle primitive types
    if (this.isPrimitive(type)) {
      return {
        name: typeString,
        kind: 'primitive',
        depth
      };
    }

    // Handle array types
    if (this.isArrayType(type)) {
      const elementType = this.getArrayElementType(type);
      return {
        name: 'Array',
        kind: 'array',
        unionMembers: elementType ? [this.walk(elementType, depth + 1)] : undefined,
        depth
      };
    }

    // Handle union types
    if (type.isUnion()) {
      return {
        name: typeString,
        kind: 'union',
        unionMembers: (type as ts.UnionType).types.map(t => this.walk(t, depth + 1)),
        depth
      };
    }

    // Handle intersection types
    if (type.isIntersection()) {
      return {
        name: typeString,
        kind: 'intersection',
        intersectionMembers: (type as ts.IntersectionType).types.map(t => this.walk(t, depth + 1)),
        depth
      };
    }

    // Handle enum types
    if (symbol && symbol.flags & ts.SymbolFlags.Enum) {
      return this.buildEnumStructure(symbol, type, depth);
    }

    // Handle class types
    if (symbol && symbol.flags & ts.SymbolFlags.Class) {
      return this.buildClassStructure(symbol, type, depth);
    }

    // Handle interface types
    if (symbol && symbol.flags & ts.SymbolFlags.Interface) {
      return this.buildInterfaceStructure(symbol, type, depth);
    }

    // Handle function types
    const callSignatures = type.getCallSignatures();
    if (callSignatures.length > 0) {
      return this.buildFunctionStructure(callSignatures[0], depth);
    }

    // Default to object type
    return this.buildObjectStructure(type, depth);
  }

  private buildClassStructure(symbol: ts.Symbol, type: ts.Type, depth: number): TypeStructure {
    const properties = this.getTypeProperties(type, depth);
    const methods = this.getTypeMethods(type, depth);
    const baseTypes = this.getBaseTypes(type);
    const typeParameters = this.getTypeParameters(symbol);

    return {
      name: symbol.getName(),
      kind: 'class',
      properties,
      methods,
      extends: baseTypes.extends,
      implements: baseTypes.implements,
      typeParameters,
      depth
    };
  }

  private buildInterfaceStructure(symbol: ts.Symbol, type: ts.Type, depth: number): TypeStructure {
    const properties = this.getTypeProperties(type, depth);
    const methods = this.getTypeMethods(type, depth);
    const baseTypes = this.getBaseTypes(type);
    const typeParameters = this.getTypeParameters(symbol);

    return {
      name: symbol.getName(),
      kind: 'interface',
      properties,
      methods,
      extends: baseTypes.extends,
      typeParameters,
      depth
    };
  }

  private buildEnumStructure(symbol: ts.Symbol, type: ts.Type, depth: number): TypeStructure {
    const enumMembers: EnumMemberInfo[] = [];
    
    if (symbol.exports) {
      symbol.exports.forEach((memberSymbol, key) => {
        const memberType = this.typeChecker.getTypeOfSymbolAtLocation(
          memberSymbol,
          memberSymbol.valueDeclaration!
        );
        const value = this.typeChecker.typeToString(memberType);
        
        enumMembers.push({
          name: key.toString(),
          value: this.parseEnumValue(value)
        });
      });
    }

    return {
      name: symbol.getName(),
      kind: 'enum',
      enumMembers,
      depth
    };
  }

  private buildFunctionStructure(signature: ts.Signature, depth: number): TypeStructure {
    const parameters = signature.getParameters().map(param => {
      const paramType = this.typeChecker.getTypeOfSymbolAtLocation(
        param,
        param.valueDeclaration!
      );
      return {
        name: param.getName(),
        type: this.walk(paramType, depth + 1),
        optional: !!(param.flags & ts.SymbolFlags.Optional)
      };
    });

    const returnType = signature.getReturnType();

    return {
      name: 'Function',
      kind: 'function',
      methods: [{
        name: 'call',
        parameters,
        returnType: this.walk(returnType, depth + 1),
        visibility: 'public',
        isStatic: false,
        isAsync: false
      }],
      depth
    };
  }

  private buildObjectStructure(type: ts.Type, depth: number): TypeStructure {
    const properties = this.getTypeProperties(type, depth);
    const methods = this.getTypeMethods(type, depth);

    return {
      name: this.typeChecker.typeToString(type),
      kind: 'object',
      properties,
      methods,
      depth
    };
  }

  private getTypeProperties(type: ts.Type, depth: number): PropertyInfo[] {
    const properties = type.getProperties();
    return properties
      .filter(prop => !(prop.flags & ts.SymbolFlags.Method))
      .map(prop => {
        const propType = this.typeChecker.getTypeOfSymbolAtLocation(
          prop,
          prop.valueDeclaration!
        );
        const modifiers = prop.valueDeclaration 
          ? ts.getCombinedModifierFlags(prop.valueDeclaration as ts.Declaration)
          : 0;

        return {
          name: prop.getName(),
          type: this.buildTypeStructure(propType, depth + 1) as ResolvedType,
          optional: !!(prop.flags & ts.SymbolFlags.Optional),
          readonly: !!(modifiers & ts.ModifierFlags.Readonly),
          description: ts.displayPartsToString(prop.getDocumentationComment(this.typeChecker))
        };
      });
  }

  private getTypeMethods(type: ts.Type, depth: number): MethodInfo[] {
    const properties = type.getProperties();
    return properties
      .filter(prop => !!(prop.flags & ts.SymbolFlags.Method))
      .map(prop => {
        const signatures = this.typeChecker.getSignaturesOfType(
          this.typeChecker.getTypeOfSymbolAtLocation(prop, prop.valueDeclaration!),
          ts.SignatureKind.Call
        );

        if (signatures.length === 0) {
          return null;
        }

        const signature = signatures[0];
        const modifiers = prop.valueDeclaration
          ? ts.getCombinedModifierFlags(prop.valueDeclaration as ts.Declaration)
          : 0;

        let visibility: 'public' | 'private' | 'protected' = 'public';
        if (modifiers & ts.ModifierFlags.Private) visibility = 'private';
        else if (modifiers & ts.ModifierFlags.Protected) visibility = 'protected';

        return {
          name: prop.getName(),
          parameters: signature.getParameters().map(param => ({
            name: param.getName(),
            type: this.walk(
              this.typeChecker.getTypeOfSymbolAtLocation(param, param.valueDeclaration!),
              depth + 1
            ),
            optional: !!(param.flags & ts.SymbolFlags.Optional)
          })),
          returnType: this.walk(signature.getReturnType(), depth + 1),
          visibility,
          isStatic: !!(modifiers & ts.ModifierFlags.Static),
          isAsync: !!(modifiers & ts.ModifierFlags.Async),
          typeParameters: signature.getTypeParameters()?.map(tp => tp.symbol.getName())
        };
      })
      .filter((method): method is MethodInfo => method !== null);
  }

  private getBaseTypes(type: ts.Type): { extends?: string[], implements?: string[] } {
    const result: { extends?: string[], implements?: string[] } = {};
    const symbol = type.getSymbol();

    if (!symbol || !symbol.declarations || symbol.declarations.length === 0) {
      return result;
    }

    const declaration = symbol.declarations[0];

    if (ts.isClassDeclaration(declaration)) {
      // Get extends clause
      if (declaration.heritageClauses) {
        for (const clause of declaration.heritageClauses) {
          if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
            result.extends = clause.types.map(t => t.expression.getText());
          } else if (clause.token === ts.SyntaxKind.ImplementsKeyword) {
            result.implements = clause.types.map(t => t.expression.getText());
          }
        }
      }
    } else if (ts.isInterfaceDeclaration(declaration)) {
      // Interfaces only extend
      if (declaration.heritageClauses) {
        for (const clause of declaration.heritageClauses) {
          if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
            result.extends = clause.types.map(t => t.expression.getText());
          }
        }
      }
    }

    return result;
  }

  private getTypeParameters(symbol: ts.Symbol): string[] | undefined {
    if (!symbol.declarations || symbol.declarations.length === 0) {
      return undefined;
    }

    const declaration = symbol.declarations[0];
    
    if ((ts.isClassDeclaration(declaration) || 
         ts.isInterfaceDeclaration(declaration) || 
         ts.isTypeAliasDeclaration(declaration)) && 
        declaration.typeParameters) {
      return declaration.typeParameters.map(tp => tp.name.getText());
    }

    return undefined;
  }

  private visitInterface(node: ts.InterfaceDeclaration): void {
    // Process interface declaration
    const type = this.typeChecker.getTypeAtLocation(node);
    this.walk(type, 0);
  }

  private visitClass(node: ts.ClassDeclaration): void {
    // Process class declaration
    const type = this.typeChecker.getTypeAtLocation(node);
    this.walk(type, 0);
  }

  private visitTypeAlias(node: ts.TypeAliasDeclaration): void {
    // Process type alias
    const type = this.typeChecker.getTypeAtLocation(node);
    this.walk(type, 0);
  }

  private visitEnum(node: ts.EnumDeclaration): void {
    // Process enum
    const type = this.typeChecker.getTypeAtLocation(node);
    this.walk(type, 0);
  }

  private visitFunction(node: ts.FunctionDeclaration): void {
    // Process function
    const type = this.typeChecker.getTypeAtLocation(node);
    this.walk(type, 0);
  }

  private isPrimitive(type: ts.Type): boolean {
    const flags = type.flags;
    return !!(flags & (
      ts.TypeFlags.String |
      ts.TypeFlags.Number |
      ts.TypeFlags.Boolean |
      ts.TypeFlags.Null |
      ts.TypeFlags.Undefined |
      ts.TypeFlags.Void |
      ts.TypeFlags.Any |
      ts.TypeFlags.Unknown |
      ts.TypeFlags.Never |
      ts.TypeFlags.BigInt |
      ts.TypeFlags.ESSymbol
    ));
  }

  private isArrayType(type: ts.Type): boolean {
    const symbol = type.getSymbol();
    if (symbol && symbol.getName() === 'Array') {
      return true;
    }

    if (type.flags & ts.TypeFlags.Object) {
      const objectType = type as ts.ObjectType;
      const typeReference = objectType as ts.TypeReference;
      if (typeReference.target && typeReference.target.getSymbol()?.getName() === 'Array') {
        return true;
      }
    }

    return !!type.getNumberIndexType();
  }

  private getArrayElementType(type: ts.Type): ts.Type | undefined {
    if (type.flags & ts.TypeFlags.Object) {
      const objectType = type as ts.ObjectType;
      const typeReference = objectType as ts.TypeReference;
      if (typeReference.typeArguments && typeReference.typeArguments.length > 0) {
        return typeReference.typeArguments[0];
      }
    }

    return type.getNumberIndexType();
  }

  private parseEnumValue(value: string): string | number | undefined {
    if (value === 'undefined') return undefined;
    const num = Number(value);
    return isNaN(num) ? value : num;
  }

  // Clear visited types for a new walk
  clearVisited(): void {
    this.visited.clear();
  }
}