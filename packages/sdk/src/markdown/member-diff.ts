/**
 * Member-level diff detection for classes
 *
 * Compares class members (methods, properties) between spec versions
 * to identify granular changes like method additions/removals
 */

import type { OpenPkg, SpecExport, SpecMember, SpecSchema, SpecSignature } from '@openpkg-ts/spec';

export type MemberChangeType = 'added' | 'removed' | 'signature-changed';

export interface MemberChange {
  /** The class this member belongs to */
  className: string;
  /** The member name (e.g., "evaluateChainhook") */
  memberName: string;
  /** Kind of member */
  memberKind: 'method' | 'property' | 'accessor' | 'constructor';
  /** Type of change */
  changeType: MemberChangeType;
  /** Old signature string (for signature changes) */
  oldSignature?: string;
  /** New signature string (for signature changes) */
  newSignature?: string;
  /** Suggested replacement (e.g., "Use replayChainhook instead") */
  suggestion?: string;
}

/**
 * Diff class members between old and new specs
 *
 * @param oldSpec - Previous version of the spec
 * @param newSpec - Current version of the spec
 * @param changedClassNames - Names of classes/interfaces that changed
 * @returns Array of member-level changes
 */
export function diffMemberChanges(
  oldSpec: OpenPkg,
  newSpec: OpenPkg,
  changedClassNames: string[],
): MemberChange[] {
  const changes: MemberChange[] = [];

  const oldExportMap = toExportMap(oldSpec.exports ?? []);
  const newExportMap = toExportMap(newSpec.exports ?? []);

  for (const className of changedClassNames) {
    const oldExport = oldExportMap.get(className);
    const newExport = newExportMap.get(className);

    // Skip if not a class/interface with members
    if (!oldExport?.members && !newExport?.members) {
      continue;
    }

    const oldMembers = toMemberMap(oldExport?.members ?? []);
    const newMembers = toMemberMap(newExport?.members ?? []);

    // First, find added members (in new but not in old) - needed for suggestions
    const addedMemberNames: string[] = [];
    for (const [memberName, newMember] of newMembers) {
      if (!oldMembers.has(memberName)) {
        addedMemberNames.push(memberName);
        changes.push({
          className,
          memberName,
          memberKind: getMemberKind(newMember),
          changeType: 'added',
          newSignature: formatSignature(newMember),
        });
      }
    }

    // Find removed members (in old but not in new)
    for (const [memberName, oldMember] of oldMembers) {
      if (!newMembers.has(memberName)) {
        const suggestion = findSimilarMember(memberName, newMembers, addedMemberNames);
        changes.push({
          className,
          memberName,
          memberKind: getMemberKind(oldMember),
          changeType: 'removed',
          oldSignature: formatSignature(oldMember),
          suggestion,
        });
      }
    }

    // Find signature changes (in both but different)
    for (const [memberName, oldMember] of oldMembers) {
      const newMember = newMembers.get(memberName);
      if (newMember && hasSignatureChanged(oldMember, newMember)) {
        changes.push({
          className,
          memberName,
          memberKind: getMemberKind(newMember),
          changeType: 'signature-changed',
          oldSignature: formatSignature(oldMember),
          newSignature: formatSignature(newMember),
        });
      }
    }
  }

  return deduplicateMemberChanges(changes);
}

/**
 * Remove duplicate member changes (same class, member, and change type)
 */
