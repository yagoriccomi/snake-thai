import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { env } from '@/config/env';
import { largeSecureStore } from '@/lib/secureStorage';
import type { Database } from '@/types/database.types';

/**
 * Cliente único (singleton) do Supabase para todo o aplicativo.
 *
 * - `storage`: sessão persistida de forma CIFRADA via LargeSecureStore
 *   (tokens nunca em texto puro — CLAUDE.md §3 / LGPD).
 * - `autoRefreshToken`: renova o access token automaticamente antes de expirar.
 * - `persistSession`: mantém o usuário logado entre aberturas do app.
 * - `detectSessionInUrl`: desligado — só faz sentido no fluxo web (redirect OAuth).
 *
 * Tipagem: parametrizado por `Database` (gerado pelo Supabase CLI) para que
 * todas as queries fiquem fortemente tipadas, sem `any`.
 */
export const supabase = createClient<Database>(
  env.supabaseUrl,
  env.supabaseAnonKey,
  {
    auth: {
      storage: largeSecureStore,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

/**
 * Controla o auto-refresh do token conforme o ciclo de vida do app.
 *
 * O Supabase recomenda pausar a renovação automática quando o app vai para
 * background (economiza recursos e evita refreshes desnecessários) e retomá-la
 * quando volta ao foreground.
 */
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    void supabase.auth.startAutoRefresh();
  } else {
    void supabase.auth.stopAutoRefresh();
  }
});
