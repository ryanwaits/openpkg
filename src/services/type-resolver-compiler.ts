import * as ts from 'typescript';
import { BaseTypeResolver, ResolvedType, PropertyInfo, ExpandedType, FunctionSignatureInfo, ParameterInfo } from './type-resolver';
import { EnhancedTypeResolution } from './type-resolution-enhanced';

export class CompilerAPITypeResolver extends BaseTypeResolver {
  private enhanced: EnhancedTypeResolution;

  constructor(private typeChecker: ts.TypeChecker) {
    super();
    this.enhanced = new EnhancedTypeResolution(typeChecker);
  }

  resolveType(node: ts.Node): ResolvedType {
    this.clearVisitedTypes();
    const type = this.typeChecker.getTypeAtLocation(node);
    
    // For type aliases that are utility types, use the resolved type directly
    if (ts.isTypeAliasDeclaration(node) && type.aliasSymbol && this.enhanced.isUtilityType(type)) {
      // The type is already resolved for utility types like Partial<User>
      return this.resolveTypeInternal(type, 0);
    }
    
    // For other type aliases, check if we need to resolve the aliased type
    if (ts.isTypeAliasDeclaration(node)) {
      const aliasSymbol = type.aliasSymbol;
      if (aliasSymbol && aliasSymbol.declarations && aliasSymbol.declarations.length > 0) {
        const aliasDecl = aliasSymbol.declarations[0] as ts.TypeAliasDeclaration;
        if (aliasDecl.type) {
          // Get the actual type, not the alias
          const actualType = this.typeChecker.getTypeFromTypeNode(aliasDecl.type);
          return this.resolveTypeInternal(actualType, 0);
        }
      }
    }
    
    return this.resolveTypeInternal(type, 0);
  }

  private resolveTypeInternal(type: ts.Type, depth: number): ResolvedType {
    if (depth > this.maxDepth) {
      return this.createPrimitiveType('...');
    }
    
    // Skip cycle detection for now - it's causing issues with generic types
    // if (this.detectCycle(type)) {
    //   return this.createPrimitiveType('...');
    // }
    
    const typeString = this.typeChecker.typeToString(type);

    // Check for primitive types
    if (this.isPrimitiveType(typeString)) {
      return this.createPrimitiveType(typeString);
    }

    // Check for utility types and expand them
    if (this.enhanced.isUtilityType(type)) {
      // For utility types like Partial<T>, get the properties directly
      const properties = this.getProperties(type);
      return {
        typeString,
        isGeneric: true,
        genericArguments: this.getTypeArguments(type).map(arg => this.resolveTypeInternal(arg, depth + 1)),
        isUnion: false,
        isIntersection: false,
        isArray: false,
        isPrimitive: false,
        isObject: true,
        isFunction: false,
        properties
      };
    }

    // Check for mapped types
    if (this.enhanced.isMappedType(type)) {
      const properties = this.enhanced.resolveMappedType(type);
      return {
        typeString,
        isGeneric: false,
        isUnion: false,
        isIntersection: false,
        isArray: false,
        isPrimitive: false,
        isObject: true,
        isFunction: false,
        properties
      };
    }

    // Check for conditional types
    if (this.enhanced.isConditionalType(type)) {
      return this.enhanced.resolveConditionalType(type);
    }

    // Check for tuple types
    if (this.enhanced.isTupleType(type)) {
      const elements = this.enhanced.getTupleElements(type);
      return {
        typeString,
        isGeneric: false,
        isUnion: false,
        isIntersection: false,
        isArray: true, // Tuples are array-like
        isPrimitive: false,
        isObject: false,
        isFunction: false,
        genericArguments: elements.map(el => this.resolveTypeInternal(el, depth + 1))
      };
    }

    // Check for Promise types
    if (this.enhanced.isPromiseType(type)) {
      const resolvedType = this.enhanced.getPromiseResolvedType(type);
      return {
        typeString,
        isGeneric: true,
        genericArguments: resolvedType ? [this.resolveTypeInternal(resolvedType, depth + 1)] : [],
        isUnion: false,
        isIntersection: false,
        isArray: false,
        isPrimitive: false,
        isObject: true,
        isFunction: false
      };
    }

    // Check for array types
    if (this.isArrayType(type)) {
      const elementType = this.getArrayElementType(type);
      const elementTypeString = elementType ? this.typeChecker.typeToString(elementType) : 'unknown';
      return {
        typeString: typeString.includes('[]') ? typeString : `Array<${elementTypeString}>`,
        isGeneric: true,
        isUnion: false,
        isIntersection: false,
        isArray: true,
        elementType: elementType ? this.resolveTypeInternal(elementType, depth + 1) : undefined,
        isPrimitive: false,
        isObject: false,
        isFunction: false
      };
    }

    // Check for union types
    if (type.isUnion()) {
      const unionTypes = (type as ts.UnionType).types.map(t => 
        this.resolveTypeInternal(t, depth + 1)
      );
      return {
        typeString,
        isGeneric: false,
        isUnion: true,
        unionTypes,
        isIntersection: false,
        isArray: false,
        isPrimitive: false,
        isObject: false,
        isFunction: false
      };
    }

    // Check for intersection types
    if (type.isIntersection()) {
      const intersectionTypes = (type as ts.IntersectionType).types.map(t => 
        this.resolveTypeInternal(t, depth + 1)
      );
      return {
        typeString,
        isGeneric: false,
        isUnion: false,
        isIntersection: true,
        intersectionTypes,
        isArray: false,
        isPrimitive: false,
        isObject: false,
        isFunction: false
      };
    }

    // Check for function types
    const callSignatures = type.getCallSignatures();
    if (callSignatures.length > 0) {
      const signature = callSignatures[0];
      return {
        typeString,
        isGeneric: false,
        isUnion: false,
        isIntersection: false,
        isArray: false,
        isPrimitive: false,
        isObject: false,
        isFunction: true,
        functionSignature: this.resolveFunctionSignature(signature, depth + 1)
      };
    }

    // Check for generic types
    const typeArguments = this.getTypeArguments(type);
    if (typeArguments.length > 0) {
      const genericArguments = typeArguments.map(arg => 
        this.resolveTypeInternal(arg, depth + 1)
      );
      return {
        typeString,
        isGeneric: true,
        genericArguments,
        isUnion: false,
        isIntersection: false,
        isArray: false,
        isPrimitive: false,
        isObject: true,
        isFunction: false,
        properties: this.getProperties(type)
      };
    }

    // Default to object type
    const properties = this.getProperties(type);
    return {
      typeString,
      isGeneric: false,
      isUnion: false,
      isIntersection: false,
      isArray: false,
      isPrimitive: false,
      isObject: properties.length > 0,
      isFunction: false,
      properties: properties.length > 0 ? properties : undefined
    };
  }

