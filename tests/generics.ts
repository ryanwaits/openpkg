interface User {
  id: string;
  name: string;
  email: string;
}

export type PartialUser = Partial<User>;
