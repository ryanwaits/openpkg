/**
 * Represents a user in the blog system
 */
export interface User {
  /** Unique identifier */
  id: string;
  /** User's display name */
  name: string;
  /** User's email address */
  email: string;
  /** User's role in the system */
  role: 'admin' | 'user';
}

/**
 * Represents a blog post
 */
export interface Post {
  /** Unique post identifier */
  id: string;
  /** The user who created the post */
  author: User;
  /** The post content */
  content: string;
  /** ISO timestamp of when the post was created */
  createdAt: string;
  /** Number of likes on the post */
  likes: number;
}

/**
 * Comment on a blog post
 */
export interface Comment {
  /** Unique comment identifier */
  id: string;
  /** The post this comment belongs to */
  postId: string;
  /** The user who wrote the comment */
  author: User;
  /** The comment text */
  text: string;
  /** ISO timestamp of when the comment was created */
  createdAt: string;
}
