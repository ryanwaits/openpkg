import * as ts from 'typescript';
import { Node as TsMorphNode } from 'ts-morph';
import { z } from 'zod';
import { openPkgSchema } from '../types/openpkg';

// Resolved type information
export interface ResolvedType {
  typeString: string;
  isGeneric: boolean;
  genericArguments?: ResolvedType[];
  properties?: PropertyInfo[];
  isUnion: boolean;
  unionTypes?: ResolvedType[];
  isIntersection: boolean;
  intersectionTypes?: ResolvedType[];
  isArray: boolean;
  elementType?: ResolvedType;
  isPrimitive: boolean;
  isObject: boolean;
  isFunction: boolean;
  functionSignature?: FunctionSignatureInfo;
}

export interface PropertyInfo {
  name: string;
  type: ResolvedType;
  optional: boolean;
  readonly: boolean;
  description: string;
  visibility?: 'public' | 'private' | 'protected';
}

export interface FunctionSignatureInfo {
  parameters: ParameterInfo[];
  returnType: ResolvedType;
  typeParameters?: string[];
}

export interface ParameterInfo {
  name: string;
  type: ResolvedType;
  optional: boolean;
  description: string;
  defaultValue?: string;
}

// Expanded type with full structure
export interface ExpandedType {
  original: string;
  expanded: ResolvedType;
  depth: number;
}

// Base interface for type resolvers
export interface ITypeResolver {
  resolveType(node: ts.Node | TsMorphNode): ResolvedType;
  getProperties(type: ts.Type | any): PropertyInfo[];
  expandGeneric(type: ts.Type | any): ExpandedType;
  resolveImportedType(typeName: string, sourceFile: ts.SourceFile | any): ResolvedType | null;
  getTypeString(type: ts.Type | any): string;
}

// Base class with shared functionality
export abstract class BaseTypeResolver implements ITypeResolver {
  protected maxDepth = 10;
  protected visitedTypes = new Set<any>();

  abstract resolveType(node: ts.Node | TsMorphNode): ResolvedType;
  abstract getProperties(type: ts.Type | any): PropertyInfo[];
  abstract expandGeneric(type: ts.Type | any): ExpandedType;
  abstract resolveImportedType(typeName: string, sourceFile: ts.SourceFile | any): ResolvedType | null;
  abstract getTypeString(type: ts.Type | any): string;

  protected isPrimitiveType(typeString: string): boolean {
    const primitives = [
      'string',
      'number',
      'boolean',
      'null',
      'undefined',
      'void',
      'any',
      'unknown',
      'never',
      'symbol',
      'bigint'
    ];
    return primitives.includes(typeString.toLowerCase());
  }

  protected createPrimitiveType(typeString: string): ResolvedType {
    return {
      typeString,
      isGeneric: false,
      isUnion: false,
      isIntersection: false,
      isArray: false,
      isPrimitive: true,
      isObject: false,
      isFunction: false
    };
  }

  protected detectCycle(type: any): boolean {
    const typeId = this.getTypeId(type);
    if (this.visitedTypes.has(typeId)) {
      return true;
    }
    // Don't add to visited yet - let the resolver do it after starting resolution
    return false;
  }
  
  protected markVisited(type: any): void {
    const typeId = this.getTypeId(type);
    this.visitedTypes.add(typeId);
  }
  
  protected unmarkVisited(type: any): void {
    const typeId = this.getTypeId(type);
    this.visitedTypes.delete(typeId);
  }

  protected clearVisitedTypes(): void {
    this.visitedTypes.clear();
  }

  protected abstract getTypeId(type: any): string;

  // Helper to create OpenPkg-compatible type reference
  protected createTypeRef(typeString: string): z.infer<typeof openPkgSchema>['exports'][0]['type'] {
    if (this.isPrimitiveType(typeString)) {
      return typeString;
    }
    return { $ref: `#/types/${typeString}` };
  }

  // Convert ResolvedType to OpenPkg type format
  protected resolvedTypeToOpenPkgType(resolved: ResolvedType): string | { $ref: string } {
    if (resolved.isPrimitive) {
      return resolved.typeString;
    }
    
    if (resolved.isArray && resolved.elementType) {
      const elementType = this.resolvedTypeToOpenPkgType(resolved.elementType);
      if (typeof elementType === 'string') {
        return `${elementType}[]`;
      }
      return `Array<${elementType.$ref}>`;
    }

    if (resolved.isUnion && resolved.unionTypes) {
      const unionParts = resolved.unionTypes.map(t => this.resolvedTypeToOpenPkgType(t));
      return unionParts.map(t => typeof t === 'string' ? t : t.$ref).join(' | ');
    }

    // For complex types, create a reference
    return { $ref: `#/types/${resolved.typeString}` };
  }
}