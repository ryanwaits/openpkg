// models.ts - Exports that will be re-exported
export interface User {
  id: string;
  username: string;
  email: string;
}

export interface Post {
  id: string;
  title: string;
  content: string;
  authorId: string;
}

export class UserModel {
  constructor(private user: User) {}

  getFullName(): string {
    return this.user.username;
  }
}
