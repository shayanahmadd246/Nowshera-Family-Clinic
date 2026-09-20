import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { api, setAuthToken, getAuthToken } from '../lib/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string, role?: UserRole) => Promise<User>;
  register: (name: string, email: string, phone: string, password: string) => Promise<User>;
  logout: () => void;
  quickSwitchUser: (role: UserRole, email?: string) => Promise<User>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(getAuthToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    try {
      if (getAuthToken()) {
        const res = await api.getMe();
        setUser(res.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.warn('Session check failed or expired', err);
      setAuthToken(null);
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // If no token exists on first load, default auto-sign in as patient for immediate frictionless demo
    const initAuth = async () => {
      const storedToken = getAuthToken();
      if (storedToken) {
        await refreshUser();
      } else {
        try {
          // Default start as patient Ali for instant interaction
          const res = await api.login({ email: 'patient.ali@example.com', password: 'patient123' });
          setAuthToken(res.token);
          setToken(res.token);
          setUser(res.user);
        } catch {
          // If login fails, just stay logged out
        } finally {
          setIsLoading(false);
        }
      }
    };
    initAuth();
  }, []);

  const login = async (email: string, password: string, role?: UserRole): Promise<User> => {
    setIsLoading(true);
    try {
      const res = await api.login({ email, password, role });
      setAuthToken(res.token);
      setToken(res.token);
      setUser(res.user);
      return res.user;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, email: string, phone: string, password: string): Promise<User> => {
    setIsLoading(true);
    try {
      const res = await api.register({ name, email, phone, password });
      setAuthToken(res.token);
      setToken(res.token);
      setUser(res.user);
      return res.user;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setAuthToken(null);
    setToken(null);
    setUser(null);
  };

  const quickSwitchUser = async (role: UserRole, email?: string): Promise<User> => {
    let targetEmail = email;
    let targetPass = 'patient123';

    if (!targetEmail) {
      if (role === 'admin') {
        targetEmail = 'shayanahmadd246@gmail.com';
        targetPass = 'admin123';
      } else if (role === 'doctor') {
        targetEmail = 'shayanahmadd246@gmail.com';
        targetPass = 'doctor123';
      } else {
        targetEmail = 'patient.ali@example.com';
        targetPass = 'patient123';
      }
    } else {
      if (role === 'admin') targetPass = 'admin123';
      else if (role === 'doctor') targetPass = 'doctor123';
      else targetPass = 'patient123';
    }

    return await login(targetEmail, targetPass, role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        register,
        logout,
        quickSwitchUser,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
