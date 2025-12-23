import { createAuthClient } from 'better-auth/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const authClient = createAuthClient({
  baseURL: API_URL,
  basePath: '/auth', // matches server config
});
