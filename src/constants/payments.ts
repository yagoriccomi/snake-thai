/** Constantes do domínio financeiro. */

/**
 * Chave PIX de fallback.
 *
 * A chave real vive em `academy_settings.pix_key`, editável pelo administrador
 * na tela de Configurações — cada academia que usa o sistema tem a sua. Este
 * valor não deve ser exibido: a tela de pagamento avisa quando a chave ainda
 * não foi configurada.
 *
 * @deprecated Prefira `useAcademySettings().settings?.pix_key`.
 */
export const ACADEMY_PIX_KEY = 'pix@snakethai.com.br';

/** Nome do bucket de comprovantes (alinhado à migration de Storage da Fase 1). */
export const PROOF_BUCKET = 'payment_proofs';
