import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { AuthService, Perfil } from '../services/auth';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  perfil: Perfil | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  updatePerfilState: (updates: Partial<Perfil>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

  const resetInactivityTimer = () => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    
    // Only set timer if there is an active session
    if (session) {
      inactivityTimerRef.current = setTimeout(async () => {
        console.log('Session expired due to inactivity');
        await signOut();
      }, INACTIVITY_TIMEOUT);
    }
  };

  const handleInteract = () => {
    resetInactivityTimer();
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setPerfil(null);
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
  };

  const updatePerfilState = (updates: Partial<Perfil>) => {
    setPerfil(prev => prev ? { ...prev, ...updates } : null);
  };

  useEffect(() => {
    // Setup activity listeners
    window.addEventListener('mousemove', handleInteract);
    window.addEventListener('keydown', handleInteract);
    window.addEventListener('click', handleInteract);
    window.addEventListener('scroll', handleInteract);

    return () => {
      window.removeEventListener('mousemove', handleInteract);
      window.removeEventListener('keydown', handleInteract);
      window.removeEventListener('click', handleInteract);
      window.removeEventListener('scroll', handleInteract);
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [session]);

  useEffect(() => {
    let mounted = true;

    async function getInitialSession() {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        if (mounted) {
          if (initialSession) {
            setSession(initialSession);
            setUser(initialSession.user);
            const userProfile = await AuthService.getPerfil(initialSession.user.id);
            setPerfil(userProfile);
            resetInactivityTimer();
          }
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error getting initial session:', error);
        if (mounted) setIsLoading(false);
      }
    }

    getInitialSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!mounted) return;

      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (event === 'SIGNED_IN' && currentSession) {
        // Log ingreso
        const provider = currentSession.user.app_metadata.provider;
        const method = provider === 'google' ? 'google' : 'password';
        
        // Check if we already logged this session recently to avoid duplicates?
        // SIGNED_IN can sometimes fire multiple times or on token refresh.
        // But let's follow the standard pattern:
        await AuthService.logIngreso(currentSession.user.id, method);
        
        const userProfile = await AuthService.getPerfil(currentSession.user.id);
        setPerfil(userProfile);
        resetInactivityTimer();
      } else if (event === 'SIGNED_OUT') {
        setPerfil(null);
        if (inactivityTimerRef.current) {
          clearTimeout(inactivityTimerRef.current);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = {
    session,
    user,
    perfil,
    isLoading,
    signOut,
    updatePerfilState
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
