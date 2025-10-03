import type { OpenPkgSpec } from '../types/openpkg';

type TypesArray = NonNullable<OpenPkgSpec['types']>;
export type RegisteredType = TypesArray[number];

export class TypeRegistry {
  private readonly typeRefs = new Map<string, string>();
  private readonly typeDefinitions = new Map<string, RegisteredType>();
  private readonly referencedTypes = new Set<string>();

  registerExportedType(name: string, id: string = name): void {
    if (!this.typeRefs.has(name)) {
      this.typeRefs.set(name, id);
    }
  }

  hasType(name: string): boolean {
    return this.typeDefinitions.has(name);
  }

  registerTypeDefinition(definition: RegisteredType): boolean {
    if (this.typeDefinitions.has(definition.name)) {
      return false;
    }

    this.typeDefinitions.set(definition.name, definition);
    if (!this.typeRefs.has(definition.name)) {
      this.typeRefs.set(definition.name, definition.id);
    }

    return true;
  }

  getTypeRefs(): Map<string, string> {
    return this.typeRefs;
  }

  getTypeDefinitions(): RegisteredType[] {
    return Array.from(this.typeDefinitions.values());
  }

  getReferencedTypes(): Set<string> {
    return this.referencedTypes;
  }

  isKnownType(name: string): boolean {
    if (this.typeDefinitions.has(name)) {
      return true;
    }

    const ref = this.typeRefs.get(name);
    if (ref === undefined) {
      return false;
    }

    if (ref !== name) {
      // Re-exported aliases map to the original type id; treat it as known only
      // when we've already serialized the canonical definition.
      return this.typeDefinitions.has(ref);
    }

    return false;
  }
}
