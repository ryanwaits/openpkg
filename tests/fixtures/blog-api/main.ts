import type { Post, User } from './types';
import { formatDate, generateId } from './utils';

/**
 * Creates a new blog post for a user
 * @param author - The user creating the post
 * @param content - The post content
 * @returns The created post with generated ID and timestamp
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
 * Gets all posts by a specific user
 * @param posts - Array of all posts
 * @param userId - The user ID to filter by
 * @returns Array of posts by the specified user
 */
export function getPostsByUser(posts: Post[], userId: string): Post[] {
  return posts.filter((post) => post.author.id === userId);
}

/**
 * Increments the like count for a post
 * @param post - The post to like
 * @returns The post with updated like count
 */
export function likePost(post: Post): Post {
  return {
    ...post,
    likes: post.likes + 1,
  };
}
