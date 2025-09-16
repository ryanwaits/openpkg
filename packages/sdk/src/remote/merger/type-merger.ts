import type { OpenPkgSpec } from '../../types/openpkg';

export class TypeMerger {
  static mergeTypes(rootSpec: OpenPkgSpec, additionalSpecs: OpenPkgSpec[]): OpenPkgSpec {
    const typeMap = new Map<string, OpenPkgSpec['types'][number]>();

    if (rootSpec.types) {
      for (const type of rootSpec.types) {
        typeMap.set(type.id, type);
      }
    }

    for (const spec of additionalSpecs) {
      if (!spec.types) continue;
      for (const type of spec.types) {
        if (!typeMap.has(type.id)) {
          typeMap.set(type.id, type);
        }
      }
    }

    return {
      ...rootSpec,
      types: Array.from(typeMap.values()),
    };
  }
}
