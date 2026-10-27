import { createContext, useCallback, useContext, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../services/api.js';

const AuthContext = createContext(null);
export const ME_KEY = ['auth', 'me'];

async function fetchMe() {
  try {
    return (await api.get('/auth/me')).data;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null; // signed out
    throw err;
  }
}

export function AuthProvider({ children }) {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ME_KEY, queryFn: fetchMe, staleTime: 5 * 60_000, retry: 1 });

  const setSession = useCallback((payload) => qc.setQueryData(ME_KEY, payload), [qc]);

  const login = useCallback(async (values) => {
    const res = await api.post('/auth/login', values);
    setSession(res.data);
    return res.data;
  }, [setSession]);

  const register = useCallback(async (values) => {
    const res = await api.post('/auth/register', values);
    setSession(res.data);
    return res;
  }, [setSession]);

  const logout = useCallback(async ({ everywhere = false } = {}) => {
    try { await api.post(everywhere ? '/auth/logout-all' : '/auth/logout'); } finally {
      qc.clear();
      qc.setQueryData(ME_KEY, null);
    }
  }, [qc]);

  const value = useMemo(() => ({
    user: data?.user ?? null,
    profile: data?.profile ?? null,
    loading: isLoading,
    error: isError,
    refetch,
    setSession,
    login,
    register,
    logout,
    isStaff: ['owner', 'admin', 'staff'].includes(data?.user?.role),
  }), [data, isLoading, isError, refetch, setSession, login, register, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
