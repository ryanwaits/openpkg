import type {
  OpenPkg,
  SpecExport,
  SpecGenerationInfo,
  SpecMember,
  SpecTag,
  SpecType,
} from './types';

const DEFAULT_ECOSYSTEM = 'js/ts';

const arrayFieldsByExport: Array<keyof SpecExport> = ['signatures', 'members', 'examples', 'tags'];
const arrayFieldsByType: Array<keyof SpecType> = ['members', 'tags'];

export function normalize(spec: OpenPkg): OpenPkg {
  const normalized: OpenPkg = structuredClone(spec);

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

  // Normalize generation metadata to match schema
  if (normalized.generation) {
    normalized.generation = normalizeGeneration(normalized.generation);
  }

  return normalized;
}

/**
 * Normalize generation metadata to match schema.
 * Schema expects generator to be a string, not an object.
 */
function normalizeGeneration(
  gen: OpenPkg['generation'],
): OpenPkg['generation'] {
  if (!gen) return undefined;

  // If it has the extended SpecGenerationInfo structure
  const extendedGen = gen as SpecGenerationInfo;
  if (extendedGen.generator && typeof extendedGen.generator === 'object') {
    // Convert to minimal SpecGenerationMeta format
    return {
      generator: `${extendedGen.generator.name}@${extendedGen.generator.version}`,
      timestamp: extendedGen.timestamp,
    };
  }

  return gen;
}

function normalizeExport(item: SpecExport): SpecExport {
  const clone: SpecExport = structuredClone(item);

  // Ensure array fields exist
  for (const field of arrayFieldsByExport) {
    if (!Array.isArray(clone[field] as unknown)) {
      (clone as Record<string, unknown>)[field as string] = [];
    }
  }

  // Fix type field: schema expects string, move object to schema field
  if (clone.type !== undefined && typeof clone.type !== 'string') {
    // Move object type to schema if schema is empty
    if (!clone.schema) {
      clone.schema = clone.type;
    }
    delete clone.type;
  }

  // Normalize tags to only have name and text (remove extra properties)
  if (clone.tags && clone.tags.length > 0) {
    clone.tags = clone.tags.map(normalizeTag);
  }

  // Normalize members
  if (clone.members && clone.members.length > 0) {
    clone.members = clone.members.map(normalizeMember);
  }

  return clone;
}

function normalizeType(item: SpecType): SpecType {
  const clone: SpecType = structuredClone(item);

  // Ensure array fields exist
  for (const field of arrayFieldsByType) {
    if (!Array.isArray(clone[field] as unknown)) {
      (clone as Record<string, unknown>)[field as string] = [];
    }
  }

  // Fix type field: schema expects string, move object to schema field
  if (clone.type !== undefined && typeof clone.type !== 'string') {
    if (!clone.schema) {
      clone.schema = clone.type;
    }
    delete clone.type;
  }

  // Normalize tags to only have name and text
  if (clone.tags && clone.tags.length > 0) {
    clone.tags = clone.tags.map(normalizeTag);
  }

  // Normalize members
  if (clone.members && clone.members.length > 0) {
    clone.members = clone.members.map(normalizeMember);
  }

  return clone;
}

/**
 * Normalize a tag to only have name and text (schema doesn't allow additionalProperties).
 */
function normalizeTag(tag: SpecTag & Record<string, unknown>): SpecTag {
  return {
    name: tag.name,
    text: tag.text,
  };
}

/**
 * Normalize a member - fix tags and nested structures.
 */
function normalizeMember(member: SpecMember): SpecMember {
  const clone: SpecMember = structuredClone(member);

  // Normalize tags
  if (clone.tags && clone.tags.length > 0) {
    clone.tags = clone.tags.map(normalizeTag);
  }

  return clone;
}
