import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface UserPayload {
  id: string;
  email: string;
  organisation_id: string;
}

interface AuthContextType {
  user: UserPayload | null;
  loading: boolean;
  login: (token: string, user: UserPayload) => void;
  signOut: () => void;
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

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      const decoded = decodeToken(token);
      if (decoded) {
        setUser(decoded);
      } else {
        // Token was invalid, malformed, or expired — clear it and surface a
        // message so the user knows why they were logged out (mirrors the UX
        // of the 401 path in db.ts apiFetch).
        localStorage.removeItem('token');
        sessionStorage.setItem('auth_message', 'Your session has expired. Please log in again.');
      }
    }
    setLoading(false);
  }, []);

  const login = (token: string, userPayload: UserPayload) => {
    localStorage.setItem('token', token);
    setUser(userPayload);
  };

  const signOut = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signOut }}>
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
