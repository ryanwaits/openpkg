import * as ts from 'typescript';
import { ResolvedType, PropertyInfo } from './type-resolver';

/**
 * Enhanced type resolution utilities for TypeScript Compiler API
 */
export class EnhancedTypeResolution {
  constructor(private typeChecker: ts.TypeChecker) {}

  /**
   * Check if a type is a utility type (Partial, Required, Pick, etc.)
   */
  isUtilityType(type: ts.Type): boolean {
    // Check if it has an alias symbol (like Partial<T>)
    if (type.aliasSymbol) {
      const name = type.aliasSymbol.getName();
      const utilityTypes = [
        'Partial', 'Required', 'Readonly', 'Record', 'Pick', 'Omit',
        'Exclude', 'Extract', 'NonNullable', 'ReturnType', 'InstanceType',
        'Parameters', 'ConstructorParameters', 'ThisType'
      ];
      return utilityTypes.includes(name);
    }
    
    return false;
  }

  /**
   * Expand utility types to their resolved forms
   */
  expandUtilityType(type: ts.Type): ts.Type {
    // For utility types, the type is already resolved by TypeScript
    // We just need to return it as-is for property extraction
    return type;
  }

  /**
   * Check if a type is a mapped type
   */
  isMappedType(type: ts.Type): boolean {
    // Check if it's an object type with a mapped type pattern
    if (type.flags & ts.TypeFlags.Object) {
      const objectType = type as ts.ObjectType;
      return !!(objectType.objectFlags & ts.ObjectFlags.Mapped);
    }
    return false;
  }

  /**
   * Resolve mapped type to get all properties
   */
  resolveMappedType(type: ts.Type): PropertyInfo[] {
    const properties: PropertyInfo[] = [];
    
    // For mapped types, check if the mapped type itself adds readonly modifier
    let mappedTypeAddsReadonly = false;
    const typeNode = this.typeChecker.typeToTypeNode(type, undefined, ts.NodeBuilderFlags.InTypeAlias);
    
    if (typeNode && ts.isTypeReferenceNode(typeNode)) {
      const typeName = typeNode.typeName.getText();
      // Check if this is a Readonly<T> type or similar
      if (typeName === 'Readonly' || typeName.includes('Readonly')) {
        mappedTypeAddsReadonly = true;
      }
    }
    
    // For mapped types, get all properties including those from the constraint
    const allProperties = type.getProperties();
    
    for (const prop of allProperties) {
      const propType = this.typeChecker.getTypeOfSymbolAtLocation(
        prop,
        prop.valueDeclaration!
      );
      
      // For mapped types, check if the property is readonly
      let isReadonly = mappedTypeAddsReadonly;
      
      // Check modifiers on the property declaration
      if (prop.valueDeclaration) {
        const modifiers = ts.getCombinedModifierFlags(prop.valueDeclaration as ts.Declaration);
        if (modifiers & ts.ModifierFlags.Readonly) {
          isReadonly = true;
        }
      }
      
      // Check the mapped type definition itself
      const mappedType = type as any;
      if (mappedType.declaration && ts.isMappedTypeNode(mappedType.declaration)) {
        if (mappedType.declaration.readonlyToken) {
          isReadonly = true;
        }
      }

      properties.push({
        name: prop.getName(),
        type: this.createResolvedType(propType),
        optional: !!(prop.flags & ts.SymbolFlags.Optional),
        readonly: isReadonly,
        description: ts.displayPartsToString(prop.getDocumentationComment(this.typeChecker)),
        visibility: 'public'
      });
    }

    return properties;
  }

  /**
   * Check if a type is a conditional type
   */
  isConditionalType(type: ts.Type): boolean {
    return !!(type.flags & ts.TypeFlags.Conditional);
  }

  /**
   * Resolve conditional type
   */
  resolveConditionalType(type: ts.Type): ResolvedType {
    if (type.flags & ts.TypeFlags.Conditional) {
      const conditionalType = type as ts.ConditionalType;
      
      // Get the resolved type (true or false branch)
      const resolvedType = conditionalType.resolvedType;
      if (resolvedType) {
        return this.createResolvedType(resolvedType);
      }
    }

    return this.createResolvedType(type);
  }

  /**
   * Get inherited properties from base classes/interfaces
   */
  getInheritedProperties(type: ts.Type): PropertyInfo[] {
    const inheritedProps: PropertyInfo[] = [];
    const baseTypes = type.getBaseTypes() || [];

    for (const baseType of baseTypes) {
      const baseProps = this.getAllProperties(baseType);
      inheritedProps.push(...baseProps);
    }

    return inheritedProps;
  }

