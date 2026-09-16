import { dateBrToIso, onlyDigits } from '@/utils/masks';
import {
  isValidBirthDate,
  isValidCpf,
  isValidEmail,
  isValidName,
  isValidPhone,
} from '@/utils/validation';

/**
 * Formulário da tela EditarAluno: validação pura e conversão para o que o
 * serviço grava.
 *
 * A unicidade do CPF NÃO é conferida aqui: conferir antes de gravar abre uma
 * corrida entre duas edições. Quem garante é a UNIQUE do banco, e a tela
 * traduz o erro ("Este CPF já está cadastrado em outra conta"). [#89]
 */

/** Valores como estão nos campos (com máscara). */
export interface ValoresDoFormularioDeAluno {
  nome: string;
  cpf: string;
  celular: string;
  /** DD/MM/AAAA. */
  nascimento: string;
}

export type CampoDoAluno = keyof ValoresDoFormularioDeAluno;

export type ErrosDoFormularioDeAluno = Partial<Record<CampoDoAluno, string>>;

interface Opcoes {
  /**
   * Aluno que ainda não fez o primeiro acesso: nome e CPF são dele, informados
   * no onboarding — o admin não preenche, senão a etapa de dados é pulada e o
   * aluno fica sem telefone e nascimento.
   */
  pendente: boolean;
}

/**
 * Erros por campo; objeto vazio = pode gravar.
 *
 * Perfil já integrado precisa de nome e CPF (constraint
 * `profiles_complete_when_onboarded`). Celular e nascimento são opcionais, mas,
 * se preenchidos, precisam ser válidos.
 */
export function validarFormularioDeAluno(
  valores: ValoresDoFormularioDeAluno,
  { pendente }: Opcoes,
): ErrosDoFormularioDeAluno {
  const erros: ErrosDoFormularioDeAluno = {};

  if (!pendente) {
    if (!isValidName(valores.nome)) {
      erros.nome = 'Informe o nome completo (pelo menos 3 letras).';
    }
    if (!isValidCpf(valores.cpf)) {
      erros.cpf = 'CPF inválido. Confira os números.';
    }
  }
  if (onlyDigits(valores.celular) !== '' && !isValidPhone(valores.celular)) {
    erros.celular = 'Celular inválido. Use DDD + número.';
  }
  if (onlyDigits(valores.nascimento) !== '' && !isValidBirthDate(valores.nascimento)) {
    erros.nascimento = 'Data de nascimento inválida.';
  }
  return erros;
}

/** Valida o e-mail de login digitado pelo admin. */
export function validarEmailDoAluno(email: string): string | null {
  return isValidEmail(email) ? null : 'E-mail inválido.';
}

/** Os campos do formulário no formato gravado (dígitos, ISO, `null` para vazio). */
export function normalizarFormularioDeAluno(valores: ValoresDoFormularioDeAluno): {
  name: string;
  cpf: string;
  phone: string | null;
  dob: string | null;
} {
  const celular = onlyDigits(valores.celular);
  return {
    name: valores.nome.trim(),
    cpf: onlyDigits(valores.cpf),
    phone: celular === '' ? null : celular,
    dob: onlyDigits(valores.nascimento) === '' ? null : dateBrToIso(valores.nascimento),
  };
}
