// Advanced TypeScript types to test Phase 2 capabilities

// 1. Utility Types
interface User {
  id: string;
  name: string;
  email: string;
  profile: {
    bio: string;
    avatar?: string;
  };
}

export type PartialUser = Partial<User>;
export type RequiredUser = Required<User>;
export type UserBasic = Pick<User, 'id' | 'name'>;
export type UserWithoutEmail = Omit<User, 'email'>;

// 2. Mapped Types
type Readonly<T> = {
  readonly [P in keyof T]: T[P];
};

export type ReadonlyUser = Readonly<User>;

// 3. Conditional Types
type IsArray<T> = T extends any[] ? true : false;
type ExtractArrayElement<T> = T extends (infer U)[] ? U : never;

export type TestArray = IsArray<string[]>; // should be true
export type ElementType = ExtractArrayElement<number[]>; // should be number

// 4. Complex Generic Types
export type AsyncData<T> = Promise<{
  data: T;
  error: Error | null;
  loading: boolean;
}>;

export type UserResponse = AsyncData<User>;

// 5. Tuple Types
export type Coordinates = [number, number, number?];
export type UserTuple = [id: string, name: string, age: number];

// 6. Union and Intersection Types
export type Status = 'pending' | 'approved' | 'rejected';
export type ExtendedUser = User & { role: 'admin' | 'user'; lastLogin: Date };

// 7. Index Signatures
interface StringDictionary {
  [key: string]: string;
}

interface ConfigOptions extends StringDictionary {
  apiUrl: string;
  timeout: string;
}

// 8. Class with Inheritance
class Animal {
  name: string;
  protected age: number;
  
  constructor(name: string, age: number) {
    this.name = name;
    this.age = age;
  }
  
  speak(): void {
    console.log(`${this.name} makes a sound`);
  }
}

export class Dog extends Animal {
  breed: string;
  
  constructor(name: string, age: number, breed: string) {
    super(name, age);
    this.breed = breed;
  }
  
  bark(): void {
    console.log('Woof!');
  }
}

// 9. Interface with Methods
export interface Calculator {
  add(a: number, b: number): number;
  subtract(x: number, y: number): number;
  multiply<T extends number>(factor1: T, factor2: T): T;
  divideAsync(dividend: number, divisor: number): Promise<number>;
}

// 10. Namespace
export namespace MathUtils {
  export const PI = 3.14159;
  
  export interface Point {
    x: number;
    y: number;
  }
  
  export function distance(p1: Point, p2: Point): number {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  }
}

// 11. Type with Recursive Reference
interface TreeNode<T> {
  value: T;
  left?: TreeNode<T>;
  right?: TreeNode<T>;
}

export type BinaryTree = TreeNode<number>;

// 12. Complex Nested Generics
export type Matrix<T> = Array<Array<T>>;
export type Tensor3D<T> = Array<Array<Array<T>>>;

// 13. Template Literal Types (if supported)
type Greeting<T extends string> = `Hello, ${T}!`;
export type HelloWorld = Greeting<'World'>;