import type { OpenPkg, SpecExport, SpecType } from './types';

const DEFAULT_ECOSYSTEM = 'js/ts';

const arrayFieldsByExport: Array<keyof SpecExport> = ['signatures', 'members', 'examples', 'tags'];
const arrayFieldsByType: Array<keyof SpecType> = ['members', 'tags'];

export function normalize(spec: OpenPkg): OpenPkg {
  const normalized: OpenPkg = JSON.parse(JSON.stringify(spec));

  normalized.meta = {
    ecosystem: normalized.meta?.ecosystem ?? DEFAULT_ECOSYSTEM,
    ...normalized.meta,
  };

  normalized.exports = Array.isArray(normalized.exports) ? [...normalized.exports] : [];
  normalized.exports.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  normalized.exports = normalized.exports.map((item) => normalizeExport(item));

  const types = Array.isArray(normalized.types) ? [...normalized.types] : [];
  types.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  normalized.types = types.map((item) => normalizeType(item));

  // Do not force-add root examples/extensions; keep output minimal

  return normalized;
}

function normalizeExport(item: SpecExport): SpecExport {
  const clone: SpecExport = JSON.parse(JSON.stringify(item));
  for (const field of arrayFieldsByExport) {
    if (!Array.isArray(clone[field] as unknown)) {
      (clone as Record<string, unknown>)[field as string] = [];
    }
  }
  return clone;
}

function normalizeType(item: SpecType): SpecType {
  const clone: SpecType = JSON.parse(JSON.stringify(item));
  for (const field of arrayFieldsByType) {
    if (!Array.isArray(clone[field] as unknown)) {
      (clone as Record<string, unknown>)[field as string] = [];
    }
  }
  return clone;
}
