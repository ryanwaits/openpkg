# OpenPkg Examples

This directory contains practical examples of using OpenPkg with various TypeScript patterns.

## Basic Examples

### 1. Simple Interface and Function
```typescript
// simple.ts
export interface User {
  id: string;
  name: string;
  email: string;
}

export function createUser(name: string, email: string): User {
  return {
    id: Math.random().toString(36),
    name,
    email
  };
}
```

Generate spec:
```bash
openpkg examples/simple.ts --output simple-spec.json
```

### 2. Generic Types
```typescript
// generics.ts
export interface Repository<T> {
  items: T[];
  add(item: T): void;
  find(predicate: (item: T) => boolean): T | undefined;
}

export class UserRepository implements Repository<User> {
  items: User[] = [];
  
  add(user: User): void {
    this.items.push(user);
  }
  
  find(predicate: (user: User) => boolean): User | undefined {
    return this.items.find(predicate);
  }
}
```

Generate with resolved types:
```bash
openpkg examples/generics.ts --include-resolved-types
```

### 3. Utility Types
```typescript
// utility-types.ts
export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  inStock: boolean;
}

export type PartialProduct = Partial<Product>;
export type ReadonlyProduct = Readonly<Product>;
export type ProductUpdate = Pick<Product, 'name' | 'price' | 'description'>;
export type ProductPreview = Omit<Product, 'description'>;
```

See expanded utility types:
```bash
openpkg examples/utility-types.ts --include-resolved-types
```

## Advanced Examples

### 4. Complex Type Hierarchies
```typescript
// hierarchy.ts
export interface Entity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Auditable {
  createdBy: string;
  updatedBy: string;
}

export interface User extends Entity, Auditable {
  email: string;
  profile: UserProfile;
}

export interface UserProfile {
  firstName: string;
  lastName: string;
  avatar?: string;
}

export class UserService {
  async findUser(id: string): Promise<User | null> {
    // Implementation
    return null;
  }
}
```

Include type hierarchy:
```bash
openpkg examples/hierarchy.ts --include-type-hierarchy
```

### 5. Conditional Types
```typescript
// conditional.ts
export type IsArray<T> = T extends any[] ? true : false;
export type ElementType<T> = T extends (infer E)[] ? E : never;
export type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;

export type ApiResponse<T> = {
  data: T;
  error: null;
} | {
  data: null;
  error: Error;
};

export function processResponse<T>(
  response: ApiResponse<T>
): T {
  if (response.error) {
    throw response.error;
  }
  return response.data;
}
```

### 6. Mapped Types
```typescript
// mapped.ts
export type Nullable<T> = {
  [P in keyof T]: T[P] | null;
};

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export interface Config {
  api: {
    url: string;
    timeout: number;
  };
  features: {
    auth: boolean;
    analytics: boolean;
  };
}

export type PartialConfig = DeepPartial<Config>;
```

## Real-World Examples

### 7. REST API Client
```typescript
// api-client.ts
export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export type ApiResult<T> = 
  | { success: true; data: T }
  | { success: false; error: ApiError };

export class ApiClient {
  constructor(private baseUrl: string) {}

  async request<T>(
    endpoint: string, 
    options?: RequestOptions
  ): Promise<ApiResult<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, options);
      const data = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          error: {
            code: `HTTP_${response.status}`,
            message: response.statusText,
            details: data
          }
        };
      }
      
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }
}
```

Generate with AI examples:
```bash
openpkg examples/api-client.ts --enhance-with-ai --ai-examples
```

