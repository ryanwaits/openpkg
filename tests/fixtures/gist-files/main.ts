// main.ts - Blog API Example
import type { Post, User } from './types';
import { formatDate, generateId } from './utils';

/**
 * Creates a new blog post
 */
export function createPost(author: User, content: string): Post {
  return {
    id: generateId(),
    author,
    content,
    createdAt: formatDate(new Date()),
    likes: 0,
  };
}

/**
 * Gets posts by user ID
 */
export function getPostsByUser(posts: Post[], userId: string): Post[] {
  return posts.filter((post) => post.author.id === userId);
}
