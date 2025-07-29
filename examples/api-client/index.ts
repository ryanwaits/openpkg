/**
 * HTTP methods
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/**
 * Request configuration
 */
export interface RequestConfig {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retries?: number;
}

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Record<string, string>;
}

/**
 * Error response
 */
export interface ApiError {
  message: string;
  code: string;
  details?: any;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page: number;
  limit: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}

/**
 * User model
 */
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create user request
 */
export interface CreateUserRequest {
  email: string;
  name: string;
  password: string;
}

/**
 * Update user request
 */
export type UpdateUserRequest = Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>;

/**
 * API client class
 */
export class ApiClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor(baseUrl: string, defaultHeaders?: Record<string, string>) {
    this.baseUrl = baseUrl;
    this.defaultHeaders = defaultHeaders || {};
  }

  /**
   * Makes an HTTP request
   */
  async request<T>(path: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    // Implementation would go here
    throw new Error('Not implemented');
  }

  /**
   * GET request helper
   */
  async get<T>(path: string, config?: Omit<RequestConfig, 'method'>): Promise<T> {
    const response = await this.request<T>(path, { ...config, method: 'GET' });
    return response.data;
  }

  /**
   * POST request helper
   */
  async post<T>(path: string, body?: any, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<T> {
    const response = await this.request<T>(path, { ...config, method: 'POST', body });
    return response.data;
  }

  /**
   * Sets the authorization header
   */
  setAuthToken(token: string): void {
    this.defaultHeaders['Authorization'] = `Bearer ${token}`;
  }
}

/**
 * User API service
 */
export class UserService {
  constructor(private client: ApiClient) {}

  /**
   * Get all users with pagination
   */
  async getUsers(params?: PaginationParams): Promise<PaginatedResponse<User>> {
    return this.client.get('/users', { body: params });
  }

  /**
   * Get user by ID
   */
  async getUser(id: string): Promise<User> {
    return this.client.get(`/users/${id}`);
  }

  /**
   * Create new user
   */
  async createUser(data: CreateUserRequest): Promise<User> {
    return this.client.post('/users', data);
  }

  /**
   * Update user
   */
  async updateUser(id: string, data: UpdateUserRequest): Promise<User> {
    return this.client.post(`/users/${id}`, data);
  }
}

/**
 * Creates a configured API client instance
 */
export function createApiClient(baseUrl: string, token?: string): ApiClient {
  const client = new ApiClient(baseUrl);
  if (token) {
    client.setAuthToken(token);
  }
  return client;
}