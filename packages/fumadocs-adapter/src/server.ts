import * as fs from 'node:fs';
import type { OpenPkg, SpecExport, SpecExportKind, SpecType } from '@openpkg-ts/spec';

export interface OpenPkgOptions {
  /** Path to openpkg.json file or the spec object directly */
  input: string | OpenPkg;
}

export interface OpenPkgInstance {
  /** The parsed OpenPkg spec */
  spec: OpenPkg;
  /** Get an export by its ID */
  getExport(id: string): SpecExport | undefined;
  /** Get a type definition by its ID */
  getType(id: string): SpecType | undefined;
  /** Get all exports of a specific kind */
  getExportsByKind(kind: SpecExportKind): SpecExport[];
  /** Get all exports */
  getAllExports(): SpecExport[];
  /** Get all type definitions */
  getAllTypes(): SpecType[];
}

/**
 * Creates an OpenPkg instance for use with Fumadocs components.
 *
 * @example
 * ```ts
 * // From file path
 * const openpkg = createOpenPkg({ input: './openpkg.json' });
 *
 * // From spec object
 * import spec from './openpkg.json';
 * const openpkg = createOpenPkg({ input: spec });
 * ```
 */
export function createOpenPkg(options: OpenPkgOptions): OpenPkgInstance {
  const spec: OpenPkg =
    typeof options.input === 'string'
      ? JSON.parse(fs.readFileSync(options.input, 'utf-8'))
      : options.input;

  const exportsById = new Map<string, SpecExport>();
  const typesById = new Map<string, SpecType>();

  for (const exp of spec.exports) {
    exportsById.set(exp.id, exp);
  }

  if (spec.types) {
    for (const type of spec.types) {
      typesById.set(type.id, type);
    }
  }

  return {
    spec,

    getExport(id: string): SpecExport | undefined {
      return exportsById.get(id);
    },

    getType(id: string): SpecType | undefined {
      return typesById.get(id);
    },

    getExportsByKind(kind: SpecExportKind): SpecExport[] {
      return spec.exports.filter((exp) => exp.kind === kind);
    },

    getAllExports(): SpecExport[] {
      return spec.exports;
    },

    getAllTypes(): SpecType[] {
      return spec.types ?? [];
    },
  };
}
