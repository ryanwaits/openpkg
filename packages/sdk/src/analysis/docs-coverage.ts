import {
  DRIFT_CATEGORIES,
  type DriftCategory,
  type SpecDocDrift,
  type SpecExport,
  type SpecSchema,
  type SpecTag,
} from '@openpkg-ts/spec';
import ts from 'typescript';
import { isFixableDrift } from '../fix';
import { isBuiltInIdentifier } from '../utils/builtin-detection';
import type { ExampleRunResult } from '../utils/example-runner';
import type { OpenPkgSpec } from './spec-types';

/**
 * Result of computing drift for a single export.
 */
export type ExportDriftResult = {
  id: string;
  drift: SpecDocDrift[];
};

/**
 * Result of computing drift for all exports.
 */
export type DriftResult = {
  exports: Map<string, SpecDocDrift[]>;
};

/**
 * Information about an export for context-aware suggestions.
 */
export interface ExportInfo {
  name: string;
  kind: string;
  isCallable: boolean;
}

/**
 * Registry of exports and types for cross-reference validation.
 */
export interface ExportRegistry {
  /** Map of export names to their info (for context-aware suggestions) */
  exports: Map<string, ExportInfo>;
  /** Set of type names (interfaces, type aliases, etc.) */
  types: Set<string>;
  /** Combined set of all names (for backward compatibility) */
  all: Set<string>;
}

/**
 * Build a registry of all export/type names for cross-reference validation.
 */
export function buildExportRegistry(spec: OpenPkgSpec): ExportRegistry {
  const exports = new Map<string, ExportInfo>();
  const types = new Set<string>();
  const all = new Set<string>();

  for (const entry of spec.exports ?? []) {
    const info: ExportInfo = {
      name: entry.name,
      kind: entry.kind ?? 'unknown',
      isCallable: ['function', 'class'].includes(entry.kind ?? ''),
    };
    exports.set(entry.name, info);
    if (entry.id) exports.set(entry.id, info);
    all.add(entry.name);
    if (entry.id) all.add(entry.id);
  }

  for (const type of spec.types ?? []) {
    types.add(type.name);
    if (type.id) types.add(type.id);
    all.add(type.name);
    if (type.id) all.add(type.id);
  }

  return { exports, types, all };
}

/**
 * Compute drift for all exports in a spec.
 *
 * @param spec - The OpenPkg spec to analyze
 * @returns Drift results per export
 */
export function computeDrift(spec: OpenPkgSpec): DriftResult {
  const registry = buildExportRegistry(spec);
  const exports = new Map<string, SpecDocDrift[]>();

  for (const entry of spec.exports ?? []) {
    const drift = computeExportDrift(entry, registry);
    exports.set(entry.id ?? entry.name, drift);
  }

  return { exports };
}

/**
 * Compute drift for a single export.
 *
 * @param entry - The export to analyze
 * @param registry - Registry of known exports and types for validation
 * @returns Array of drift issues detected
 */
export function computeExportDrift(
  entry: SpecExport,
  registry?: ExportRegistry,
): SpecDocDrift[] {
  return [
    ...detectParamDrift(entry),
    ...detectOptionalityDrift(entry),
    ...detectParamTypeDrift(entry),
    ...detectReturnTypeDrift(entry),
    ...detectGenericConstraintDrift(entry),
    ...detectDeprecatedDrift(entry),
    ...detectVisibilityDrift(entry),
    ...detectExampleDrift(entry, registry),
    ...detectBrokenLinks(entry, registry),
    ...detectExampleSyntaxErrors(entry),
    ...detectAsyncMismatch(entry),
    ...detectPropertyTypeDrift(entry),
  ];
}

function detectParamDrift(entry: SpecExport): SpecDocDrift[] {
  const drifts: SpecDocDrift[] = [];
  const signatures = entry.signatures ?? [];
  if (signatures.length === 0) {
    return drifts;
  }

  // Build map of param names to their schema properties (for destructured params)
  const actualParamNames = new Set<string>();
  const paramProperties = new Map<string, Set<string>>();

  for (const signature of signatures) {
    for (const param of signature.parameters ?? []) {
      if (param.name) {
        actualParamNames.add(param.name);

        // Extract properties from schema for destructured param matching
        const schema = param.schema as Record<string, unknown> | undefined;
        if (schema?.properties && typeof schema.properties === 'object') {
          const propNames = new Set(Object.keys(schema.properties as Record<string, unknown>));
          paramProperties.set(param.name, propNames);
        }
      }
    }
  }

  if (actualParamNames.size === 0) {
    return drifts;
  }

  const documentedParamNames = (entry.tags ?? [])
    .filter((tag) => tag.name === 'param' && Boolean(tag.text))
    .map((tag) => extractParamFromTag(tag.text ?? '')?.name)
    .filter((name): name is string => Boolean(name));

  if (documentedParamNames.length === 0) {
    return drifts;
  }

  for (const documentedName of documentedParamNames) {
    // Direct match (e.g., "name" matches "name")
    if (actualParamNames.has(documentedName)) {
      continue;
    }

    // Handle destructured param notation (e.g., "opts.name")
    if (documentedName.includes('.')) {
      const [prefix, ...rest] = documentedName.split('.');
      const propertyPath = rest.join('.');

      // Check if prefix matches an actual param
      if (actualParamNames.has(prefix)) {
        const properties = paramProperties.get(prefix);

        // If param has properties, check if the documented property exists
        if (properties) {
          // For nested paths like opts.config.host, just check the first level
          const firstProperty = rest[0];
          if (properties.has(firstProperty)) {
            continue; // Property exists, no drift
          }

          // Property doesn't exist - find closest match among actual properties
          const propsArray = Array.from(properties);
          const suggestion = findClosestMatch(firstProperty, propsArray);

          // Build suggestion: either a close match, or list available properties
          let suggestionText: string | undefined;
          if (suggestion) {
            suggestionText = `Did you mean "${prefix}.${suggestion.value}"?`;
          } else if (propsArray.length > 0 && propsArray.length <= 8) {
            // List available properties if there aren't too many
            const propsList = propsArray.slice(0, 5).map((p) => `${prefix}.${p}`);
            suggestionText =
              propsArray.length > 5
                ? `Available: ${propsList.join(', ')}... (${propsArray.length} total)`
                : `Available: ${propsList.join(', ')}`;
          }

          drifts.push({
            type: 'param-mismatch',
            target: documentedName,
            issue: `JSDoc documents property "${propertyPath}" on parameter "${prefix}" which does not exist.`,
            suggestion: suggestionText,
          });
          continue;
        }

        // Param exists but has no extractable properties (e.g., external type)
        // Don't report drift - we can't verify
        continue;
      }
    }

    // No match found - report drift
    const paramsArray = Array.from(actualParamNames);
    const suggestion = findClosestMatch(documentedName, paramsArray);

    // Build suggestion: either a close match, or list available params
    let suggestionText: string | undefined;
    if (suggestion) {
      suggestionText = `Did you mean "${suggestion.value}"?`;
    } else if (paramsArray.length > 0 && paramsArray.length <= 6) {
      suggestionText = `Available parameters: ${paramsArray.join(', ')}`;
    }

    drifts.push({
      type: 'param-mismatch',
      target: documentedName,
      issue: `JSDoc documents parameter "${documentedName}" which is not present in the signature.`,
      suggestion: suggestionText,
    });
  }

  return drifts;
}