  /**
   * Get all properties including inherited ones
   */
  getAllProperties(type: ts.Type): PropertyInfo[] {
    const ownProperties = this.getOwnProperties(type);
    const inheritedProperties = this.getInheritedProperties(type);
    
    // Merge properties, with own properties overriding inherited ones
    const allProps = new Map<string, PropertyInfo>();
    
    for (const prop of inheritedProperties) {
      allProps.set(prop.name, prop);
    }
    
    for (const prop of ownProperties) {
      allProps.set(prop.name, prop);
    }
    
    return Array.from(allProps.values());
  }

  /**
   * Get only own properties (not inherited)
   */
  private getOwnProperties(type: ts.Type): PropertyInfo[] {
    const properties = type.getProperties();
    return properties
      .filter(prop => {
        // Filter out inherited properties
        const declarations = prop.getDeclarations();
        if (!declarations || declarations.length === 0) return false;
        
        const declaration = declarations[0];
        const parent = declaration.parent;
        
        // Check if the property belongs to this type
        const typeSymbol = type.getSymbol();
        if (typeSymbol && parent && ts.isClassDeclaration(parent)) {
          return parent.symbol === typeSymbol;
        }
        
        return true;
      })
      .map(prop => this.symbolToPropertyInfo(prop));
  }

  /**
   * Handle index signatures
   */
  getIndexSignatures(type: ts.Type): {
    string?: ResolvedType;
    number?: ResolvedType;
  } {
    const signatures: { string?: ResolvedType; number?: ResolvedType } = {};

    const stringIndexType = type.getStringIndexType();
    if (stringIndexType) {
      signatures.string = this.createResolvedType(stringIndexType);
    }

    const numberIndexType = type.getNumberIndexType();
    if (numberIndexType) {
      signatures.number = this.createResolvedType(numberIndexType);
    }

    return signatures;
  }

  /**
   * Extract method signatures with full parameter types
   */
  getMethodSignatures(type: ts.Type): MethodSignature[] {
    const methods: MethodSignature[] = [];
    const properties = type.getProperties();

    for (const prop of properties) {
      if (prop.flags & ts.SymbolFlags.Method) {
        const propType = this.typeChecker.getTypeOfSymbolAtLocation(
          prop,
          prop.valueDeclaration!
        );
        
        const signatures = propType.getCallSignatures();
        
        for (const signature of signatures) {
          methods.push(this.signatureToMethodSignature(prop.getName(), signature));
        }
      }
    }

    return methods;
  }

  /**
   * Check if type is a Promise type
   */
  isPromiseType(type: ts.Type): boolean {
    const symbol = type.getSymbol();
    if (!symbol) return false;
    
    const name = symbol.getName();
    return name === 'Promise' || name === 'PromiseLike';
  }

  /**
   * Get the resolved type of a Promise
   */
  getPromiseResolvedType(type: ts.Type): ts.Type | undefined {
    if (!this.isPromiseType(type)) return undefined;
    
    const typeArgs = this.getTypeArguments(type);
    return typeArgs.length > 0 ? typeArgs[0] : undefined;
  }

  /**
   * Resolve type aliases to their underlying types
   */
  resolveTypeAlias(type: ts.Type): ts.Type {
    if (type.aliasSymbol) {
      // For type aliases, we might want to get the underlying type
      const aliasedType = this.typeChecker.getTypeFromTypeNode(
        type.aliasSymbol.declarations![0] as ts.TypeAliasDeclaration
      );
      return aliasedType;
    }
    return type;
  }

