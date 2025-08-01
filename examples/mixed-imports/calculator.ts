// calculator.ts - Mixes different import styles and extensions
import { MathConstants } from './constants';
import type { Operation } from './types';
import * as helpers from './helpers';
import config from './config.json';

export class Calculator {
  add(a: number, b: number): number {
    return helpers.roundToDecimals(a + b, config.precision);
  }
  
  multiply(a: number, b: number): number {
    return helpers.roundToDecimals(a * b, config.precision);
  }
  
  getPI(): number {
    return MathConstants.PI;
  }
  
  performOperation(op: Operation): number {
    return op.execute();
  }
}