function detectOptionalityDrift(entry: SpecExport): SpecDocDrift[] {
  const signatures = entry.signatures ?? [];
  if (signatures.length === 0) {
    return [];
  }

  const actualOptionality = new Map<string, boolean>();
  for (const signature of signatures) {
    for (const param of signature.parameters ?? []) {
      if (!param.name || actualOptionality.has(param.name)) {
        continue;
      }
      actualOptionality.set(param.name, param.required === false);
    }
  }

  if (actualOptionality.size === 0) {
    return [];
  }

  const documentedParams = (entry.tags ?? [])
    .filter((tag) => tag.name === 'param' && Boolean(tag.text))
    .map((tag) => extractParamFromTag(tag.text ?? ''))
    .filter((parsed): parsed is ParsedParamTag & { name: string } => Boolean(parsed?.name));

  if (documentedParams.length === 0) {
    return [];
  }

  const drifts: SpecDocDrift[] = [];

  for (const docParam of documentedParams) {
    const actualOptional = actualOptionality.get(docParam.name);
    if (actualOptional === undefined) {
      continue;
    }

    const documentedOptional = Boolean(docParam.isOptional);
    if (actualOptional === documentedOptional) {
      continue;
    }

    const issue = documentedOptional
      ? `JSDoc marks parameter "${docParam.name}" optional but the signature requires it.`
      : `JSDoc omits optional brackets for parameter "${docParam.name}" but the signature marks it optional.`;
    const suggestion = documentedOptional
      ? `Remove brackets around ${docParam.name} or mark the parameter optional in the signature.`
      : `Document ${docParam.name} as [${docParam.name}] or make it required in the signature.`;

    drifts.push({
      type: 'optionality-mismatch',
      target: docParam.name,
      issue,
      suggestion,
    });
  }

  return drifts;
}

function detectParamTypeDrift(entry: SpecExport): SpecDocDrift[] {
  const signatures = entry.signatures ?? [];
  if (signatures.length === 0) {
    return [];
  }

  const documentedParams = (entry.tags ?? [])
    .filter((tag) => tag.name === 'param' && Boolean(tag.text))
    .map((tag) => extractParamFromTag(tag.text ?? ''))
    .filter(
      (parsed): parsed is ParsedParamTag & { name: string; type: string } =>
        Boolean(parsed?.name) && Boolean(parsed?.type),
    );

  if (documentedParams.length === 0) {
    return [];
  }

  const declaredParamTypes = new Map<string, string>();
  for (const signature of signatures) {
    for (const param of signature.parameters ?? []) {
      if (!param.name || declaredParamTypes.has(param.name)) {
        continue;
      }
      const declaredType = extractTypeFromSchema(param.schema);
      if (declaredType) {
        declaredParamTypes.set(param.name, declaredType);
      }
    }
  }

  if (declaredParamTypes.size === 0) {
    return [];
  }

  const drifts: SpecDocDrift[] = [];
  for (const documentedParam of documentedParams) {
    const declaredType = declaredParamTypes.get(documentedParam.name);
    if (!declaredType || !documentedParam.type) {
      continue;
    }

    const documentedNormalized = normalizeType(documentedParam.type);
    const declaredNormalized = normalizeType(declaredType);

    if (!documentedNormalized || !declaredNormalized) {
      continue;
    }

    if (typesEquivalent(documentedNormalized, declaredNormalized)) {
      continue;
    }

    drifts.push({
      type: 'param-type-mismatch',
      target: documentedParam.name,
      issue: buildParamTypeMismatchIssue(documentedParam.name, documentedParam.type, declaredType),
      suggestion: `Update @param {${declaredType}} ${documentedParam.name} to match the signature.`,
    });
  }

  return drifts;
}

function detectReturnTypeDrift(entry: SpecExport): SpecDocDrift[] {
  const returnsTag = entry.tags?.find((tag) => tag.name === 'returns' && tag.text?.length);
  if (!returnsTag) {
    return [];
  }

  const documentedType = extractReturnTypeFromTag(returnsTag.text);
  if (!documentedType) {
    return [];
  }

  const signatureWithReturns = entry.signatures?.find((signature) => signature.returns);
  const signatureReturn = signatureWithReturns?.returns;
  if (!signatureReturn) {
    return [];
  }

  const declaredRaw = extractTypeFromSchema(signatureReturn.schema);
  const declaredType = normalizeType(declaredRaw) ?? undefined;

  if (!declaredType) {
    return [];
  }

  const documentedNormalized = normalizeType(documentedType);
  if (!documentedNormalized) {
    return [];
  }

  if (typesEquivalent(documentedNormalized, declaredType)) {
    return [];
  }

  return [
    {
      type: 'return-type-mismatch',
      target: 'returns',
      issue: buildReturnTypeMismatchIssue(documentedType, documentedNormalized, declaredType),
      suggestion: `Update @returns to ${declaredType}.`,
    },
  ];
}

function detectDeprecatedDrift(entry: SpecExport): SpecDocDrift[] {
  const codeDeprecated = Boolean(entry.deprecated);
  const docsDeprecated =
    entry.tags?.some((tag) => tag.name.toLowerCase() === 'deprecated') ?? false;

  if (codeDeprecated === docsDeprecated) {
    return [];
  }

  const target = entry.name ?? entry.id;

  if (codeDeprecated && !docsDeprecated) {
    return [
      {
        type: 'deprecated-mismatch',
        target,
        issue: `Declaration for "${target}" is marked deprecated but @deprecated is missing from the docs.`,
        suggestion: 'Add an @deprecated tag explaining the replacement or removal timeline.',
      },
    ];
  }

  return [
    {
      type: 'deprecated-mismatch',
      target,
      issue: `JSDoc marks "${target}" as deprecated but the TypeScript declaration is not.`,
      suggestion: 'Remove the @deprecated tag or deprecate the declaration.',
    },
  ];
}

