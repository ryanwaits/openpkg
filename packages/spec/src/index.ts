export * from './constants';
export { dereference } from './deref';
export {
  type BreakingSeverity,
  type CategorizedBreaking,
  calculateNextVersion,
  categorizeBreakingChanges,
  diffSpec,
  type MemberChangeInfo,
  recommendSemverBump,
  type SemverBump,
  type SemverRecommendation,
  type SpecDiff,
} from './diff';
export { normalize } from './normalize';
export * from './types';
export { assertSpec, getValidationErrors, validateSpec } from './validate';
