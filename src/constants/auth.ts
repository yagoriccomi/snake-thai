/** Constantes do domínio de autenticação. */

/**
 * Senha inicial de emergência.
 *
 * A senha padrão real vive em `academy_settings.default_student_password`, e é
 * o administrador quem a define pela tela de Configurações. Este valor serve
 * apenas de fallback para o instante entre abrir a tela e a configuração
 * chegar do servidor — e para uma instalação recém-criada, cujo registro de
 * configuração ainda repete este mesmo padrão.
 *
 * @deprecated Prefira `useAcademySettings().settings?.default_student_password`.
 */
export const DEFAULT_STUDENT_PASSWORD = 'Snake@123';
