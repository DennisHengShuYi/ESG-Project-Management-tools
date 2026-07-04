import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type PermissionLevel = { read?: boolean; write?: boolean };

interface UserPayload {
  id: string;
  email: string;
  organisation_id: string;
  role?: 'admin' | 'member';
  module_permissions?: Record<string, PermissionLevel>;
  full_name?: string | null;
}

interface AuthContextType {
  user: UserPayload | null;
  loading: boolean;
  login: (token: string, user: UserPayload) => void;
  signOut: () => void;
  isAdmin: boolean;
  canRead: (moduleKey: string) => boolean;
  canWrite: (moduleKey: string) => boolean;
  // True from mount until role/module_permissions have been resolved (either
  // from a fresh login's response, or from the /me rehydration on page
  // reload). Pages should wait for this before rendering an "access denied"
  // message — otherwise canRead/canWrite briefly report false for everyone
  // while /me is still in flight, flashing a false denial on every reload.
  permissionsLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to decode JWT payload locally without external library.
// Also checks the `exp` claim so an expired token is rejected immediately
// on page load — without this, decodeToken() would return the user payload
// from a stale token, the dashboard would render, and logout would only
// happen after the first API call got a 401 from the backend (which never
// fires if the backend is unreachable, e.g. on Vercel with no backend up).
const decodeToken = (token: string): UserPayload | null => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window.atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);
    // JWT `exp` is in seconds; Date.now() is in milliseconds.
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return null; // token is expired — treat as unauthenticated
    }
    return payload;
  } catch (e) {
    return null;
  }
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissionsLoading, setPermissionsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      const decoded = decodeToken(token);
      if (decoded) {
        setUser(decoded);
        // The JWT only carries id/email/organisation_id — role and
        // module_permissions are looked up fresh from the backend so a
        // permission change or deactivation is reflected without
        // requiring the user to log out and back in.
        fetch(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
          .then(res => (res.ok ? res.json() : null))
          .then(me => { if (me) setUser(me); })
          .catch(() => {})
          .finally(() => setPermissionsLoading(false));
      } else {
        // Token was invalid, malformed, or expired — clear it and surface a
        // message so the user knows why they were logged out (mirrors the UX
        // of the 401 path in db.ts apiFetch).
        localStorage.removeItem('token');
        sessionStorage.setItem('auth_message', 'Your session has expired. Please log in again.');
        setPermissionsLoading(false);
      }
    } else {
      setPermissionsLoading(false);
    }
    setLoading(false);
  }, []);

  const login = (token: string, userPayload: UserPayload) => {
    localStorage.setItem('token', token);
    setUser(userPayload);
    // login()'s response already includes role/module_permissions in full —
    // nothing further to wait on.
    setPermissionsLoading(false);
  };

  const signOut = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const isAdmin = user?.role === 'admin';

  const canRead = (moduleKey: string) => {
    if (!user) return false;
    if (isAdmin) return true;
    const perm = user.module_permissions?.[moduleKey];
    return !!(perm?.read || perm?.write);
  };

  const canWrite = (moduleKey: string) => {
    if (!user) return false;
    if (isAdmin) return true;
    return !!user.module_permissions?.[moduleKey]?.write;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signOut, isAdmin, canRead, canWrite, permissionsLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
