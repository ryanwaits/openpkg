export * from './constants';
export { dereference } from './deref';
export {
  categorizeBreakingChanges,
  diffSpec,
  type BreakingSeverity,
  type CategorizedBreaking,
  type MemberChangeInfo,
  type SpecDiff,
} from './diff';
export { normalize } from './normalize';
export * from './types';
export { assertSpec, getValidationErrors, validateSpec } from './validate';
