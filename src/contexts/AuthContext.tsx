import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
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

const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes in milliseconds

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const lastInteractTime = useRef<number>(Date.now());

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const signOut = useCallback(async () => {
    try {
      // Force immediate UI logout so the user isn't trapped if the API is frozen
      setSession(null);
      setUser(null);
      setPerfil(null);
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Sign out API timeout')), 3000)
      );
      
      await Promise.race([
        supabase.auth.signOut(),
        timeoutPromise
      ]);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }, []);

  const updatePerfilState = useCallback((updates: Partial<Perfil>) => {
    setPerfil(prev => prev ? { ...prev, ...updates } : null);
  }, []);

  useEffect(() => {
    // Only update the time reference on user interaction
    const handleInteract = () => {
      lastInteractTime.current = Date.now();
    };

    // A single interval that checks every 30 seconds if the session has expired
    const intervalId = setInterval(() => {
      if (!sessionRef.current) return;
      
      const timeSinceLastAction = Date.now() - lastInteractTime.current;
      if (timeSinceLastAction >= INACTIVITY_TIMEOUT) {
        console.log(`Session expired due to inactivity (${INACTIVITY_TIMEOUT / 60000} mins)`);
        // Reset time immediately so it doesn't trigger repeatedly while logging out
        lastInteractTime.current = Date.now(); 
        signOut().catch(console.error);
      }
    }, 30000); // 30 seconds polling interval

    const options = { passive: true };
    window.addEventListener('mousemove', handleInteract, options);
    window.addEventListener('keydown', handleInteract, options);
    window.addEventListener('click', handleInteract, options);
    window.addEventListener('scroll', handleInteract, options);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('mousemove', handleInteract);
      window.removeEventListener('keydown', handleInteract);
      window.removeEventListener('click', handleInteract);
      window.removeEventListener('scroll', handleInteract);
    };
  }, [signOut]);

  useEffect(() => {
    let mounted = true;
    let safetyTimeout: NodeJS.Timeout;

    async function getInitialSession() {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (error) {
           console.error('Error getting initial session:', error);
        }

        if (mounted && initialSession) {
          setSession(initialSession);
          sessionRef.current = initialSession;
          setUser(initialSession.user);
          const userProfile = await AuthService.getPerfil(initialSession.user.id);
          if (mounted) {
            setPerfil(userProfile);
          }
        }
      } catch (error) {
        console.error('Error in getInitialSession catch:', error);
      } finally {
        if (mounted) {
          clearTimeout(safetyTimeout);
          setIsLoading(false);
          lastInteractTime.current = Date.now();
        }
      }
    }

    // Security timeout of 10s to ensure we never get stuck
    safetyTimeout = setTimeout(() => {
      if (mounted) {
        console.warn('Initial session load timeout (10s), forcing loading to false');
        setIsLoading(false);
      }
    }, 10000);

    getInitialSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!mounted) return;

      setSession(currentSession);
      sessionRef.current = currentSession;
      setUser(currentSession?.user ?? null);

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (!currentSession) return;
        
        try {
          // Do NOT set isLoading(true) here, as it completely unmounts the app layout and causes freezing/spasms on Alt+Tab 
          if (event === 'SIGNED_IN') {
            const provider = currentSession.user.app_metadata.provider;
            const method = provider === 'google' ? 'google' : 'password';
            await AuthService.logIngreso(currentSession.user.id, method);
          }
          
          const userProfile = await AuthService.getPerfil(currentSession.user.id);
          if (mounted) {
            setPerfil(userProfile);
            lastInteractTime.current = Date.now();
          }
        } catch (error) {
          console.error('Error handling auth state change:', error);
        }
      } else if (event === 'SIGNED_OUT') {
        try {
          setPerfil(null);
        } finally {
          if (mounted) setIsLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
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
