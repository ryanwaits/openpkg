/**
 * Advanced TypeScript Demo for Phase 3 Features
 * @module phase3-demo
 * @since 3.0.0
 */

// 1. JSDoc with Rich Documentation
/**
 * Represents a user in the system
 * @interface User
 * @since 1.0.0
 * @see {@link UserService}
 */
export interface User {
  /** Unique identifier */
  id: string;
  
  /** User's full name */
  name: string;
  
  /** 
   * User's email address
   * @format email
   */
  email: string;
  
  /** User role in the system */
  role: 'admin' | 'user' | 'guest';
  
  /** Account creation date */
  createdAt: Date;
}

// 2. Declaration Merging
export interface Config {
  apiUrl: string;
  timeout: number;
}

export interface Config {
  retryAttempts: number;
  debug: boolean;
}

export namespace Config {
  export const defaults: Config = {
    apiUrl: 'https://api.example.com',
    timeout: 5000,
    retryAttempts: 3,
    debug: false
  };
  
  export function validate(config: Partial<Config>): config is Config {
    return !!config.apiUrl && typeof config.timeout === 'number';
  }
}

// 3. Type Inference Examples
/**
 * Service for managing users
 * @class
 * @since 2.0.0
 */
export class UserService {
  private users = new Map<string, User>();
  
  /**
   * Add a new user to the system
   * @param userData - Partial user data
   * @returns The created user with generated ID
   * @throws {Error} If user data is invalid
   * @example
   * ```typescript
   * const user = service.addUser({ name: 'John', email: 'john@example.com' });
   * console.log(user.id); // Generated UUID
   * ```
   */
  addUser(userData: Omit<User, 'id' | 'createdAt'>) {
    // Return type is inferred as User
    const user: User = {
      ...userData,
      id: this.generateId(),
      createdAt: new Date()
    };
    
    this.users.set(user.id, user);
    return user;
  }
  
  /**
   * Find users by role
   * @param role - The role to filter by
   * @returns Array of users with the specified role
   * @deprecated Use {@link findUsersByPredicate} instead
   */
  findUsersByRole(role: User['role']) {
    // Return type is inferred as User[]
    return Array.from(this.users.values()).filter(user => user.role === role);
  }
  
  /**
   * Find users by custom predicate
   * @param predicate - Function to test each user
   * @returns Filtered users
   * @since 2.5.0
   */
  findUsersByPredicate(predicate: (user: User) => boolean) {
    return Array.from(this.users.values()).filter(predicate);
  }
  
  // Inferred generic type from usage
  private generateId() {
    return Math.random().toString(36).substring(2, 15);
  }
}

// 4. Type Guards / Type Predicates
/**
 * Check if a value is a valid User
 * @param value - Value to check
 * @returns True if value is a User
 */
export function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value &&
    'email' in value
  );
}

/**
 * Check if a user has admin privileges
 * @param user - User to check
 * @returns True if user is an admin
 */
export function isAdmin(user: User): user is User & { role: 'admin' } {
  return user.role === 'admin';
}

// 5. Symbol Aliases and Re-exports
export { User as AppUser } from './test-phase3-demo'; // Self-reference for demo
export type { Config as AppConfig } from './test-phase3-demo';

// 6. Complex Generic with Inference
export class Repository<T extends { id: string }> {
  protected items = new Map<string, T>();
  
  /**
   * Add an item to the repository
   * @param item - Item to add
   * @returns The added item
   */
  add(item: T): T {
    this.items.set(item.id, item);
    return item;
  }
  
  /**
   * Find an item by ID
   * @param id - Item ID
   * @returns The item if found
   */
  find(id: string): T | undefined {
    return this.items.get(id);
  }
  
  /**
   * Find items matching a predicate
   * @param predicate - Filter function
   * @returns Matching items
   */
  where(predicate: (item: T) => boolean): T[] {
    return Array.from(this.items.values()).filter(predicate);
  }
}

// 7. Inferred Types from Context
const userRepo = new Repository<User>();

// Type of newUser is inferred from context
const newUser = userRepo.add({
  id: '123',
  name: 'Alice',
  email: 'alice@example.com',
  role: 'admin',
  createdAt: new Date()
});

// 8. Async with Inferred Types
export class ApiClient {
  /**
   * Fetch data from an endpoint
   * @param endpoint - API endpoint
   * @returns Promise resolving to the data
   */
  async fetchData<T>(endpoint: string): Promise<T> {
    const response = await fetch(endpoint);
    return response.json();
  }
  
  // Return type is inferred as Promise<User[]>
  async getUsers() {
    return this.fetchData<User[]>('/api/users');
  }
  
  // Return type with error handling
  async getUserSafe(id: string) {
    try {
      return await this.fetchData<User>(`/api/users/${id}`);
    } catch (error) {
      return null;
    }
  }
}

// 9. Namespace with Mixed Exports
export namespace Utils {
  export interface Logger {
    log(message: string): void;
    error(message: string): void;
  }
  
  export class ConsoleLogger implements Logger {
    log(message: string): void {
      console.log(`[LOG] ${message}`);
    }
    
    error(message: string): void {
      console.error(`[ERROR] ${message}`);
    }
  }
  
  export const defaultLogger = new ConsoleLogger();
  
  export function createLogger(prefix: string): Logger {
    return {
      log: (msg) => defaultLogger.log(`${prefix}: ${msg}`),
      error: (msg) => defaultLogger.error(`${prefix}: ${msg}`)
    };
  }
}

// 10. Advanced Type with Everything Combined
/**
 * Advanced service showcasing all Phase 3 features
 * @template TUser - User type
 * @template TConfig - Configuration type
 * @since 3.0.0
 */
export abstract class AdvancedService<
  TUser extends User = User,
  TConfig extends Config = Config
> {
  protected abstract config: TConfig;
  protected users = new Repository<TUser>();
  
  /**
   * Initialize the service
   * @param config - Service configuration
   * @returns Promise resolving when initialized
   */
  abstract initialize(config: Partial<TConfig>): Promise<void>;
  
  /**
   * Process a user with type guard
   * @param data - Unknown data
   * @returns Processed user or null
   */
  processUser(data: unknown) {
    if (isUser(data)) {
      // Type narrowed to User
      return this.users.add(data as TUser);
    }
    return null;
  }
  
  /**
   * Get admin users
   * @returns Array of admin users
   * @example
   * ```typescript
   * const admins = service.getAdmins();
   * admins.forEach(admin => {
   *   // admin.role is typed as 'admin'
   *   console.log(admin.name);
   * });
   * ```
   */
  getAdmins() {
    // Return type is inferred with narrowed type
    return this.users.where(isAdmin);
  }
}