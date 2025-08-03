// types.ts - Type-only exports
export interface Operation {
  execute(): number;
}

export type OperationType = 'add' | 'subtract' | 'multiply' | 'divide';

export interface CalculatorConfig {
  precision: number;
  mode: 'standard' | 'scientific';
}