function detectGenericConstraintDrift(entry: SpecExport): SpecDocDrift[] {
  const templateTags =
    entry.tags?.filter((tag) => tag.name === 'template' && Boolean(tag.text?.trim())) ?? [];
  if (templateTags.length === 0) {
    return [];
  }

  const documentedTemplates = templateTags
    .map((tag) => parseTemplateTag(tag.text))
    .filter((template): template is DocumentedTemplateTag => Boolean(template?.name));
  if (documentedTemplates.length === 0) {
    return [];
  }

  const actualConstraints = collectActualTypeParameterConstraints(entry);
  if (actualConstraints.size === 0) {
    return [];
  }

  const drifts: SpecDocDrift[] = [];
  for (const doc of documentedTemplates) {
    if (!actualConstraints.has(doc.name)) {
      continue;
    }

    const actualConstraint = actualConstraints.get(doc.name);
    const normalizedActual = normalizeType(actualConstraint);
    const normalizedDocumented = normalizeType(doc.constraint);

    if (!normalizedActual && !normalizedDocumented) {
      continue;
    }

    if (normalizedActual === normalizedDocumented) {
      continue;
    }

    drifts.push({
      type: 'generic-constraint-mismatch',
      target: doc.name,
      issue: buildGenericConstraintMismatchIssue(doc.name, doc.constraint, actualConstraint),
      suggestion: buildGenericConstraintSuggestion(doc.name, actualConstraint),
    });
  }

  return drifts;
}

type CodeVisibility = 'public' | 'protected' | 'private';
type DocVisibility = 'internal' | 'protected' | 'private' | 'public';

type DocVisibilitySignal = {
  value: DocVisibility;
  tagName: string;
};

type SpecMemberWithVisibility = {
  id?: string;
  name?: string;
  visibility?: CodeVisibility;
  tags?: SpecTag[];
  kind?: string;
};

const VISIBILITY_TAG_MAP: Record<string, DocVisibility> = {
  internal: 'internal',
  alpha: 'internal',
  private: 'private',
  protected: 'protected',
  public: 'public',
};

function detectVisibilityDrift(entry: SpecExport): SpecDocDrift[] {
  const drifts: SpecDocDrift[] = [];
  const exportDocVisibility = getDocVisibility(entry.tags);
  const exportActualVisibility: CodeVisibility = 'public';

  if (
    exportDocVisibility &&
    !visibilityMatches(exportDocVisibility.value, exportActualVisibility)
  ) {
    const target = entry.name ?? entry.id ?? 'export';
    drifts.push({
      type: 'visibility-mismatch',
      target,
      issue: buildVisibilityIssue(target, exportDocVisibility, exportActualVisibility),
      suggestion: buildVisibilitySuggestion(exportDocVisibility, exportActualVisibility),
    });
  }

  const members = Array.isArray(entry.members) ? entry.members : [];
  for (const member of members) {
    const typedMember = member as SpecMemberWithVisibility;
    const memberDocVisibility = getDocVisibility(typedMember.tags);
    if (!memberDocVisibility) {
      continue;
    }

    const memberActualVisibility: CodeVisibility = typedMember.visibility ?? 'public';
    if (visibilityMatches(memberDocVisibility.value, memberActualVisibility)) {
      continue;
    }

    const memberName = typedMember.name ?? typedMember.id ?? typedMember.kind ?? 'member';
    const qualifiedTarget = `${entry.name ?? entry.id ?? 'export'}#${memberName}`;

    drifts.push({
      type: 'visibility-mismatch',
      target: qualifiedTarget,
      issue: buildVisibilityIssue(qualifiedTarget, memberDocVisibility, memberActualVisibility),
      suggestion: buildVisibilitySuggestion(memberDocVisibility, memberActualVisibility),
    });
  }

  return drifts;
}

function getDocVisibility(tags?: SpecTag[]): DocVisibilitySignal | undefined {
  if (!tags) {
    return undefined;
  }

  for (const tag of tags) {
    const normalizedName = tag.name?.toLowerCase();
    if (!normalizedName) {
      continue;
    }

    const mapped = VISIBILITY_TAG_MAP[normalizedName];
    if (mapped) {
      return {
        value: mapped,
        tagName: tag.name,
      };
    }
  }

  return undefined;
}

function visibilityMatches(
  docVisibility: DocVisibility,
  actualVisibility: CodeVisibility,
): boolean {
  if (docVisibility === 'internal') {
    return actualVisibility !== 'public';
  }

  if (docVisibility === 'public') {
    return actualVisibility === 'public';
  }

  return docVisibility === actualVisibility;
}

function buildVisibilityIssue(
  target: string,
  docVisibility: DocVisibilitySignal,
  actualVisibility: CodeVisibility,
): string {
  const docLabel = formatDocVisibilityTag(docVisibility.tagName);
  return `JSDoc marks "${target}" as ${docLabel} but the declaration is ${actualVisibility}.`;
}

function buildVisibilitySuggestion(
  docVisibility: DocVisibilitySignal,
  actualVisibility: CodeVisibility,
): string {
  const docLabel = formatDocVisibilityTag(docVisibility.tagName);

  switch (docVisibility.value) {
    case 'internal':
      return `Remove ${docLabel} or mark the declaration protected/private.`;
    case 'public':
      return `Remove ${docLabel} or mark the declaration public.`;
    case 'protected':
      if (actualVisibility === 'private') {
        return `Promote the declaration to protected or replace ${docLabel} with @private.`;
      }
      return `Remove ${docLabel} or mark the declaration protected.`;
    case 'private':
      if (actualVisibility === 'protected') {
        return `Downgrade the declaration to private or replace ${docLabel} with @protected/@internal.`;
      }
      return `Remove ${docLabel} or mark the declaration private.`;
    default:
      return 'Align the JSDoc visibility tag with the declaration visibility.';
  }
}

function formatDocVisibilityTag(tagName: string): string {
  const trimmed = tagName.trim();
  if (!trimmed) {
    return '@internal';
  }

  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
}

type ParsedParamTag = { name?: string; type?: string; isOptional?: boolean };

function extractParamFromTag(text: string): ParsedParamTag | undefined {
  const trimmed = text.trim();
  if (!trimmed) {
    return undefined;
  }

  const match = trimmed.match(/^(?:\{([^}]+)\}\s+)?(\S+)(?:\s+-\s+)?/);
  if (!match) {
    return undefined;
  }

  const [, type, rawName] = match;
  const isOptional = Boolean(rawName?.startsWith('[') && rawName?.endsWith(']'));
  const name = normalizeParamName(rawName);

  if (!name) {
    return undefined;
  }

  return {
    name,
    type: type?.trim(),
    isOptional,
  };
}

