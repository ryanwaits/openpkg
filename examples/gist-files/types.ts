// types.ts - Type definitions
export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Post {
  id: string;
  author: User;
  content: string;
  createdAt: string;
  likes: number;
}