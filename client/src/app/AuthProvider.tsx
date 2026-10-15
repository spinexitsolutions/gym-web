import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Permission, Role } from '@apex/shared';
import { ApiError, api, apiRequest, ensureCsrf, setSessionExpiredHandler } from '@/lib/api';
import type { User } from '@/types/api';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (input: { name: string; email: string; password: string; phone?: string; referralCode?: string; acceptTerms: true }) => Promise<{ user: User | null; verificationRequired: boolean }>;
  logout: () => Promise<void>;
  refresh: () => Promise<unknown>;
  can: (permission: Permission) => boolean;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchMe(): Promise<User | null> {
  try {
    const { data } = await apiRequest<{ user: User }>('/auth/me');
    return data.user;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ['me'], queryFn: fetchMe, staleTime: 5 * 60_000, retry: false });

  useEffect(() => {
    void ensureCsrf().catch(() => undefined);
    setSessionExpiredHandler(() => qc.setQueryData(['me'], null));
  }, [qc]);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await api.post<{ user: User }>('/auth/login', { email, password });
      qc.setQueryData(['me'], data.user);
      return data.user;
    },
    [qc],
  );

  const register = useCallback<AuthContextValue['register']>(
    async (input) => {
      const data = await api.post<{ user: User | null; verificationRequired: boolean }>('/auth/register', input);
      if (data.user) qc.setQueryData(['me'], data.user);
      return data;
    },
    [qc],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      qc.setQueryData(['me'], null);
      qc.removeQueries({ predicate: (q) => !['site', 'public', 'me'].includes(String(q.queryKey[0])) });
    }
  }, [qc]);

  const value = useMemo<AuthContextValue>(() => {
    const user = me.data ?? null;
    return {
      user,
      isLoading: me.isLoading,
      login,
      register,
      logout,
      refresh: () => me.refetch(),
      can: (p) => Boolean(user && (user.role === 'admin' || user.permissions.includes(p))),
      hasRole: (...roles) => Boolean(user && roles.includes(user.role)),
    };
  }, [me, login, register, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** Where each role lands after login. */
export const homeForRole = (role: Role) => (role === 'admin' ? '/admin' : role === 'trainer' ? '/trainer' : '/member');
