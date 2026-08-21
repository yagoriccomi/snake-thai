/** Constantes do domínio de autenticação. */

/**
 * Senha padrão com que o administrador cria a conta do aluno. O aluno é
 * OBRIGADO a trocá-la no onboarding (primeiro login). A criação de fato ocorre
 * na Edge Function `create-student` (server-side); aqui é só referência de UI.
 */
export const DEFAULT_STUDENT_PASSWORD = 'Snake@123';