function normalizeParamName(raw?: string): string | undefined {
  if (!raw) {
    return undefined;
  }

  let name = raw.trim();
  if (!name) {
    return undefined;
  }

  if (name.startsWith('[') && name.endsWith(']')) {
    name = name.slice(1, -1);
  }

  const equalsIndex = name.indexOf('=');
  if (equalsIndex >= 0) {
    name = name.slice(0, equalsIndex);
  }

  if (name.endsWith(',')) {
    name = name.slice(0, -1);
  }

  return name;
}

function extractReturnTypeFromTag(text: string): string | undefined {
  const trimmed = text.trim();
  if (!trimmed) {
    return undefined;
  }

  // Only extract type if it's explicitly in braces {type}
  // Don't treat the first word of a description as a type
  const braceMatch = trimmed.match(/^\{([^}]+)\}/);
  if (braceMatch) {
    return braceMatch[1]?.trim();
  }

  // No braces means no explicit type - just a description
  return undefined;
}

function extractTypeFromSchema(schema: SpecSchema | undefined): string | undefined {
  if (!schema) {
    return undefined;
  }

  if (typeof schema === 'string') {
    return schema;
  }

  if (typeof schema === 'object') {
    const record = schema as Record<string, unknown>;
    if (typeof record.type === 'string') {
      return record.type;
    }
    if (typeof record.$ref === 'string') {
      const ref = record.$ref;
      return ref.startsWith('#/types/') ? ref.slice('#/types/'.length) : ref;
    }
  }

  return undefined;
}

function normalizeType(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return value
    .replace(/\s+/g, ' ')
    .replace(/\s*<\s*/g, '<')
    .replace(/\s*>\s*/g, '>')
    .trim();
}

const VOID_EQUIVALENTS = new Set(['void', 'undefined']);

function typesEquivalent(a: string, b: string): boolean {
  if (a === b) {
    return true;
  }

  const lowerA = a.toLowerCase();
  const lowerB = b.toLowerCase();

  if (VOID_EQUIVALENTS.has(lowerA) && VOID_EQUIVALENTS.has(lowerB)) {
    return true;
  }

  return false;
}

function unwrapPromise(type: string): string | undefined {
  const match = type.match(/^promise<(.+)>$/i);
  return match ? match[1]?.trim() : undefined;
}

function buildReturnTypeMismatchIssue(
  documentedRaw: string,
  documentedNormalized: string,
  declaredNormalized: string,
): string {
  const docPromiseInner = unwrapPromise(documentedNormalized);
  const declaredPromiseInner = unwrapPromise(declaredNormalized);

  if (docPromiseInner && !declaredPromiseInner && docPromiseInner === declaredNormalized) {
    return `JSDoc documents Promise<${docPromiseInner}> but the function returns ${declaredNormalized}.`;
  }

  if (!docPromiseInner && declaredPromiseInner && documentedNormalized === declaredPromiseInner) {
    return `JSDoc documents ${documentedNormalized} but the function returns Promise<${declaredPromiseInner}>.`;
  }

  return `JSDoc documents ${documentedRaw} but the function returns ${declaredNormalized}.`;
}

function buildParamTypeMismatchIssue(
  paramName: string,
  documentedRaw: string,
  declaredRaw: string,
) {
  return `JSDoc documents ${documentedRaw} for parameter "${paramName}" but the signature declares ${declaredRaw}.`;
}

type DocumentedTemplateTag = {
  name: string;
  constraint?: string;
};

function parseTemplateTag(text: string | undefined): DocumentedTemplateTag | undefined {
  const trimmed = text?.trim();
  if (!trimmed) {
    return undefined;
  }

  let remaining = trimmed;
  let constraint: string | undefined;

  const braceMatch = remaining.match(/^\{([^}]+)\}\s+(.+)$/);
  if (braceMatch) {
    constraint = braceMatch[1]?.trim();
    remaining = braceMatch[2]?.trim() ?? '';
  }

  if (!remaining) {
    return undefined;
  }

  const parts = remaining.split(/\s+/).filter(Boolean);
  const rawName = parts.shift();
  if (!rawName) {
    return undefined;
  }

  const name = rawName.replace(/[.,;:]+$/, '');

  if (!constraint && parts.length > 0 && parts[0] === 'extends') {
    const constraintTokens = parts.slice(1);
    const dashIndex = constraintTokens.findIndex((token) => token === '-' || token === '–');
    const tokens = dashIndex >= 0 ? constraintTokens.slice(0, dashIndex) : constraintTokens;
    constraint = tokens.join(' ').trim();
  }

  if (!constraint) {
    constraint = undefined;
  }

  return {
    name,
    constraint,
  };
}

function collectActualTypeParameterConstraints(entry: SpecExport): Map<string, string | undefined> {
  const constraints = new Map<string, string | undefined>();

  for (const typeParam of entry.typeParameters ?? []) {
    if (!typeParam?.name || constraints.has(typeParam.name)) {
      continue;
    }
    constraints.set(typeParam.name, typeParam.constraint ?? undefined);
  }

  for (const signature of entry.signatures ?? []) {
    for (const typeParam of signature.typeParameters ?? []) {
      if (!typeParam?.name || constraints.has(typeParam.name)) {
        continue;
      }
      constraints.set(typeParam.name, typeParam.constraint ?? undefined);
    }
  }

  return constraints;
}

function buildGenericConstraintMismatchIssue(
  templateName: string,
  documentedConstraint?: string,
  actualConstraint?: string,
): string {
  if (actualConstraint && documentedConstraint) {
    return `JSDoc constrains template "${templateName}" to ${documentedConstraint} but the declaration constrains it to ${actualConstraint}.`;
  }

  if (actualConstraint && !documentedConstraint) {
    return `JSDoc omits the constraint for template "${templateName}" but the declaration constrains it to ${actualConstraint}.`;
  }

  if (!actualConstraint && documentedConstraint) {
    return `JSDoc constrains template "${templateName}" to ${documentedConstraint} but the declaration has no constraint.`;
  }

  return `Template "${templateName}" has inconsistent constraints between JSDoc and the declaration.`;
}

function buildGenericConstraintSuggestion(
  templateName: string,
  actualConstraint?: string,
): string | undefined {
  if (actualConstraint) {
    return `Update @template to {${actualConstraint}} ${templateName} to reflect the declaration.`;
  }

  return `Remove the constraint from @template ${templateName} to match the declaration.`;
}

/**
 * Split a camelCase or PascalCase string into words.
 */
function splitCamelCase(str: string): string[] {
  return str
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter(Boolean);
}

