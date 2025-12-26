import type ts from 'typescript';
import type { SpecType } from '@openpkg-ts/spec';

export class TypeRegistry {
  private types = new Map<string, SpecType>();

  add(type: SpecType): void {
    this.types.set(type.id, type);
  }

  get(id: string): SpecType | undefined {
    return this.types.get(id);
  }

  has(id: string): boolean {
    return this.types.has(id);
  }

  getAll(): SpecType[] {
    return Array.from(this.types.values());
  }

  registerFromSymbol(symbol: ts.Symbol, checker: ts.TypeChecker): SpecType | undefined {
    const name = symbol.getName();
    if (this.has(name)) return this.get(name);

    // TODO: Build type from symbol
    const type: SpecType = {
      id: name,
      name,
      kind: 'type',
    };

    this.add(type);
    return type;
  }
}
