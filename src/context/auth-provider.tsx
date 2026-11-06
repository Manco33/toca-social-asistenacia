"use client";

import React, { createContext, useState, useEffect, useContext } from 'react';
import type { UsuarioBoco } from '@/lib/types';

interface AuthContextType {
  user: UsuarioBoco | null;
  login: (user: UsuarioBoco) => void;
  logout: () => void;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UsuarioBoco | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('boco_user') || localStorage.getItem('user');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error("Error al cargar sesión de BOCO:", error);
      localStorage.removeItem('boco_user');
      localStorage.removeItem('user');
    }
    setLoading(false);
  }, []);

  const login = (userToLogin: UsuarioBoco) => {
    setUser(userToLogin);
    localStorage.setItem('boco_user', JSON.stringify(userToLogin));
    localStorage.setItem('user', JSON.stringify(userToLogin)); // compatibilidad
    setLoading(false);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('boco_user');
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider');
  }
  return context;
}
