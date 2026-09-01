/** Tipos de domínio derivados do esquema do Supabase (fonte: database.types). */
import type { Database } from '@/types/database.types';

/** Linha completa de um perfil. */
export type Profile = Database['public']['Tables']['profiles']['Row'];

/** Payload de atualização de um perfil. */
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

/** Papéis de usuário. */
export type UserRole = Database['public']['Enums']['user_role'];