  private resolveFunctionSignature(signature: ts.Signature, depth: number): FunctionSignatureInfo {
    const parameters = signature.getParameters().map(param => {
      const paramType = this.typeChecker.getTypeOfSymbolAtLocation(param, param.valueDeclaration!);
      const paramDecl = param.valueDeclaration as ts.ParameterDeclaration | undefined;
      
      return {
        name: param.getName(),
        type: this.resolveTypeInternal(paramType, depth),
        optional: !!(param.flags & ts.SymbolFlags.Optional) || !!(paramDecl?.questionToken),
        description: ts.displayPartsToString(param.getDocumentationComment(this.typeChecker)),
        defaultValue: paramDecl?.initializer ? paramDecl.initializer.getText() : undefined
      } as ParameterInfo;
    });

    const returnType = signature.getReturnType();
    const typeParameters = signature.getTypeParameters()?.map(tp => tp.symbol.getName());

    return {
      parameters,
      returnType: this.resolveTypeInternal(returnType, depth),
      typeParameters
    };
  }

  getProperties(type: ts.Type): PropertyInfo[] {
    // For types with properties, get them directly
    const properties = type.getProperties();
    
    if (properties.length === 0) {
      // Fallback to enhanced resolution
      return this.enhanced.getAllProperties(type);
    }
    
    // Convert properties to PropertyInfo
    return properties.map(prop => {
      const propType = this.typeChecker.getTypeOfSymbolAtLocation(prop, prop.valueDeclaration!);
      const modifiers = prop.valueDeclaration ? ts.getCombinedModifierFlags(prop.valueDeclaration as ts.Declaration) : 0;
      
      let visibility: 'public' | 'private' | 'protected' = 'public';
      if (modifiers & ts.ModifierFlags.Private) visibility = 'private';
      else if (modifiers & ts.ModifierFlags.Protected) visibility = 'protected';

      return {
        name: prop.getName(),
        type: this.resolveTypeInternal(propType, 0),
        optional: !!(prop.flags & ts.SymbolFlags.Optional),
        readonly: !!(modifiers & ts.ModifierFlags.Readonly),
        description: ts.displayPartsToString(prop.getDocumentationComment(this.typeChecker)),
        visibility
      };
    });
  }

