import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type { Session } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import * as authService from '@/services/auth.service';
import {
  authenticateBiometric,
  isBiometricAvailable,
} from '@/services/biometrics.service';
import { fetchProfile } from '@/services/profile.service';
import type { Profile } from '@/types/models';

/** Estado e ações de autenticação expostos ao app. */
interface AuthContextValue {
  /** True até a sessão inicial ser resolvida a partir do armazenamento seguro. */
  initializing: boolean;
  /** True enquanto o perfil está sendo carregado. */
  loadingProfile: boolean;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  /** True quando o admin precisa confirmar biometria para navegar. */
  adminLocked: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  /** Solicita a biometria; retorna true se liberada. */
  unlockAdmin: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * Provedor global de autenticação.
 *
 * Responsabilidades:
 * - Recupera a sessão persistida (cifrada) e escuta `onAuthStateChange`.
 * - Carrega o perfil do usuário e deriva `isAdmin`.
 * - Aplica o "lock" biométrico do administrador na abertura e a cada retorno
 *   do app ao foreground.
 */
export function AuthProvider({ children }: AuthProviderProps): React.JSX.Element {
  const [initializing, setInitializing] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [adminLocked, setAdminLocked] = useState(false);

  const isAdmin = profile?.role === 'admin';

  // Sessão inicial + listener de mudanças de autenticação.
  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (mounted) {
          setSession(data.session);
          setInitializing(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setInitializing(false);
        }
      });

    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  // Carrega o perfil sempre que a sessão muda e aplica o lock de admin.
  const loadProfile = useCallback(async (userId: string): Promise<void> => {
    setLoadingProfile(true);
    try {
      const loaded = await fetchProfile(userId);
      if (loaded === null) {
        // Sessão sem perfil correspondente é um estado inconsistente → desloga.
        await authService.signOut();
        setProfile(null);
        return;
      }
      setProfile(loaded);
      if (loaded.role === 'admin') {
        setAdminLocked(true);
        const available = await isBiometricAvailable();
        if (!available) {
          // Sem biometria no aparelho não há como travar — libera o acesso.
          setAdminLocked(false);
        }
      } else {
        setAdminLocked(false);
      }
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  useEffect(() => {
    const userId = session?.user.id;
    if (userId === undefined) {
      setProfile(null);
      setAdminLocked(false);
      return;
    }
    void loadProfile(userId);
  }, [session, loadProfile]);

  // Ao retornar do background, o admin precisa reautenticar por biometria.
  const appState = useRef<AppStateStatus>(AppState.currentState);
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        const cameToForeground =
          appState.current.match(/inactive|background/) !== null &&
          nextState === 'active';
        appState.current = nextState;

        if (cameToForeground && profile?.role === 'admin') {
          void isBiometricAvailable().then((available) => {
            if (available) {
              setAdminLocked(true);
            }
          });
        }
      },
    );
    return () => subscription.remove();
  }, [profile]);

  const signIn = useCallback(async (email: string, password: string): Promise<void> => {
    // A atualização de sessão/perfil é disparada por onAuthStateChange.
    await authService.signInWithPassword(email, password);
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    await authService.signOut();
    setProfile(null);
    setAdminLocked(false);
  }, []);

  const refreshProfile = useCallback(async (): Promise<void> => {
    const userId = session?.user.id;
    if (userId === undefined) {
      return;
    }
    const loaded = await fetchProfile(userId);
    setProfile(loaded);
  }, [session]);

  const unlockAdmin = useCallback(async (): Promise<boolean> => {
    const authenticated = await authenticateBiometric();
    if (authenticated) {
      setAdminLocked(false);
    }
    return authenticated;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      initializing,
      loadingProfile,
      session,
      profile,
      isAdmin,
      adminLocked,
      signIn,
      signOut,
      refreshProfile,
      unlockAdmin,
    }),
    [
      initializing,
      loadingProfile,
      session,
      profile,
      isAdmin,
      adminLocked,
      signIn,
      signOut,
      refreshProfile,
      unlockAdmin,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Acessa o contexto de autenticação. Lança erro se usado fora do provedor.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um <AuthProvider>.');
  }
  return context;
}
