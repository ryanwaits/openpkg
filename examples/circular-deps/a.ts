// a.ts - Tests circular dependency handling
import { B, type BData } from './b';

export interface AData {
  id: string;
  name: string;
  b?: BData;
}

export class A {
  constructor(private data: AData) {}

  createB(): B {
    return new B({ id: '123', aRef: this });
  }

  getData(): AData {
    return this.data;
  }
}