/**
 * Find the closest matching candidate using word-based scoring.
 * Returns undefined if no good match is found (score < 0.5).
 *
 * Scoring algorithm:
 * 1. Word overlap: How many words from source appear in candidate
 * 2. Suffix matching: Extra weight for matching suffixes (important for API renames)
 * 3. Levenshtein distance: Normalized edit distance as tiebreaker
 */
function findClosestMatch(
  source: string,
  candidates: string[],
): { value: string; distance: number } | undefined {
  if (candidates.length === 0) {
    return undefined;
  }

  const sourceWords = splitCamelCase(source);
  let bestMatch: string | undefined;
  let bestScore = 0;

  for (const candidate of candidates) {
    // Skip exact matches (not a suggestion if it's the same)
    if (candidate === source) continue;

    const candidateWords = splitCamelCase(candidate);

    // Calculate word overlap
    let matchingWords = 0;
    let suffixMatch = false;

    // Check suffix match (most important for API renames like call→fetchCall)
    if (sourceWords.length > 0 && candidateWords.length > 0) {
      const sourceSuffix = sourceWords[sourceWords.length - 1];
      const candidateSuffix = candidateWords[candidateWords.length - 1];
      if (sourceSuffix === candidateSuffix) {
        suffixMatch = true;
        matchingWords += 1.5; // Weight suffix matches
      }
    }

    // Count other matching words (excluding suffix to avoid double-counting)
    const suffixWord = suffixMatch ? sourceWords[sourceWords.length - 1] : null;
    for (const word of sourceWords) {
      if (word !== suffixWord && candidateWords.includes(word)) {
        matchingWords++;
      }
    }

    // Require meaningful overlap: suffix alone isn't enough
    // (e.g., "utf8ToBytes" → "randomBytes" just shares "Bytes" suffix)
    if (matchingWords < 2) continue;

    // Word score (0 to 1+)
    const wordScore = matchingWords / Math.max(sourceWords.length, candidateWords.length);

    // Normalized Levenshtein distance (0 to 1, higher is better)
    const editDistance = levenshtein(source.toLowerCase(), candidate.toLowerCase());
    const maxLen = Math.max(source.length, candidate.length);
    const levScore = 1 - editDistance / maxLen;

    // Combined score with suffix bonus
    const totalScore = suffixMatch ? wordScore * 1.5 + levScore : wordScore + levScore * 0.5;

    if (totalScore > bestScore && totalScore >= 0.5) {
      bestScore = totalScore;
      bestMatch = candidate;
    }
  }

  if (!bestMatch) {
    return undefined;
  }

  // Convert score to distance (lower is better, for compatibility)
  // Score of 0.5 → distance 5, score of 1.0 → distance 0
  const distance = Math.round((1 - bestScore) * 10);
  return { value: bestMatch, distance };
}

