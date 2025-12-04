export * from './constants';
export { dereference } from './deref';
export {
  type BreakingSeverity,
  type CategorizedBreaking,
  categorizeBreakingChanges,
  diffSpec,
  type MemberChangeInfo,
  type SpecDiff,
} from './diff';
export { normalize } from './normalize';
export * from './types';
export { assertSpec, getValidationErrors, validateSpec } from './validate';
