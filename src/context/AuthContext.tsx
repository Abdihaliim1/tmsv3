import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  User as FirebaseUser,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { setSentryUser, clearSentryUser } from '../lib/sentry';

export type UserRole = 'admin' | 'dispatcher' | 'driver' | 'accountant' | 'viewer';

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
  tenantId?: string;
}

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string, displayName: string, role?: UserRole) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUserRole: (uid: string, role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Get user role from Firestore user document
 * Defaults to 'viewer' if not found
 */
async function getUserRole(uid: string, email: string | null): Promise<UserRole> {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      return (data.role as UserRole) || 'viewer';
    }
    // If user document doesn't exist, create one with default role
    await setDoc(doc(db, 'users', uid), {
      email: email || null,
      role: 'viewer',
      tenants: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return 'viewer';
  } catch (error) {
    console.error('Error fetching user role:', error);
    return 'viewer';
  }
}

/**
 * Convert Firebase User to our User type
 */
async function convertFirebaseUser(firebaseUser: FirebaseUser | null): Promise<User | null> {
  if (!firebaseUser) return null;

  const role = await getUserRole(firebaseUser.uid, firebaseUser.email);
  
  // Get tenantId from user document if available
  let tenantId: string | undefined;
  try {
    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
    if (userDoc.exists()) {
      tenantId = userDoc.data().tenantId;
    }
  } catch (error) {
    console.error('Error fetching tenantId:', error);
  }

  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName,
    role,
    tenantId,
  };
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Listen to Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setFirebaseUser(firebaseUser);
      
      if (firebaseUser) {
        const convertedUser = await convertFirebaseUser(firebaseUser);
        setUser(convertedUser);
        
        // Set Sentry user context
        if (convertedUser) {
          try {
            setSentryUser({
              id: convertedUser.uid,
              email: convertedUser.email || undefined,
              role: convertedUser.role,
            });
          } catch {
            // Sentry not available
          }
        }
      } else {
        setUser(null);
        
        // Clear Sentry user context
        try {
          clearSentryUser();
        } catch {
          // Sentry not available
        }
      }
      
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Auth state change will update user automatically
    } catch (error: any) {
      console.error('Login error:', error);
      
      // Provide user-friendly error messages
      let errorMessage = 'Failed to sign in. Please check your email and password.';
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email address.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password. Please try again.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed login attempts. Please try again later.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your connection.';
      }
      
      throw new Error(errorMessage);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      // Clear tenant selection from sessionStorage
      sessionStorage.removeItem('somtms_activeTenantId');
      sessionStorage.removeItem('somtms_redirectAfterTenantSelect');
      
      await signOut(auth);
      // Auth state change will clear user automatically
    } catch (error) {
      console.error('Logout error:', error);
      throw new Error('Failed to sign out. Please try again.');
    }
  };

  const register = async (
    email: string, 
    password: string, 
    displayName: string, 
    role: UserRole = 'viewer'
  ): Promise<void> => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Update display name
      if (userCredential.user) {
        await updateProfile(userCredential.user, { displayName });
        
        // Create user document in Firestore with role
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          email,
          displayName,
          role: 'viewer',
          tenants: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      
      let errorMessage = 'Failed to create account. Please try again.';
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'An account with this email already exists.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please use at least 6 characters.';
      }
      
      throw new Error(errorMessage);
    }
  };

  const resetPassword = async (email: string): Promise<void> => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
      console.error('Password reset error:', error);
      
      let errorMessage = 'Failed to send password reset email.';
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email address.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address.';
      }
      
      throw new Error(errorMessage);
    }
  };

  const updateUserRole = async (uid: string, role: UserRole): Promise<void> => {
    try {
      await setDoc(doc(db, 'users', uid), {
        role,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      
      // Refresh user data if it's the current user
      if (firebaseUser && firebaseUser.uid === uid) {
        const updatedUser = await convertFirebaseUser(firebaseUser);
        setUser(updatedUser);
      }
    } catch (error) {
      console.error('Error updating user role:', error);
      throw new Error('Failed to update user role.');
    }
  };

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ 
      user, 
      firebaseUser,
      isAuthenticated, 
      isLoading,
      login, 
      logout,
      register,
      resetPassword,
      updateUserRole,
    }}>
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