function levenshtein(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  if (a.length === 0) {
    return b.length;
  }
  if (b.length === 0) {
    return a.length;
  }

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1, // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Determine how an identifier is used in the AST.
 * Returns 'call' for function calls, 'type' for type annotations, 'value' otherwise.
 */
function getIdentifierContext(node: ts.Identifier): 'call' | 'type' | 'value' {
  const parent = node.parent;
  if (!parent) return 'value';

  // Function call: foo() or new Foo()
  if (ts.isCallExpression(parent) && parent.expression === node) return 'call';
  if (ts.isNewExpression(parent) && parent.expression === node) return 'call';

  // Type reference: const x: Foo or <Foo>
  if (ts.isTypeReferenceNode(parent)) return 'type';
  if (ts.isExpressionWithTypeArguments(parent)) return 'type';

  return 'value';
}

function detectExampleDrift(entry: SpecExport, registry?: ExportRegistry): SpecDocDrift[] {
  if (!registry || !entry.examples?.length) return [];

  const drifts: SpecDocDrift[] = [];

  for (const example of entry.examples) {
    if (typeof example !== 'string') continue;

    // Strip markdown code block markers if present
    const codeContent = example
      .replace(/^```(?:ts|typescript|js|javascript)?\n?/i, '')
      .replace(/\n?```$/i, '')
      .trim();

    if (!codeContent) continue;

    // Parse as AST - this automatically excludes comments and string literals
    const sourceFile = ts.createSourceFile(
      'example.ts',
      codeContent,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

    const localDeclarations = new Set<string>();
    // Track identifiers with their usage context
    const referencedIdentifiers = new Map<string, 'call' | 'type' | 'value'>();

    // Walk AST to find local declarations and identifier references
    function visit(node: ts.Node) {
      if (ts.isIdentifier(node)) {
        const text = node.text;
        // Skip very short identifiers (single letters are usually local vars)
        if (text.length <= 1) {
          ts.forEachChild(node, visit);
          return;
        }

        if (isLocalDeclaration(node)) {
          // Track locally declared identifiers so we don't flag them as missing
          localDeclarations.add(text);
        } else if (isIdentifierReference(node) && !isBuiltInIdentifier(text)) {
          // Track with context (prefer 'call' over other contexts if seen multiple times)
          const context = getIdentifierContext(node);
          const existing = referencedIdentifiers.get(text);
          if (!existing || context === 'call') {
            referencedIdentifiers.set(text, context);
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(sourceFile);

    // Remove local declarations from references (they're defined in the example)
    for (const local of localDeclarations) {
      referencedIdentifiers.delete(local);
    }

    // Check if referenced identifiers exist in registry
    for (const [identifier, context] of referencedIdentifiers) {
      if (!registry.all.has(identifier)) {
        // Get context-appropriate candidates for suggestions
        let candidates: string[];
        if (context === 'call') {
          // For function calls, only suggest callable exports (functions, classes)
          candidates = Array.from(registry.exports.values())
            .filter((e) => e.isCallable)
            .map((e) => e.name);
        } else if (context === 'type') {
          // For type references, suggest types and type-like exports (interfaces, classes)
          candidates = [
            ...Array.from(registry.types),
            ...Array.from(registry.exports.values())
              .filter((e) => ['class', 'interface', 'type', 'enum'].includes(e.kind))
              .map((e) => e.name),
          ];
        } else {
          // For value references, suggest all exports (not types)
          candidates = Array.from(registry.exports.keys());
        }

        const suggestion = findClosestMatch(identifier, candidates);

        // Only report drift if there's a close match (likely typo)
        // or if the identifier looks like a type/class name (PascalCase)
        const isPascal = /^[A-Z]/.test(identifier);
        const hasCloseMatch = suggestion && suggestion.distance <= 5;

        if (hasCloseMatch || isPascal) {
          drifts.push({
            type: 'example-drift',
            target: identifier,
            issue: `@example references "${identifier}" which does not exist in this package.`,
            suggestion: hasCloseMatch ? `Did you mean "${suggestion.value}"?` : undefined,
          });
        }
      }
    }
  }

  return drifts;
}

/**
 * Check if an identifier node is a local declaration (class, function, variable name).
 */
function isLocalDeclaration(node: ts.Identifier): boolean {
  const parent = node.parent;
  if (!parent) return false;

  if (ts.isClassDeclaration(parent) && parent.name === node) return true;
  if (ts.isFunctionDeclaration(parent) && parent.name === node) return true;
  if (ts.isVariableDeclaration(parent) && parent.name === node) return true;

  return false;
}

/**
 * Check if an identifier node is a reference (not a declaration).
 * Returns false only for declaration sites where the identifier is being defined.
 * Import specifiers and type references ARE valid references that should be checked.
 */
function isIdentifierReference(node: ts.Identifier): boolean {
  const parent = node.parent;
  if (!parent) return false;

  // Skip: declarations (class Foo, function Foo, const Foo = ...)
  // These define the identifier, not reference it
  if (ts.isClassDeclaration(parent) && parent.name === node) return false;
  if (ts.isFunctionDeclaration(parent) && parent.name === node) return false;
  if (ts.isVariableDeclaration(parent) && parent.name === node) return false;
  if (ts.isMethodDeclaration(parent) && parent.name === node) return false;
  if (ts.isPropertyDeclaration(parent) && parent.name === node) return false;

  // Import specifiers and type references ARE valid references:
  // - import { Foo } from 'pkg' - Foo should exist
  // - const x: Foo = ... - Foo should exist

  return true;
}

function detectBrokenLinks(entry: SpecExport, registry?: ExportRegistry): SpecDocDrift[] {
  if (!registry) {
    return [];
  }

  const drifts: SpecDocDrift[] = [];

  // Patterns for various link/reference syntaxes in TSDoc/JSDoc
  const patterns: Array<{ pattern: RegExp; type: string }> = [
    // TSDoc: {@link Target}, {@link Target | label}
    { pattern: /\{@link\s+([^}\s|]+)(?:\s*\|[^}]*)?\}/g, type: '@link' },
    // TSDoc: {@see Target}
    { pattern: /\{@see\s+([^}\s]+)\}/g, type: '@see' },
    // TSDoc: {@inheritDoc Target}
    { pattern: /\{@inheritDoc\s+([^}\s]+)\}/g, type: '@inheritDoc' },
  ];

  // Collect all text that might contain links
  // Skip code blocks to avoid false positives
  const allText = [
    entry.description ?? '',
    ...(entry.tags ?? [])
      .filter((tag) => tag.name !== 'example') // examples checked separately
      .map((tag) => tag.text),
  ].join(' ');

  // Remove code blocks from text to avoid false positives
  const textWithoutCode = allText
    .replace(/```[\s\S]*?```/g, '') // fenced code blocks
    .replace(/`[^`]+`/g, ''); // inline code

  for (const { pattern, type } of patterns) {
    const matches = textWithoutCode.matchAll(pattern);

    for (const match of matches) {
      const target = match[1];
      if (!target) continue;

      // Skip URLs
      if (target.startsWith('http://') || target.startsWith('https://')) {
        continue;
      }

      // Handle qualified names (e.g., "Foo.bar" -> check "Foo")
      const rootName = target.split('.')[0] ?? target;

      // Skip external references (module specifiers)
      if (target.includes('/') || target.includes('@')) {
        continue;
      }

      if (!registry.all.has(rootName) && !registry.all.has(target)) {
        // For links, suggest from all exports and types
        const suggestion = findClosestMatch(rootName, Array.from(registry.all));

        drifts.push({
          type: 'broken-link',
          target,
          issue: `{${type} ${target}} references a symbol that does not exist.`,
          suggestion: suggestion ? `Did you mean "${suggestion.value}"?` : undefined,
        });
      }
    }
  }

  return drifts;
}

function detectExampleSyntaxErrors(entry: SpecExport): SpecDocDrift[] {
  if (!entry.examples || entry.examples.length === 0) {
    return [];
  }

  const drifts: SpecDocDrift[] = [];

  for (let i = 0; i < entry.examples.length; i++) {
    const example = entry.examples[i];
    if (typeof example !== 'string') continue;

    // Strip markdown code block markers if present
    const codeContent = example
      .replace(/^```(?:ts|typescript|js|javascript)?\n?/i, '')
      .replace(/\n?```$/i, '')
      .trim();

    if (!codeContent) continue;

    // Try to parse as TypeScript/JavaScript
    const sourceFile = ts.createSourceFile(
      `example-${i}.ts`,
      codeContent,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

    // Check for parse diagnostics
    const parseDiagnostics = (sourceFile as unknown as { parseDiagnostics?: ts.Diagnostic[] })
      .parseDiagnostics;

    if (parseDiagnostics && parseDiagnostics.length > 0) {
      const firstError = parseDiagnostics[0];
      const message = ts.flattenDiagnosticMessageText(firstError.messageText, '\n');

      drifts.push({
        type: 'example-syntax-error',
        target: `example[${i}]`,
        issue: `@example contains invalid syntax: ${message}`,
        suggestion: 'Check for missing brackets, semicolons, or typos.',
      });
    }
  }

  return drifts;
}

/**
 * Detect runtime errors in @example blocks.
 * Results are provided externally after running examples via runExamples().
 */
export function detectExampleRuntimeErrors(
  entry: SpecExport,
  runtimeResults: Map<number, ExampleRunResult>,
): SpecDocDrift[] {
  if (!entry.examples || entry.examples.length === 0 || runtimeResults.size === 0) {
    return [];
  }

  const drifts: SpecDocDrift[] = [];

  for (let i = 0; i < entry.examples.length; i++) {
    const result = runtimeResults.get(i);
    if (!result || result.success) {
      continue;
    }

    // Extract meaningful error message
    const errorMessage = extractErrorMessage(result.stderr);
    const isTimeout = result.stderr.includes('timed out');

    drifts.push({
      type: 'example-runtime-error',
      target: `example[${i}]`,
      issue: isTimeout
        ? `@example timed out after ${result.duration}ms.`
        : `@example throws at runtime: ${errorMessage}`,
      suggestion: isTimeout
        ? 'Check for infinite loops or long-running operations.'
        : 'Fix the example code or update it to match the current API.',
    });
  }

  return drifts;
}

function extractErrorMessage(stderr: string): string {
  // Try to extract just the error message, not the full stack trace
  const lines = stderr.split('\n').filter((line) => line.trim());
  if (lines.length === 0) {
    return 'Unknown error';
  }

  // Look for common error patterns
  for (const line of lines) {
    const errorMatch = line.match(/^(?:Error|TypeError|ReferenceError|SyntaxError):\s*(.+)/);
    if (errorMatch) {
      return errorMatch[0];
    }
  }

  // Return first non-empty line, truncated
  const firstLine = lines[0] ?? 'Unknown error';
  return firstLine.length > 100 ? `${firstLine.slice(0, 100)}...` : firstLine;
}

function detectAsyncMismatch(entry: SpecExport): SpecDocDrift[] {
  const signatures = entry.signatures ?? [];
  if (signatures.length === 0) {
    return [];
  }

  const drifts: SpecDocDrift[] = [];

  // Check if any signature returns a Promise
  const returnsPromise = signatures.some((sig) => {
    const returnType = extractTypeFromSchema(sig.returns?.schema) ?? '';
    return returnType.startsWith('Promise<') || returnType === 'Promise';
  });

  // Check if @returns documents Promise
  const returnsTag = entry.tags?.find((tag) => tag.name === 'returns' || tag.name === 'return');
  const documentedAsPromise = returnsTag?.text?.includes('Promise') ?? false;

  // Check if @async tag is present
  const hasAsyncTag = entry.tags?.some((tag) => tag.name === 'async');

  // Check flags for async
  const isAsyncFunction = (entry as { flags?: { async?: boolean } }).flags?.async === true;

  // Case 1: Returns Promise but not documented as async/Promise
  if (returnsPromise && !documentedAsPromise && !hasAsyncTag) {
    drifts.push({
      type: 'async-mismatch',
      target: 'returns',
      issue: 'Function returns Promise but documentation does not indicate async behavior.',
      suggestion: 'Add @async tag or document @returns {Promise<...>}.',
    });
  }

  // Case 2: Documented as async but doesn't return Promise
  if (!returnsPromise && (documentedAsPromise || hasAsyncTag) && !isAsyncFunction) {
    drifts.push({
      type: 'async-mismatch',
      target: 'returns',
      issue: 'Documentation indicates async but function does not return Promise.',
      suggestion: 'Remove @async tag or update @returns type.',
    });
  }

  return drifts;
}

type SpecMemberWithType = {
  id?: string;
  name?: string;
  kind?: string;
  tags?: SpecTag[];
  schema?: SpecSchema;
};

function detectPropertyTypeDrift(entry: SpecExport): SpecDocDrift[] {
  const members = entry.members ?? [];
  if (members.length === 0) {
    return [];
  }

  const drifts: SpecDocDrift[] = [];

  for (const member of members) {
    const typedMember = member as SpecMemberWithType;
    if (typedMember.kind !== 'property') continue;

    // Find @type tag in member tags
    const typeTag = typedMember.tags?.find((tag) => tag.name === 'type');
    if (!typeTag?.text) continue;

    // Extract documented type from @type {Type}
    const documentedType = extractTypeFromBraces(typeTag.text);
    if (!documentedType) continue;

    // Get actual type from schema
    const actualType = extractTypeFromSchema(typedMember.schema);
    if (!actualType) continue;

    // Compare (using existing normalizeType and typesEquivalent)
    const normalizedDoc = normalizeType(documentedType);
    const normalizedActual = normalizeType(actualType);

    if (!normalizedDoc || !normalizedActual) continue;

    if (!typesEquivalent(normalizedDoc, normalizedActual)) {
      const memberName = typedMember.name ?? typedMember.id ?? 'property';
      drifts.push({
        type: 'property-type-drift',
        target: memberName,
        issue: `Property "${memberName}" documented as {${documentedType}} but actual type is ${actualType}.`,
        suggestion: `Update @type {${actualType}} to match the declaration.`,
      });
    }
  }

  return drifts;
}

function extractTypeFromBraces(text: string): string | undefined {
  const match = text.match(/^\{([^}]+)\}/);
  return match?.[1]?.trim();
}

/**
 * Parse assertion comments from example code.
 * Matches: // => expected_value
 */
export function parseAssertions(code: string): Array<{ lineNumber: number; expected: string }> {
  const assertions: Array<{ lineNumber: number; expected: string }> = [];

  // Strip markdown code block markers
  const cleanCode = code
    .replace(/^```(?:ts|typescript|js|javascript)?\n?/i, '')
    .replace(/\n?```$/i, '')
    .trim();

  const lines = cleanCode.split('\n');
  const assertionPattern = /\/\/\s*=>\s*(.+?)\s*$/;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(assertionPattern);
    if (match?.[1]) {
      assertions.push({
        lineNumber: i + 1,
        expected: match[1].trim(),
      });
    }
  }

  return assertions;
}

/**
 * Check if code contains comments that are not assertion syntax.
 * Used to determine if LLM fallback should be attempted.
 */
export function hasNonAssertionComments(code: string): boolean {
  // Check for any // comments that are not // =>
  return /\/\/(?!\s*=>)/.test(code);
}

/**
 * Detect assertion failures by comparing stdout to expected values.
 */
export function detectExampleAssertionFailures(
  entry: SpecExport,
  runtimeResults: Map<number, ExampleRunResult>,
): SpecDocDrift[] {
  if (!entry.examples || entry.examples.length === 0 || runtimeResults.size === 0) {
    return [];
  }

  const drifts: SpecDocDrift[] = [];

  for (let i = 0; i < entry.examples.length; i++) {
    const example = entry.examples[i];
    const result = runtimeResults.get(i);

    // Only check assertions if example ran successfully
    if (!result || !result.success || typeof example !== 'string') {
      continue;
    }

    const assertions = parseAssertions(example);
    if (assertions.length === 0) {
      continue;
    }

    // Parse stdout into lines (normalized)
    const stdoutLines = result.stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    // Compare each assertion with corresponding stdout line
    for (let j = 0; j < assertions.length; j++) {
      const assertion = assertions[j];
      const actual = stdoutLines[j];

      if (actual === undefined) {
        drifts.push({
          type: 'example-assertion-failed',
          target: `example[${i}]:line${assertion.lineNumber}`,
          issue: `Assertion expected "${assertion.expected}" but no output was produced`,
          suggestion: 'Ensure the example produces output for each assertion',
        });
        continue;
      }

      // Normalized comparison (trim whitespace)
      if (assertion.expected.trim() !== actual.trim()) {
        drifts.push({
          type: 'example-assertion-failed',
          target: `example[${i}]:line${assertion.lineNumber}`,
          issue: `Assertion failed: expected "${assertion.expected}" but got "${actual}"`,
          suggestion: `Update assertion to: // => ${actual}`,
        });
      }
    }
  }

  return drifts;
}