### 8. Event Emitter with Generics
```typescript
// event-emitter.ts
export type EventMap = Record<string, any>;

export type EventKey<T extends EventMap> = string & keyof T;
export type EventReceiver<T> = (params: T) => void;

export interface Emitter<T extends EventMap> {
  on<K extends EventKey<T>>(eventName: K, fn: EventReceiver<T[K]>): void;
  off<K extends EventKey<T>>(eventName: K, fn: EventReceiver<T[K]>): void;
  emit<K extends EventKey<T>>(eventName: K, params: T[K]): void;
}

export class EventEmitter<T extends EventMap> implements Emitter<T> {
  private events = new Map<EventKey<T>, Set<EventReceiver<any>>>();

  on<K extends EventKey<T>>(eventName: K, fn: EventReceiver<T[K]>): void {
    if (!this.events.has(eventName)) {
      this.events.set(eventName, new Set());
    }
    this.events.get(eventName)!.add(fn);
  }

  off<K extends EventKey<T>>(eventName: K, fn: EventReceiver<T[K]>): void {
    this.events.get(eventName)?.delete(fn);
  }

  emit<K extends EventKey<T>>(eventName: K, params: T[K]): void {
    this.events.get(eventName)?.forEach(fn => fn(params));
  }
}

// Usage example
export interface AppEvents {
  login: { userId: string; timestamp: Date };
  logout: { userId: string };
  error: { code: string; message: string };
}

export const appEvents = new EventEmitter<AppEvents>();
```

### 9. State Management
```typescript
// state.ts
export type Action<T = any> = {
  type: string;
  payload?: T;
};

export type Reducer<S, A extends Action> = (state: S, action: A) => S;

export type Middleware<S> = (
  store: Store<S>
) => (
  next: (action: Action) => void
) => (
  action: Action
) => void;

export interface Store<S> {
  getState(): S;
  dispatch(action: Action): void;
  subscribe(listener: () => void): () => void;
}

export function createStore<S, A extends Action>(
  reducer: Reducer<S, A>,
  initialState: S,
  middleware?: Middleware<S>[]
): Store<S> {
  let state = initialState;
  const listeners = new Set<() => void>();

  let dispatch = (action: Action) => {
    state = reducer(state, action as A);
    listeners.forEach(listener => listener());
  };

  // Apply middleware
  if (middleware) {
    const store = {
      getState: () => state,
      dispatch: (action: Action) => dispatch(action),
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      }
    };

    middleware.reverse().forEach(mw => {
      dispatch = mw(store)(dispatch);
    });
  }

  return {
    getState: () => state,
    dispatch,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}
```

Generate with full type resolution:
```bash
openpkg examples/state.ts --include-resolved-types --include-type-hierarchy --max-depth 10
```

## JSDoc Examples

### 10. Rich Documentation
```typescript
// documented.ts
/**
 * Represents a user in the system
 * @since 1.0.0
 * @see {@link UserService}
 */
export interface User {
  /** Unique identifier */
  id: string;
  
  /** User's email address */
  email: string;
  
  /** User's display name */
  name: string;
  
  /** Account creation timestamp */
  createdAt: Date;
}

/**
 * Service for managing users
 * @since 1.0.0
 * @deprecated Use UserServiceV2 instead
 */
export class UserService {
  /**
   * Creates a new user
   * @param userData - The user data
   * @returns The created user
   * @throws {ValidationError} If email is invalid
   * @example
   * ```typescript
   * const user = await userService.createUser({
   *   email: 'john@example.com',
   *   name: 'John Doe'
   * });
   * ```
   */
  async createUser(userData: Omit<User, 'id' | 'createdAt'>): Promise<User> {
    // Implementation
    return {
      id: '123',
      ...userData,
      createdAt: new Date()
    };
  }
  
  /**
   * Finds a user by ID
   * @param id - The user ID
   * @returns The user if found, null otherwise
   */
  async findUser(id: string): Promise<User | null> {
    // Implementation
    return null;
  }
}
```

Extract all JSDoc information:
```bash
openpkg examples/documented.ts
```

## Running All Examples

Generate specs for all examples:
```bash
# Basic parsing
for file in examples/*.ts; do
  openpkg "$file" --output "$(basename "$file" .ts)-spec.json"
done

# With full resolution
for file in examples/*.ts; do
  openpkg "$file" \
    --include-resolved-types \
    --include-type-hierarchy \
    --output "$(basename "$file" .ts)-full-spec.json"
done
```

## Tips

1. **Use `--include-resolved-types`** to see expanded utility types
2. **Use `--include-type-hierarchy`** for inheritance visualization
3. **Use `--enhance-with-ai`** for better documentation
4. **Set `--max-depth`** appropriately for recursive types
5. **Use `--verbose`** to debug type resolution issues