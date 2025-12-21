const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  return res.json();
}

interface SessionResponse {
  user: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
    plan: string;
  } | null;
  session: { id: string; expiresAt: string } | null;
  organizations: Array<{
    id: string;
    name: string;
    slug: string;
    plan: string;
    role: string;
    isPersonal: boolean;
  }>;
}

export const authApi = {
  getSession: () => api<SessionResponse>('/auth/session'),
  signOut: () => api('/auth/sign-out', { method: 'POST' }),
};
