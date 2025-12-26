import type { DriftCategory, SpecDocDrift, SpecSchema, SpecTag } from '@openpkg-ts/spec';

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
 * Parsed @param tag from JSDoc.
 */
export type ParsedParamTag = {
  name?: string;
  type?: string;
  isOptional?: boolean;
};

/**
 * Parsed @template tag from JSDoc.
 */
export type DocumentedTemplateTag = {
  name: string;
  constraint?: string;
};

/**
 * Visibility from TypeScript code.
 */
export type CodeVisibility = 'public' | 'protected' | 'private';

/**
 * Visibility from JSDoc tags.
 */
export type DocVisibility = 'internal' | 'protected' | 'private' | 'public';

/**
 * Signal of visibility from JSDoc.
 */
export type DocVisibilitySignal = {
  value: DocVisibility;
  tagName: string;
};

/**
 * Spec member with visibility info.
 */
export type SpecMemberWithVisibility = {
  id?: string;
  name?: string;
  visibility?: CodeVisibility;
  tags?: SpecTag[];
  kind?: string;
};

/**
 * Spec member with type info.
 */
export type SpecMemberWithType = {
  id?: string;
  name?: string;
  kind?: string;
  tags?: SpecTag[];
  schema?: SpecSchema;
};

/**
 * Extended drift with category and fixability metadata.
 */
export interface CategorizedDrift extends SpecDocDrift {
  category: DriftCategory;
  fixable: boolean;
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
 * Match result from fuzzy matching.
 */
export type ClosestMatch = {
  value: string;
  distance: number;
};
