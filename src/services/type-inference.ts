import * as ts from 'typescript';
import { ResolvedType } from './type-resolver';

/**
 * Service for handling type inference in TypeScript
 */
export class TypeInferenceService {
  constructor(private typeChecker: ts.TypeChecker) {}

  /**
   * Get the inferred return type of a function
   */
  getInferredReturnType(node: ts.FunctionDeclaration | ts.MethodDeclaration | ts.ArrowFunction): ts.Type {
    const signature = this.typeChecker.getSignatureFromDeclaration(node);
    
    if (!signature) {
      return this.typeChecker.getAnyType();
    }

    // Get the return type, which will be inferred if not explicitly typed
    const returnType = signature.getReturnType();
    
    // Check if it's actually inferred
    const hasExplicitReturn = node.type !== undefined;
    
    return returnType;
  }

  /**
   * Check if a return type is inferred
   */
  isInferredReturnType(node: ts.FunctionDeclaration | ts.MethodDeclaration | ts.ArrowFunction): boolean {
    return node.type === undefined;
  }

  /**
   * Get inferred generic parameters
   */
  getInferredTypeParameters(callExpression: ts.CallExpression): ts.Type[] {
    const signature = this.typeChecker.getResolvedSignature(callExpression);
    
    if (!signature) {
      return [];
    }

    // Get the type arguments that were inferred
    const typeArgs: ts.Type[] = [];
    const typeParameters = signature.getTypeParameters();
    
    if (typeParameters) {
      // Get the mapper that contains the inferred types
      const mapper = (signature as any).mapper;
      
      if (mapper) {
        for (const typeParam of typeParameters) {
          const inferredType = this.getInferredTypeFromMapper(mapper, typeParam);
          if (inferredType) {
            typeArgs.push(inferredType);
          }
        }
      } else {
        // Fallback: try to get from the call expression
        const callSignature = this.typeChecker.getSignatureFromDeclaration(callExpression as any);
        if (callSignature) {
          // Use type checker to get instantiated types
          for (const typeParam of typeParameters) {
            const constraint = typeParam.getConstraint();
            typeArgs.push(constraint || typeParam);
          }
        }
      }
    }

    return typeArgs;
  }

  private getInferredTypeFromMapper(mapper: any, typeParameter: ts.TypeParameter): ts.Type | undefined {
    // This is using internal TypeScript APIs
    if (mapper && mapper.mappedTypes) {
      const typeParameterId = (typeParameter as any).id;
      return mapper.mappedTypes.get(typeParameterId);
    }
    return undefined;
  }

  /**
   * Get the contextual type of an expression
   */
  getContextualType(expression: ts.Expression): ts.Type | undefined {
    return this.typeChecker.getContextualType(expression);
  }

  /**
   * Infer type from usage in assignment
   */
  inferTypeFromAssignment(node: ts.VariableDeclaration | ts.PropertyDeclaration): ts.Type | undefined {
    if (!node.initializer) {
      return undefined;
    }

    return this.typeChecker.getTypeAtLocation(node.initializer);
  }

  /**
   * Infer parameter types from function usage
   */
  inferParameterTypes(functionNode: ts.FunctionDeclaration | ts.MethodDeclaration): Map<string, ts.Type> {
    const paramTypes = new Map<string, ts.Type>();
    const signature = this.typeChecker.getSignatureFromDeclaration(functionNode);
    
    if (!signature) {
      return paramTypes;
    }

    const parameters = signature.getParameters();
    
    for (const param of parameters) {
      const paramDecl = param.valueDeclaration as ts.ParameterDeclaration;
      
      if (paramDecl && !paramDecl.type) {
        // Parameter type is inferred
        const inferredType = this.typeChecker.getTypeOfSymbolAtLocation(param, paramDecl);
        paramTypes.set(param.getName(), inferredType);
      }
    }

    return paramTypes;
  }

  /**
   * Handle type predicates (is expressions)
   */
  getTypePredicate(node: ts.FunctionDeclaration | ts.MethodDeclaration): TypePredicate | undefined {
    const signature = this.typeChecker.getSignatureFromDeclaration(node);
    
    if (!signature) {
      return undefined;
    }

    const typePredicate = this.typeChecker.getTypePredicateOfSignature(signature);
    
    if (!typePredicate) {
      return undefined;
    }

    return {
      kind: typePredicate.kind,
      parameterName: typePredicate.kind === ts.TypePredicateKind.Identifier 
        ? typePredicate.parameterName 
        : undefined,
      parameterIndex: typePredicate.kind === ts.TypePredicateKind.This 
        ? -1 
        : typePredicate.parameterIndex,
      type: this.typeChecker.typeToString(typePredicate.type)
    };
  }

  /**
   * Check if a function is a type guard
   */
  isTypeGuard(node: ts.FunctionDeclaration | ts.MethodDeclaration): boolean {
    return this.getTypePredicate(node) !== undefined;
  }

  /**
   * Infer type from array literal
   */
  inferArrayType(arrayLiteral: ts.ArrayLiteralExpression): ts.Type {
    return this.typeChecker.getTypeAtLocation(arrayLiteral);
  }

  /**
   * Infer type from object literal
   */
  inferObjectType(objectLiteral: ts.ObjectLiteralExpression): ts.Type {
    return this.typeChecker.getTypeAtLocation(objectLiteral);
  }

  /**
   * Get the best common type from multiple expressions
   */
  getBestCommonType(expressions: ts.Expression[]): ts.Type | undefined {
    if (expressions.length === 0) {
      return undefined;
    }

    const types = expressions.map(expr => this.typeChecker.getTypeAtLocation(expr));
    
    // TypeScript's internal best common type algorithm
    if (types.length === 1) {
      return types[0];
    }

    // Try to find a union type that encompasses all
    let commonType = types[0];
    
    for (let i = 1; i < types.length; i++) {
      if (!this.typeChecker.isTypeAssignableTo(types[i], commonType)) {
        // Create union type
        commonType = this.typeChecker.getUnionType([commonType, types[i]]);
      }
    }

    return commonType;
  }

  /**
   * Check if a type is inferred from its usage
   */
  isInferredType(node: ts.Node): boolean {
    if (ts.isVariableDeclaration(node)) {
      return !node.type && !!node.initializer;
    }
    
    if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isArrowFunction(node)) {
      return !node.type;
    }
    
    if (ts.isParameter(node)) {
      return !node.type;
    }

    return false;
  }

  /**
   * Get inferred type with its inference source
   */
  getInferredTypeWithSource(node: ts.Node): InferredTypeInfo | null {
    const type = this.typeChecker.getTypeAtLocation(node);
    
    if (!this.isInferredType(node)) {
      return null;
    }

    let source: string = 'unknown';
    let sourceNode: ts.Node | undefined;

    if (ts.isVariableDeclaration(node) && node.initializer) {
      source = 'initializer';
      sourceNode = node.initializer;
    } else if (ts.isParameter(node)) {
      source = 'usage';
      // Would need to analyze call sites to find actual source
    } else if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
      source = 'return-statements';
      // Would need to analyze return statements
    }

    return {
      type,
      typeString: this.typeChecker.typeToString(type),
      source,
      sourceNode,
      isInferred: true
    };
  }
}

export interface TypePredicate {
  kind: ts.TypePredicateKind;
  parameterName?: string;
  parameterIndex?: number;
  type: string;
}

export interface InferredTypeInfo {
  type: ts.Type;
  typeString: string;
  source: 'initializer' | 'usage' | 'return-statements' | 'unknown';
  sourceNode?: ts.Node;
  isInferred: boolean;
}