// ─────────────────────────────────────────────────────────────────────────────
// Drift Categorization Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extended drift with category and fixability metadata.
 */
export interface CategorizedDrift extends SpecDocDrift {
  category: DriftCategory;
  fixable: boolean;
}

/**
 * Categorize a single drift issue.
 *
 * @param drift - The drift to categorize
 * @returns The drift with category and fixable metadata
 *
 * @example
 * ```ts
 * const drift: SpecDocDrift = {
 *   type: 'param-type-mismatch',
 *   target: 'userId',
 *   issue: 'Type mismatch'
 * };
 * const categorized = categorizeDrift(drift);
 * console.log(categorized.category); // => 'structural'
 * console.log(categorized.fixable);  // => true
 * ```
 */
export function categorizeDrift(drift: SpecDocDrift): CategorizedDrift {
  return {
    ...drift,
    category: DRIFT_CATEGORIES[drift.type],
    fixable: isFixableDrift(drift),
  };
}

/**
 * Group drifts by category.
 *
 * @param drifts - Array of drift issues to group
 * @returns Drifts organized by category
 *
 * @example
 * ```ts
 * const grouped = groupDriftsByCategory(spec.docs.drift ?? []);
 * console.log(grouped.structural.length); // Number of structural issues
 * console.log(grouped.semantic.length);   // Number of semantic issues
 * console.log(grouped.example.length);    // Number of example issues
 * ```
 */
