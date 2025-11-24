import type {
  SpecDocDrift,
  SpecDocSignal,
  SpecDocsMetadata,
  SpecExport,
  SpecSchema,
} from '@openpkg-ts/spec';
import type { OpenPkgSpec } from './spec-types';

type ExportCoverageResult = {
  id: string;
  docs: SpecDocsMetadata;
};

export type DocsCoverageResult = {
  spec: SpecDocsMetadata;
  exports: Map<string, SpecDocsMetadata>;
};

const DOC_SECTIONS: SpecDocSignal[] = ['description', 'params', 'returns', 'examples'];
const SECTION_WEIGHT = 100 / DOC_SECTIONS.length;

export function computeDocsCoverage(spec: OpenPkgSpec): DocsCoverageResult {
  const coverageByExport = new Map<string, SpecDocsMetadata>();

  let aggregateScore = 0;
  let processed = 0;

  for (const entry of spec.exports ?? []) {
    const coverage = evaluateExport(entry);
    coverageByExport.set(entry.id ?? entry.name, coverage.docs);
    aggregateScore += coverage.docs.coverageScore ?? 0;
    processed += 1;
  }

  const specCoverageScore = processed === 0 ? 100 : Math.round(aggregateScore / processed);

  return {
    spec: { coverageScore: specCoverageScore },
    exports: coverageByExport,
  };
}

function evaluateExport(entry: SpecExport): ExportCoverageResult {
  const missing: SpecDocSignal[] = [];
  const drift = [
    ...detectParamDrift(entry),
    ...detectParamTypeDrift(entry),
    ...detectReturnTypeDrift(entry),
    ...detectGenericConstraintDrift(entry),
  ];

  if (!hasDescription(entry)) {
    missing.push('description');
  }

  if (!paramsDocumented(entry)) {
    missing.push('params');
  }

  if (!returnsDocumented(entry)) {
    missing.push('returns');
  }

  if (!hasExamples(entry)) {
    missing.push('examples');
  }

  const satisfied = DOC_SECTIONS.length - missing.length;
  const coverageScore = Math.max(0, Math.round(satisfied * SECTION_WEIGHT));

  return {
    id: entry.id,
    docs: {
      coverageScore,
      missing: missing.length > 0 ? missing : undefined,
      drift: drift.length > 0 ? drift : undefined,
    },
  };
}

function hasDescription(entry: SpecExport): boolean {
  return Boolean(entry.description && entry.description.trim().length > 0);
}

function paramsDocumented(entry: SpecExport): boolean {
  const parameters = (entry.signatures ?? []).flatMap((signature) => signature.parameters ?? []);
  if (parameters.length === 0) {
    return true;
  }

  return parameters.every((param) =>
    Boolean(param.description && param.description.trim().length > 0),
  );
}

function returnsDocumented(entry: SpecExport): boolean {
  const signatures = entry.signatures ?? [];
  if (signatures.length === 0) {
    return true;
  }

  // If every return block lacks a description, mark as missing
  return signatures.every((signature) => {
    const text = signature.returns?.description;
    return Boolean(text && text.trim().length > 0);
  });
}

function hasExamples(entry: SpecExport): boolean {
  return Array.isArray(entry.examples) && entry.examples.length > 0;
}

function detectParamDrift(entry: SpecExport): SpecDocDrift[] {
  const drifts: SpecDocDrift[] = [];
  const signatures = entry.signatures ?? [];
  if (signatures.length === 0) {
    return drifts;
  }

  const actualParamNames = new Set<string>();
  for (const signature of signatures) {
    for (const param of signature.parameters ?? []) {
      if (param.name) {
        actualParamNames.add(param.name);
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
    if (actualParamNames.has(documentedName)) {
      continue;
    }

    const suggestion = findClosestMatch(documentedName, Array.from(actualParamNames));

    drifts.push({
      type: 'param-mismatch',
      target: documentedName,
      issue: `JSDoc documents parameter "${documentedName}" which is not present in the signature.`,
      suggestion:
        suggestion?.distance !== undefined && suggestion.distance <= 3
          ? suggestion.value
          : undefined,
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
      (parsed): parsed is { name: string; type?: string } =>
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

  const declaredRaw = signatureReturn.tsType ?? extractTypeFromSchema(signatureReturn.schema);
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

function extractParamFromTag(text: string): { name?: string; type?: string } | undefined {
  const trimmed = text.trim();
  if (!trimmed) {
    return undefined;
  }

  const match = trimmed.match(/^(?:\{([^}]+)\}\s+)?(\S+)(?:\s+-\s+)?/);
  if (!match) {
    return undefined;
  }

  const [, type, rawName] = match;
  const name = normalizeParamName(rawName);

  if (!name) {
    return undefined;
  }

  return {
    name,
    type: type?.trim(),
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

  const braceMatch = trimmed.match(/^\{([^}]+)\}/);
  if (braceMatch) {
    return braceMatch[1]?.trim();
  }

  const [first] = trimmed.split(/\s+/);
  return first?.trim();
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

function findClosestMatch(
  source: string,
  candidates: string[],
): { value: string; distance: number } | undefined {
  if (candidates.length === 0) {
    return undefined;
  }

  const normalizedSource = source.toLowerCase();
  const substringCandidate = candidates.find((candidate) => {
    const normalizedCandidate = candidate.toLowerCase();
    return (
      normalizedCandidate.includes(normalizedSource) ||
      normalizedSource.includes(normalizedCandidate)
    );
  });

  if (substringCandidate && substringCandidate !== source) {
    return { value: substringCandidate, distance: 0 };
  }

  let best: { value: string; distance: number } | undefined;

  for (const candidate of candidates) {
    const distance = levenshtein(source, candidate);
    if (!best || distance < best.distance) {
      best = { value: candidate, distance };
    }
  }

  return best;
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
