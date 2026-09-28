import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

// 'user' = buyer, 'seller' = can list cars, 'admin' = manages everything
export type Role = 'admin' | 'seller' | 'user';

export interface AuthUser {
  id: number;
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

const STORAGE_KEY = 'noon.auth.user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  // Restore the session so a page refresh / app restart keeps you signed in
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setUser((current) => current ?? JSON.parse(raw));
      })
      .catch(() => {});
  }, []);

  const login = (u: AuthUser) => {
    setUser(u);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(u)).catch(() => {});
  };

  const logout = () => {
    setUser(null);
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  };

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