export function groupDriftsByCategory(
  drifts: SpecDocDrift[],
): Record<DriftCategory, CategorizedDrift[]> {
  const grouped: Record<DriftCategory, CategorizedDrift[]> = {
    structural: [],
    semantic: [],
    example: [],
  };

  for (const drift of drifts) {
    const categorized = categorizeDrift(drift);
    grouped[categorized.category].push(categorized);
  }

  return grouped;
}

/**
 * Summary of drift issues by category.
 */
export interface DriftSummary {
  total: number;
  byCategory: Record<DriftCategory, number>;
  fixable: number;
}

/**
 * Get drift summary counts by category.
 *
 * @param drifts - Array of drift issues
 * @returns Summary with totals, category breakdown, and fixable count
 *
 * @example
 * ```ts
 * const summary = getDriftSummary(exportEntry.docs?.drift ?? []);
 * console.log(`${summary.total} issues: ${summary.fixable} fixable`);
 * // => "5 issues: 3 fixable"
 * ```
 */
export function getDriftSummary(drifts: SpecDocDrift[]): DriftSummary {
  const grouped = groupDriftsByCategory(drifts);

  return {
    total: drifts.length,
    byCategory: {
      structural: grouped.structural.length,
      semantic: grouped.semantic.length,
      example: grouped.example.length,
    },
    fixable: drifts.filter((d) => isFixableDrift(d)).length,
  };
}

/**
 * Format drift summary for CLI output (single line).
 *
 * @param summary - Drift summary to format
 * @returns Human-readable summary string
 *
 * @example
 * ```ts
 * const summary = getDriftSummary(drifts);
 * console.log(formatDriftSummaryLine(summary));
 * // => "5 issues (3 structural, 1 semantic, 1 example)"
 * ```
 */
export function formatDriftSummaryLine(summary: DriftSummary): string {
  if (summary.total === 0) {
    return 'No drift detected';
  }

  const parts: string[] = [];

  if (summary.byCategory.structural > 0) {
    parts.push(`${summary.byCategory.structural} structural`);
  }
  if (summary.byCategory.semantic > 0) {
    parts.push(`${summary.byCategory.semantic} semantic`);
  }
  if (summary.byCategory.example > 0) {
    parts.push(`${summary.byCategory.example} example`);
  }

  const fixableNote = summary.fixable > 0 ? ` (${summary.fixable} auto-fixable)` : '';

  return `${summary.total} issues (${parts.join(', ')})${fixableNote}`;
}

/**
 * Calculate aggregate coverage score from a spec's exports.
 *
 * This is a lightweight function that calculates coverage without
 * requiring full quality evaluation. It handles three cases:
 * 1. Exports with `docs.coverageScore` - uses that value
 * 2. Exports without score but with description - counts as 100%
 * 3. Exports without score and no description - counts as 0%
 *
 * @param spec - The OpenPkg spec to calculate coverage for
 * @returns The aggregate coverage score (0-100)
 *
 * @example
 * ```ts
 * import { calculateAggregateCoverage } from '@doccov/sdk';
 *
 * const coverage = calculateAggregateCoverage(spec);
 * console.log(`Coverage: ${coverage}%`);
 * ```
 */
export function calculateAggregateCoverage(spec: OpenPkgSpec): number {
  const exports = spec.exports ?? [];
  if (exports.length === 0) return 100;

  let totalScore = 0;

  for (const exp of exports) {
    // Use existing coverage score if available
    const score = exp.docs?.coverageScore;
    if (score !== undefined) {
      totalScore += score;
    } else {
      // Fall back to description-based check
      totalScore += exp.description ? 100 : 0;
    }
  }

  return Math.round(totalScore / exports.length);
}

/**
 * Ensure a spec has a top-level docs.coverageScore.
 *
 * If the spec already has `docs.coverageScore`, returns the spec unchanged.
 * Otherwise, calculates aggregate coverage from exports and returns a
 * new spec with the coverage score added.
 *
 * This is useful for commands like `diff` that need coverage scores
 * but may receive raw specs that haven't been enriched.
 *
 * @param spec - The OpenPkg spec to ensure coverage for
 * @returns The spec with guaranteed top-level coverage score
 *
 * @example
 * ```ts
 * import { ensureSpecCoverage } from '@doccov/sdk';
 *
 * // Works with raw or enriched specs
 * const specWithCoverage = ensureSpecCoverage(rawSpec);
 * console.log(specWithCoverage.docs?.coverageScore); // e.g., 85
 * ```
 */
export function ensureSpecCoverage(
  spec: OpenPkgSpec,
): OpenPkgSpec & { docs: { coverageScore: number } } {
  type SpecWithDocs = OpenPkgSpec & { docs?: { coverageScore?: number } };
  const specWithDocs = spec as SpecWithDocs;

  // Already has top-level coverage
  if (specWithDocs.docs?.coverageScore !== undefined) {
    return spec as OpenPkgSpec & { docs: { coverageScore: number } };
  }

  // Calculate and add coverage
  const coverage = calculateAggregateCoverage(spec);
  return {
    ...spec,
    docs: {
      ...(specWithDocs.docs ?? {}),
      coverageScore: coverage,
    },
  } as OpenPkgSpec & { docs: { coverageScore: number } };
}