  /**
   * Handle tuple types
   */
  isTupleType(type: ts.Type): boolean {
    // Check for tuple object flag
    if (type.flags & ts.TypeFlags.Object) {
      const objectType = type as ts.ObjectType;
      if (objectType.objectFlags & ts.ObjectFlags.Tuple) {
        return true;
      }
    }
    
    // Check if it's a type reference to a tuple
    const typeString = this.typeChecker.typeToString(type);
    
    // Check for tuple syntax: [type1, type2, ...]
    if (typeString.startsWith('[') && typeString.endsWith(']') && typeString.includes(',')) {
      return true;
    }
    
    // Additional check for resolved tuple types
    if ((type as any).target) {
      const target = (type as any).target;
      if (target.objectFlags & ts.ObjectFlags.Tuple) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Get tuple elements
   */
  getTupleElements(type: ts.Type): ts.Type[] {
    if (!this.isTupleType(type)) return [];
    
    // Try to get type arguments directly
    if ((type as any).typeArguments) {
      return Array.from((type as any).typeArguments);
    }
    
    // For type references, get from target
    if ((type as any).target && (type as any).target.typeArguments) {
      return Array.from((type as any).target.typeArguments);
    }
    
    // Try resolving tuple type
    if ((type as any).resolvedTypeArguments) {
      return Array.from((type as any).resolvedTypeArguments);
    }
    
    // Fallback: try to parse from type string
    const typeString = this.typeChecker.typeToString(type);
    if (typeString.startsWith('[') && typeString.endsWith(']')) {
      // This is a simplified approach - in production you'd want more robust parsing
      return [];
    }
    
    return [];
  }

  /**
   * Resolve imported types across files
   */
  resolveImportedType(importSpecifier: ts.ImportSpecifier, sourceFile: ts.SourceFile): ts.Type | undefined {
    const symbol = this.typeChecker.getSymbolAtLocation(importSpecifier.name);
    if (!symbol) return undefined;

    const aliasedSymbol = this.typeChecker.getAliasedSymbol(symbol);
    if (aliasedSymbol && aliasedSymbol !== symbol) {
      return this.typeChecker.getTypeOfSymbolAtLocation(aliasedSymbol, sourceFile);
    }

    return this.typeChecker.getTypeOfSymbolAtLocation(symbol, sourceFile);
  }

  /**
   * Handle namespace and module types
   */
  resolveNamespaceType(namespace: ts.ModuleDeclaration): Map<string, ts.Type> {
    const exports = new Map<string, ts.Type>();
    const symbol = this.typeChecker.getSymbolAtLocation(namespace.name);
    
    if (symbol) {
      const namespaceExports = this.typeChecker.getExportsOfModule(symbol);
      
      for (const exportSymbol of namespaceExports) {
        const type = this.typeChecker.getTypeOfSymbolAtLocation(
          exportSymbol,
          exportSymbol.valueDeclaration!
        );
        exports.set(exportSymbol.getName(), type);
      }
    }

    return exports;
  }

  // Helper methods
  private createResolvedType(type: ts.Type): ResolvedType {
    const typeString = this.typeChecker.typeToString(type);
    
    return {
      typeString,
      isGeneric: this.getTypeArguments(type).length > 0,
      isUnion: type.isUnion(),
      isIntersection: type.isIntersection(),
      isArray: this.isArrayType(type),
      isPrimitive: this.isPrimitiveType(typeString),
      isObject: !!(type.flags & ts.TypeFlags.Object),
      isFunction: type.getCallSignatures().length > 0
    };
  }

  private symbolToPropertyInfo(symbol: ts.Symbol): PropertyInfo {
    const type = this.typeChecker.getTypeOfSymbolAtLocation(
      symbol,
      symbol.valueDeclaration!
    );
    
    const modifiers = symbol.valueDeclaration
      ? ts.getCombinedModifierFlags(symbol.valueDeclaration as ts.Declaration)
      : 0;

    let visibility: 'public' | 'private' | 'protected' = 'public';
    if (modifiers & ts.ModifierFlags.Private) visibility = 'private';
    else if (modifiers & ts.ModifierFlags.Protected) visibility = 'protected';

    return {
      name: symbol.getName(),
      type: this.createResolvedType(type),
      optional: !!(symbol.flags & ts.SymbolFlags.Optional),
      readonly: !!(modifiers & ts.ModifierFlags.Readonly),
      description: ts.displayPartsToString(symbol.getDocumentationComment(this.typeChecker)),
      visibility
    };
  }

  private signatureToMethodSignature(name: string, signature: ts.Signature): MethodSignature {
    return {
      name,
      parameters: signature.getParameters().map(param => ({
        name: param.getName(),
        type: this.createResolvedType(
          this.typeChecker.getTypeOfSymbolAtLocation(param, param.valueDeclaration!)
        ),
        optional: !!(param.flags & ts.SymbolFlags.Optional),
        description: ts.displayPartsToString(param.getDocumentationComment(this.typeChecker))
      })),
      returnType: this.createResolvedType(signature.getReturnType()),
      typeParameters: signature.getTypeParameters()?.map(tp => tp.symbol.getName())
    };
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

  private isPrimitiveType(typeString: string): boolean {
    const primitives = [
      'string', 'number', 'boolean', 'null', 'undefined',
      'void', 'any', 'unknown', 'never', 'symbol', 'bigint'
    ];
    return primitives.includes(typeString.toLowerCase());
  }
}

interface MethodSignature {
  name: string;
  parameters: Array<{
    name: string;
    type: ResolvedType;
    optional: boolean;
    description: string;
  }>;
  returnType: ResolvedType;
  typeParameters?: string[];
}