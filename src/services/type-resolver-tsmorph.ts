import { Node, Type, SourceFile, Project } from 'ts-morph';
import { BaseTypeResolver, ResolvedType, PropertyInfo, ExpandedType } from './type-resolver';

export class TsMorphTypeResolver extends BaseTypeResolver {
  constructor(private project: Project) {
    super();
  }

  resolveType(node: Node): ResolvedType {
    this.clearVisitedTypes();
    const type = node.getType();
    return this.resolveTypeInternal(type, 0);
  }

  private resolveTypeInternal(type: Type, depth: number): ResolvedType {
    if (depth > this.maxDepth || this.detectCycle(type)) {
      return this.createPrimitiveType('...');
    }

    const typeString = type.getText();

    // Check for primitive types
    if (this.isPrimitiveType(typeString)) {
      return this.createPrimitiveType(typeString);
    }

    // For ts-morph, we return basic type information
    // The Compiler API resolver will handle complex types
    return {
      typeString,
      isGeneric: type.getTypeArguments().length > 0,
      isUnion: type.isUnion(),
      isIntersection: type.isIntersection(),
      isArray: type.isArray(),
      isPrimitive: false,
      isObject: type.isObject(),
      isFunction: type.getCallSignatures().length > 0
    };
  }

  getProperties(type: Type): PropertyInfo[] {
    try {
      const properties = type.getProperties();
      return properties.map(prop => {
        const propType = prop.getTypeAtLocation(prop.getValueDeclaration()!);
        return {
          name: prop.getName(),
          type: this.resolveTypeInternal(propType, 0),
          optional: prop.isOptional(),
          readonly: false, // ts-morph doesn't easily provide this
          description: '', // Would need JSDoc parsing
        };
      });
    } catch {
      return [];
    }
  }

  expandGeneric(type: Type): ExpandedType {
    // ts-morph cannot fully expand generics
    // Return basic information, Compiler API will handle expansion
    return {
      original: type.getText(),
      expanded: this.resolveType(type.getSymbol()?.getValueDeclaration() || type as any),
      depth: 1
    };
  }

  resolveImportedType(typeName: string, sourceFile: SourceFile): ResolvedType | null {
    // Basic implementation - Compiler API will handle complex imports
    const symbol = sourceFile.getLocal(typeName);
    if (!symbol) return null;

    const type = symbol.getTypeAtLocation(sourceFile);
    return this.resolveTypeInternal(type, 0);
  }

  getTypeString(type: Type): string {
    return type.getText();
  }

  protected getTypeId(type: Type): string {
    return type.getText();
  }
}