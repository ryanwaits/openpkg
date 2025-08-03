// validators.ts - Named exports for selective re-export
import type { Post, User } from './models';
import type { ValidationResult } from './types';

export function validateUser(user: User): ValidationResult {
  return {
    valid: !!user.email && !!user.username,
    errors: [],
  };
}

export function validatePost(post: Post): ValidationResult {
  return {
    valid: !!post.title && !!post.content,
    errors: [],
  };
}

// This won't be re-exported by index.ts
export function internalValidation(): void {
  console.log('Internal only');
}
