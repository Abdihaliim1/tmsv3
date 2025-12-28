import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type UserRole = 'admin' | 'dispatcher' | 'driver' | 'accountant' | 'viewer';

interface User {
  username: string;
  name: string;
  role: UserRole;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Hardcoded credentials
const VALID_CREDENTIALS = {
  username: 'Abdihaliim',
  password: 'Abdi1234',
  name: 'Abdihaliim',
  role: 'admin' as UserRole
};

const STORAGE_KEY = 'tms_auth_user';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check for existing session on mount
  useEffect(() => {
    const storedUser = localStorage.getItem(STORAGE_KEY);
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        // Ensure user has admin role (for development - can be changed later)
        const userWithRole: User = {
          ...parsedUser,
          role: parsedUser.role || VALID_CREDENTIALS.role
        };
        setUser(userWithRole);
        setIsAuthenticated(true);
        // Update stored user with role if missing
        if (!parsedUser.role) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(userWithRole));
        }
      } catch (error) {
        console.error('Error parsing stored user:', error);
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    // Normalize username for comparison (case-insensitive)
    const normalizedUsername = username.trim();
    const normalizedValidUsername = VALID_CREDENTIALS.username.trim();

    if (
      normalizedUsername.toLowerCase() === normalizedValidUsername.toLowerCase() &&
      password === VALID_CREDENTIALS.password
    ) {
      const userData: User = {
        username: normalizedUsername,
        name: VALID_CREDENTIALS.name,
        role: VALID_CREDENTIALS.role
      };
      
      setUser(userData);
      setIsAuthenticated(true);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
      return true;
    }
    
    return false;
  };

  const logout = () => {
    try {
      // Clear localStorage first
      localStorage.removeItem(STORAGE_KEY);
      
      // Clear state - this will trigger re-render and show Login page
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Error during logout:', error);
      // Force clear even if there's an error
      setUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

