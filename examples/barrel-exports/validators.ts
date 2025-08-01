// validators.ts - Named exports for selective re-export
import { User, Post } from './models';
import { ValidationResult } from './types';

export function validateUser(user: User): ValidationResult {
  return {
    valid: !!user.email && !!user.username,
    errors: []
  };
}

export function validatePost(post: Post): ValidationResult {
  return {
    valid: !!post.title && !!post.content,
    errors: []
  };
}

// This won't be re-exported by index.ts
export function internalValidation(): void {
  console.log('Internal only');
}