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

import { clearMonitoringUser, setMonitoringUser } from '@/lib/monitoring';
import { supabase } from '@/lib/supabase';
import * as authService from '@/services/auth.service';
import {
  authenticateBiometric,
  isBiometricAvailable,
} from '@/services/biometrics.service';
import {
  getBiometricChoice,
  setBiometricChoice,
} from '@/services/biometricPreference.service';
import { fetchProfile } from '@/services/profile.service';
import type { Profile } from '@/types/models';
import { deveBloquearAoVoltar } from '@/utils/bloqueio';

/** Estado e ações de autenticação expostos ao app. */
interface AuthContextValue {
  /** True até a sessão inicial ser resolvida a partir do armazenamento seguro. */
  initializing: boolean;
  /** True enquanto o perfil está sendo carregado. */
  loadingProfile: boolean;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  isProfessor: boolean;
  /** True quando o usuário precisa confirmar biometria para navegar. */
  adminLocked: boolean;
  /** Registra a escolha do usuário sobre o desbloqueio biométrico. */
  chooseBiometric: (enabled: boolean) => Promise<void>;
  /** True quando o desbloqueio biométrico está ativo para este usuário. */
  biometricEnabled: boolean;
  /** True quando o aparelho tem hardware biométrico COM biometria cadastrada. */
  biometricAvailable: boolean;
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
 * - Aplica o bloqueio biométrico (opt-in) SÓ em dois momentos: ao reabrir o
 *   app com a sessão guardada, e ao voltar depois de mais de 10 minutos em
 *   segundo plano (`deveBloquearAoVoltar`). Login com senha, renovação do token
 *   e idas curtas ao segundo plano — como abrir a galeria para anexar um
 *   comprovante — não bloqueiam.
 */
export function AuthProvider({ children }: AuthProviderProps): React.JSX.Element {
  const [initializing, setInitializing] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [adminLocked, setAdminLocked] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  /**
   * Verdadeiro até a primeira carga de perfil desta abertura do app. É o que
   * separa "reabriu o app" (bloqueia) de "a sessão mudou depois" — renovação
   * do token dispara `onAuthStateChange` e recarrega o perfil, e antes isso
   * reaplicava o bloqueio a cada renovação.
   */
  const aberturaPendente = useRef(true);

  const isAdmin = profile?.role === 'admin';
  const isProfessor = profile?.role === 'professor';

  // Sessão inicial + listener de mudanças de autenticação.
  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (mounted) {
          // Abriu sem sessão guardada: o próximo perfil vem de um login com
          // senha, que já é a verificação — não há abertura a bloquear.
          if (data.session === null) {
            aberturaPendente.current = false;
          }
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
      if (loaded.anonymized_at !== null) {
        // Conta excluída (LGPD): se a etapa do Auth falhou e a sessão sobreviveu,
        // o app não pode seguir com um perfil anonimizado.
        await authService.signOut();
        setProfile(null);
        return;
      }
      setProfile(loaded);
      // Monitoramento: só o papel e um id aleatório da instalação, nunca e-mail ou nome.
      void setMonitoringUser(loaded.role);

      // O bloqueio biométrico é OPT-IN: só trava quem escolheu ativá-lo. Nunca
      // é sugerido proativamente — o usuário ativa pela aba Perfil, se quiser.
      const available = await isBiometricAvailable();
      setBiometricAvailable(available);
      if (!available) {
        setBiometricEnabled(false);
        setAdminLocked(false);
        return;
      }
      const choice = await getBiometricChoice(userId);
      setBiometricEnabled(choice === 'enabled');
      if (aberturaPendente.current) {
        aberturaPendente.current = false;
        setAdminLocked(choice === 'enabled');
      }
    } catch {
      // Falha transitória (rede/servidor) NÃO pode derrubar a sessão: manter o
      // usuário logado e deixar que a próxima tentativa recarregue o perfil.
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  useEffect(() => {
    const userId = session?.user.id;
    if (userId === undefined) {
      setProfile(null);
      setAdminLocked(false);
      clearMonitoringUser();
      return;
    }
    void loadProfile(userId);
  }, [session, loadProfile]);

  // Volta do segundo plano: só pede a digital se ficou fora mais de 10 minutos.
  const saiuEm = useRef<number | null>(null);
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState !== 'active') {
          // Guarda a PRIMEIRA saída: inactive → background não reinicia a conta.
          saiuEm.current ??= Date.now();
          return;
        }
        const bloquear = deveBloquearAoVoltar(saiuEm.current, Date.now());
        saiuEm.current = null;
        if (bloquear && biometricEnabled) {
          setAdminLocked(true);
        }
      },
    );
    return () => subscription.remove();
  }, [biometricEnabled]);

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

  const chooseBiometric = useCallback(
    async (enabled: boolean): Promise<void> => {
      const userId = session?.user.id;
      if (userId === undefined) {
        return;
      }
      // Ativar exige uma confirmação biométrica na hora: comprova que o dono do
      // aparelho consegue de fato desbloquear, evitando trancar o usuário fora.
      if (enabled) {
        const confirmed = await authenticateBiometric();
        if (!confirmed) {
          return;
        }
      }
      await setBiometricChoice(userId, enabled ? 'enabled' : 'disabled');
      setBiometricEnabled(enabled);
      setAdminLocked(false);
    },
    [session],
  );

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
      isProfessor,
      adminLocked,
      biometricEnabled,
      biometricAvailable,
      chooseBiometric,
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
      isProfessor,
      adminLocked,
      biometricEnabled,
      biometricAvailable,
      chooseBiometric,
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