  expandGeneric(type: ts.Type): ExpandedType {
    this.clearVisitedTypes();
    
    // Use typeToTypeNode for full expansion
    const expandedNode = this.typeChecker.typeToTypeNode(
      type,
      undefined,
      ts.NodeBuilderFlags.NoTruncation | ts.NodeBuilderFlags.InTypeAlias
    );

    const originalString = this.typeChecker.typeToString(type);
    const expanded = this.resolveTypeInternal(type, 0);

    return {
      original: originalString,
      expanded,
      depth: this.calculateDepth(expanded)
    };
  }

  private calculateDepth(type: ResolvedType, currentDepth = 0): number {
    if (currentDepth > this.maxDepth) return currentDepth;

    let maxDepth = currentDepth;

    if (type.properties) {
      for (const prop of type.properties) {
        maxDepth = Math.max(maxDepth, this.calculateDepth(prop.type, currentDepth + 1));
      }
    }

    if (type.genericArguments) {
      for (const arg of type.genericArguments) {
        maxDepth = Math.max(maxDepth, this.calculateDepth(arg, currentDepth + 1));
      }
    }

    if (type.unionTypes) {
      for (const unionType of type.unionTypes) {
        maxDepth = Math.max(maxDepth, this.calculateDepth(unionType, currentDepth + 1));
      }
    }

    if (type.elementType) {
      maxDepth = Math.max(maxDepth, this.calculateDepth(type.elementType, currentDepth + 1));
    }

    return maxDepth;
  }

  resolveImportedType(typeName: string, sourceFile: ts.SourceFile): ResolvedType | null {
    // Find the symbol in the source file
    const symbol = this.findSymbolInSourceFile(typeName, sourceFile);
    if (!symbol) return null;

    const type = this.typeChecker.getTypeOfSymbolAtLocation(symbol, sourceFile);
    return this.resolveTypeInternal(type, 0);
  }

  private findSymbolInSourceFile(name: string, sourceFile: ts.SourceFile): ts.Symbol | undefined {
    const sourceFileSymbol = this.typeChecker.getSymbolAtLocation(sourceFile);
    if (!sourceFileSymbol) return undefined;

    const exports = this.typeChecker.getExportsOfModule(sourceFileSymbol);
    return exports.find(exp => exp.getName() === name);
  }

  getTypeString(type: ts.Type): string {
    return this.typeChecker.typeToString(type);
  }

  protected getTypeId(type: ts.Type): string {
    // Use type flags and symbol name for unique identification
    const symbol = type.getSymbol();
    if (symbol) {
      return `${type.flags}_${symbol.getName()}_${symbol.flags}`;
    }
    return `${type.flags}_${this.typeChecker.typeToString(type)}`;
  }

  private isArrayType(type: ts.Type): boolean {
    // Check if it's Array<T> or T[]
    const symbol = type.getSymbol();
    if (symbol && symbol.getName() === 'Array') {
      return true;
    }

    // Check for array type reference
    if (type.flags & ts.TypeFlags.Object) {
      const objectType = type as ts.ObjectType;
      const typeReference = objectType as ts.TypeReference;
      if (typeReference.target && typeReference.target.getSymbol()?.getName() === 'Array') {
        return true;
      }
    }

    // Check for indexed type (T[])
    const numberIndexType = type.getNumberIndexType();
    if (numberIndexType) {
      return true;
    }

    // Check type string for array syntax
    const typeString = this.typeChecker.typeToString(type);
    return typeString.endsWith('[]') || typeString.startsWith('Array<');
  }

  private getArrayElementType(type: ts.Type): ts.Type | undefined {
    // Get type arguments for Array<T>
    const typeArguments = this.getTypeArguments(type);
    if (typeArguments.length > 0) {
      return typeArguments[0];
    }

    // Check indexed access type for T[]
    const numberIndexType = type.getNumberIndexType();
    if (numberIndexType) {
      return numberIndexType;
    }

    return undefined;
  }

  private getTypeArguments(type: ts.Type): ts.Type[] {
    if (type.flags & ts.TypeFlags.Object) {
      const objectType = type as ts.ObjectType;
      const typeReference = objectType as ts.TypeReference;
      if (typeReference.typeArguments) {
        return Array.from(typeReference.typeArguments);
      }
    }
    return [];
  }
}