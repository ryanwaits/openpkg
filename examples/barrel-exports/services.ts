// services.ts - More exports for barrel
import { User, Post } from './models';

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