import type { z } from 'zod';
import type { openPkgSchema } from '../types/openpkg';

export type RegisteredType = z.infer<typeof openPkgSchema>['types'][number];

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
    return this.typeRefs.has(name) || this.typeDefinitions.has(name);
  }
}
