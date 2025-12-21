'use client';

import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { authApi } from './api';

interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  plan: string;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  role: string;
  isPersonal: boolean;
}

interface AuthContextValue {
  user: User | null;
  organizations: Organization[];
  currentOrg: Organization | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refetch: () => Promise<void>;
  setCurrentOrg: (orgId: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = 'doccov_current_org';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSession = useCallback(async () => {
    try {
      const data = await authApi.getSession();
      setUser(data.user);
      setOrganizations(data.organizations || []);

      // Restore org selection from localStorage
      const storedOrgId = localStorage.getItem(STORAGE_KEY);
      if (storedOrgId && data.organizations?.some((o) => o.id === storedOrgId)) {
        setSelectedOrgId(storedOrgId);
      }
    } catch {
      setUser(null);
      setOrganizations([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const signOut = async () => {
    await authApi.signOut();
    setUser(null);
    setOrganizations([]);
    localStorage.removeItem(STORAGE_KEY);
    window.location.href = '/';
  };

  const setCurrentOrg = (orgId: string) => {
    const org = organizations.find((o) => o.id === orgId);
    if (org) {
      setSelectedOrgId(orgId);
      localStorage.setItem(STORAGE_KEY, orgId);
    }
  };

  // Priority: selected > personal > first org
  const currentOrg =
    organizations.find((o) => o.id === selectedOrgId) ||
    organizations.find((o) => o.isPersonal) ||
    organizations[0] ||
    null;

  return (
    <AuthContext.Provider
      value={{
        user,
        organizations,
        currentOrg,
        isLoading,
        signOut,
        refetch: fetchSession,
        setCurrentOrg,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
