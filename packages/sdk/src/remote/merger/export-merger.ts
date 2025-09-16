import type { OpenPkgSpec } from '../../types/openpkg';
import type { ImportInfo } from '../parser/import-parser';

export class ExportMerger {
  private static isRuntimeExport(exp: OpenPkgSpec['exports'][number]): boolean {
    return exp.kind === 'function' || exp.kind === 'class' || exp.kind === 'variable' || exp.kind === 'const';
  }

  static mergeExports(
    rootSpec: OpenPkgSpec,
    additionalSpecs: Map<string, OpenPkgSpec>,
    reExports: ImportInfo[],
  ): OpenPkgSpec {
    const exportMap = new Map<string, OpenPkgSpec['exports'][number]>();

    if (rootSpec.exports) {
      for (const exp of rootSpec.exports) {
        if (exp.id && this.isRuntimeExport(exp)) {
          exportMap.set(exp.id, exp);
        }
      }
    }

    for (const reExport of reExports) {
      if (!reExport.isReExport || reExport.isTypeOnly) {
        continue;
      }

      const targetSpecEntry = Array.from(additionalSpecs.entries()).find(([url]) => {
        const normalized = reExport.path.replace(/^\.\//, '');
        return url.endsWith(normalized) || url.endsWith(`${normalized}.ts`);
      });

      if (!targetSpecEntry) {
        continue;
      }

      const [, targetSpec] = targetSpecEntry;
      if (!targetSpec.exports) {
        continue;
      }

      if (reExport.exportedNames?.includes('*')) {
        for (const exp of targetSpec.exports) {
          if (exp.id && this.isRuntimeExport(exp) && !exportMap.has(exp.id)) {
            exportMap.set(exp.id, exp);
          }
        }
      } else if (reExport.exportedNames && reExport.exportedNames.length > 0) {
        for (const name of reExport.exportedNames) {
          const exp = targetSpec.exports.find((entry) => entry.name === name);
          if (exp && exp.id && this.isRuntimeExport(exp) && !exportMap.has(exp.id)) {
            exportMap.set(exp.id, exp);
          }
        }
      }
    }

    return {
      ...rootSpec,
      exports: Array.from(exportMap.values()),
    };
  }
}
