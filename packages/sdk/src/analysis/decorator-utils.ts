/**
 * Decorator extraction utility for TypeScript AST nodes.
 *
 * Supports Stage 3 decorators used in Angular, NestJS, TypeORM, etc.
 */

import type * as TS from 'typescript';
import { ts } from '../ts-module';

export interface DecoratorInfo {
  /** Decorator name (e.g., 'Injectable', 'Component') */
  name: string;
  /** Evaluated arguments if possible */
  arguments?: unknown[];
  /** Raw text of arguments */
  argumentsText?: string[];
}

/**
 * Extract decorators from a TypeScript AST node.
 *
 * @param node - The AST node to extract decorators from
 * @returns Array of decorator info, or undefined if no decorators
 */
export function extractDecorators(node: TS.Node): DecoratorInfo[] | undefined {
  if (!ts.canHaveDecorators(node)) {
    return undefined;
  }

  const decorators = ts.getDecorators(node);
  if (!decorators || decorators.length === 0) {
    return undefined;
  }

  return decorators.map((decorator) => {
    const expression = decorator.expression;

    if (ts.isIdentifier(expression)) {
      // Simple decorator: @Injectable
      return { name: expression.text };
    }

    if (ts.isCallExpression(expression)) {
      // Decorator with args: @Component({ selector: 'app' })
      const name = ts.isIdentifier(expression.expression)
        ? expression.expression.text
        : expression.expression.getText();

      const argumentsText = expression.arguments.map((arg) => arg.getText());

      return { name, argumentsText };
    }

    if (ts.isPropertyAccessExpression(expression)) {
      // Property access: @Foo.Bar
      return { name: expression.getText() };
    }

    // Fallback: use the full expression text
    return { name: expression.getText() };
  });
}

/**
 * Extract decorators from a parameter node.
 *
 * @param param - The parameter declaration to extract decorators from
 * @returns Array of decorator info, or undefined if no decorators
 */
export function extractParameterDecorators(
  param: TS.ParameterDeclaration,
): DecoratorInfo[] | undefined {
  return extractDecorators(param);
}
