import type { SpecDocSignal, SpecDocsMetadata, SpecExport } from '@openpkg-ts/spec';
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
  const drift = detectParamDrift(entry);

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

function detectParamDrift(entry: SpecExport): NonNullable<SpecDocsMetadata['drift']> {
  const drifts: NonNullable<SpecDocsMetadata['drift']> = [];
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
    .map((tag) => {
      const [first] = tag.text.trim().split(/\s+/);
      return first ?? '';
    })
    .filter((name) => name.length > 0);

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
      suggestion: suggestion?.distance !== undefined && suggestion.distance <= 3 ? suggestion.value : undefined,
    });
  }

  return drifts;
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
