// b.ts - Creates circular dependency back to a.ts
import { A, AData } from './a';

export interface BData {
  id: string;
  aRef: A;
}

export class B {
  constructor(private data: BData) {}
  
  getRelatedA(): A {
    return this.data.aRef;
  }
  
  createNewA(data: AData): A {
    return new A(data);
  }
}