function deduplicateMemberChanges(changes: MemberChange[]): MemberChange[] {
  const seen = new Set<string>();
  return changes.filter((mc) => {
    const key = `${mc.className}:${mc.memberName}:${mc.changeType}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Build a map of exports by name
 */
function toExportMap(exports: SpecExport[]): Map<string, SpecExport> {
  const map = new Map<string, SpecExport>();
  for (const exp of exports) {
    if (exp?.name) {
      map.set(exp.name, exp);
    }
  }
  return map;
}

/**
 * Build a map of members by name
 */
function toMemberMap(members: SpecMember[]): Map<string, SpecMember> {
  const map = new Map<string, SpecMember>();
  for (const member of members) {
    if (member?.name) {
      map.set(member.name, member);
    }
  }
  return map;
}

/**
 * Get the kind of member for display
 */
function getMemberKind(member: SpecMember): MemberChange['memberKind'] {
  switch (member.kind) {
    case 'method':
      return 'method';
    case 'property':
      return 'property';
    case 'accessor':
      return 'accessor';
    case 'constructor':
      return 'constructor';
    default:
      return 'method';
  }
}

/**
 * Format a member signature for display with parameter types
 */
function formatSignature(member: SpecMember): string {
  if (!member.signatures?.length) {
    return member.name ?? '';
  }

  const sig = member.signatures[0];
  const params =
    sig.parameters?.map((p) => {
      const optional = p.required === false ? '?' : '';
      const typeName = extractTypeName(p.schema);
      return typeName ? `${p.name}${optional}: ${typeName}` : `${p.name}${optional}`;
    }) ?? [];

  return `${member.name}(${params.join(', ')})`;
}

/**
 * Extract a short type name from a schema for display
 */
function extractTypeName(schema: SpecSchema): string | undefined {
  if (!schema || typeof schema !== 'object') {
    return undefined;
  }

  const s = schema as Record<string, unknown>;

  // Handle $ref (e.g., "#/types/User" -> "User")
  if (typeof s.$ref === 'string') {
    const parts = s.$ref.split('/');
    return parts[parts.length - 1];
  }

  // Handle primitive types
  if (typeof s.type === 'string') {
    return s.type;
  }

  // Handle tsType if available
  if (typeof s.tsType === 'string') {
    // Shorten long type names
    const tsType = s.tsType as string;
    if (tsType.length > 30) {
      return `${tsType.slice(0, 27)}...`;
    }
    return tsType;
  }

  return undefined;
}

/**
 * Check if a member's signature has changed
 */
function hasSignatureChanged(oldMember: SpecMember, newMember: SpecMember): boolean {
  // Compare signatures
  const oldSigs = oldMember.signatures ?? [];
  const newSigs = newMember.signatures ?? [];

  if (oldSigs.length !== newSigs.length) {
    return true;
  }

  for (let i = 0; i < oldSigs.length; i++) {
    if (!signaturesEqual(oldSigs[i], newSigs[i])) {
      return true;
    }
  }

  return false;
}

/**
 * Compare two signatures for equality
 */
function signaturesEqual(a: SpecSignature, b: SpecSignature): boolean {
  const aParams = a.parameters ?? [];
  const bParams = b.parameters ?? [];

  if (aParams.length !== bParams.length) {
    return false;
  }

  for (let i = 0; i < aParams.length; i++) {
    const ap = aParams[i];
    const bp = bParams[i];

    if (ap.name !== bp.name) return false;
    if (ap.required !== bp.required) return false;
    // Compare schema types if available
    if (JSON.stringify(ap.schema) !== JSON.stringify(bp.schema)) return false;
  }

  // Compare return types
  if (JSON.stringify(a.returns) !== JSON.stringify(b.returns)) {
    return false;
  }

  return true;
}

/**
 * Find a similar member name in the new members (for suggestions)
 * Uses word matching and Levenshtein distance
 */
function findSimilarMember(
  removedName: string,
  newMembers: Map<string, SpecMember>,
  addedMembers: string[],
): string | undefined {
  // Prioritize newly added members as replacements
  const candidates = addedMembers.length > 0 ? addedMembers : Array.from(newMembers.keys());

  let bestMatch: string | undefined;
  let bestScore = 0;

  for (const name of candidates) {
    // Skip if same name
    if (name === removedName) continue;

    // Check for common patterns
    // e.g., "evaluateChainhook" -> "replayChainhook" (same suffix)
    const removedWords = splitCamelCase(removedName);
    const newWords = splitCamelCase(name);

    // Count matching words (weighted by position - suffix matches are better)
    let matchingWords = 0;
    let suffixMatch = false;

    // Check if they share a suffix (most important for API replacements)
    if (removedWords.length > 0 && newWords.length > 0) {
      const removedSuffix = removedWords[removedWords.length - 1];
      const newSuffix = newWords[newWords.length - 1];
      if (removedSuffix === newSuffix) {
        suffixMatch = true;
        matchingWords += 2; // Weight suffix matches heavily
      }
    }

    // Count other matching words
    for (const word of removedWords) {
      if (newWords.includes(word)) {
        matchingWords++;
      }
    }

    const wordScore = matchingWords / Math.max(removedWords.length, newWords.length);

    // Levenshtein distance for overall similarity
    const editDistance = levenshteinDistance(removedName.toLowerCase(), name.toLowerCase());
    const maxLen = Math.max(removedName.length, name.length);
    const levenScore = 1 - editDistance / maxLen;

    // Combined score (suffix match is most important)
    const totalScore = suffixMatch ? wordScore * 1.5 + levenScore : wordScore + levenScore * 0.5;

    if (totalScore > bestScore && totalScore >= 0.5) {
      bestScore = totalScore;
      bestMatch = name;
    }
  }

  return bestMatch ? `Use ${bestMatch} instead` : undefined;
}

/**
 * Simple Levenshtein distance implementation
 */
function levenshteinDistance(a: string, b: string): number {
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
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Split camelCase/PascalCase into words
 */
function splitCamelCase(str: string): string[] {
  return str
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(' ');
}

/**
 * Get all member changes for a specific class
 */
export function getMemberChangesForClass(
  changes: MemberChange[],
  className: string,
): MemberChange[] {
  return changes.filter((c) => c.className === className);
}

/**
 * Check if any member was removed
 */
export function hasRemovedMembers(changes: MemberChange[]): boolean {
  return changes.some((c) => c.changeType === 'removed');
}

/**
 * Check if any member was added
 */
export function hasAddedMembers(changes: MemberChange[]): boolean {
  return changes.some((c) => c.changeType === 'added');
}
