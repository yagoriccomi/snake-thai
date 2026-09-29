/**
 * Contato da academia (contrato § 5.4, D52, T44): formato do WhatsApp e os
 * links que o app abre. O banco guarda o WhatsApp em E.164 **sem o `+`**
 * (`5511912345678`); a tela mostra o **+55** fixo e a pessoa digita DDD + número.
 */
import { maskPhone, onlyDigits } from '@/utils/masks';

/** DDI do Brasil, fixo na tela (o campo é só DDD + número). */
export const DDI_DO_BRASIL = '55';

/** Mesma regra da constraint `academy_settings_whatsapp_valido`. */
export const WHATSAPP_REGEX = /^55[1-9][1-9][0-9]{8,9}$/;

/** Frase de reserva quando a academia não cadastrou WhatsApp nem e-mail (§ 5.4). */
export const SEM_CONTATO = 'A academia ainda não cadastrou um contato. Procure a recepção.';

/** O contato público da academia, como `contato_da_academia()` devolve. */
export interface ContatoDaAcademia {
  whatsapp: string | null;
  email: string | null;
}

/**
 * Converte o que a pessoa digitou (DDD + número, com ou sem máscara) no valor
 * gravado. Vazio vira `null`, porque a constraint recusa texto vazio (§ 5.4).
 */
export function whatsappParaGravar(digitado: string): string | null {
  const digitos = onlyDigits(digitado);
  return digitos === '' ? null : `${DDI_DO_BRASIL}${digitos}`;
}

/** `true` quando o valor gravado seria aceito pelo banco (vazio também é válido). */
export function whatsappDigitadoValido(digitado: string): boolean {
  const gravado = whatsappParaGravar(digitado);
  return gravado === null || WHATSAPP_REGEX.test(gravado);
}

/** O inverso de `whatsappParaGravar`, para preencher o campo: `(11) 91234-5678`. */
export function whatsappParaCampo(gravado: string | null): string {
  if (gravado === null || !gravado.startsWith(DDI_DO_BRASIL)) return '';
  return maskPhone(gravado.slice(DDI_DO_BRASIL.length));
}

/** Exibição da § 5.4: `+55 (DD) NNNNN-NNNN` (ou `NNNN-NNNN` com 8 dígitos). */
export function formatarWhatsapp(gravado: string): string {
  return `+${DDI_DO_BRASIL} ${whatsappParaCampo(gravado)}`;
}

/** Link do WhatsApp (§ 5.4): `https://wa.me/<whatsapp>`. */
export function linkDoWhatsapp(gravado: string): string {
  return `https://wa.me/${gravado}`;
}

/** Link do e-mail (§ 5.4): `mailto:<email>`. */
export function linkDoEmail(email: string): string {
  return `mailto:${email}`;
}

/** `true` quando há pelo menos um botão para mostrar. */
export function temContato(contato: ContatoDaAcademia): boolean {
  return contato.whatsapp !== null || contato.email !== null;
}
