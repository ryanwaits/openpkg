// services.ts - More exports for barrel
import type { Post, User } from './models';

export class UserService {
  getUser(id: string): User | null {
    // Mock implementation
    return null;
  }
}

export class PostService {
  getPost(id: string): Post | null {
    // Mock implementation
    return null;
  }
}
