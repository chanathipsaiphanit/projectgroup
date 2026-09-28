import { createContext, ReactNode, useContext, useState } from 'react';

type Role = 'admin' | 'user';

interface AuthUser {
  username: string;
  role: Role;
  token: string;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  const login = (u: AuthUser) => setUser(u);
  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside an <AuthProvider>');
  }
  return ctx;
}

// Note: this only holds the session in memory, so a full app restart
// logs the user out. If you want login to survive restarts, swap the
// useState above for a small AsyncStorage-backed version — ask if you
// want that added.
