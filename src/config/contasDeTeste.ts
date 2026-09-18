/**
 * Contas de teste do banco local, para o atalho de login do app DEV.
 *
 * Os valores vêm do `.env.dev` (fora do Git), preenchido por
 * `scripts/gerar-env-dev.js` a partir do seed local — não há credencial escrita
 * no código. No app de produção a lista é sempre vazia, mesmo que a variável
 * exista no ambiente: um atalho de login em produção seria uma porta aberta.
 */

export interface ContaDeTeste {
  papel: 'admin' | 'professor' | 'aluno';
  rotulo: string;
  email: string;
  senha: string;
}

const ROTULOS: Record<ContaDeTeste['papel'], string> = {
  admin: 'Admin',
  professor: 'Professor',
  aluno: 'Aluno',
};

/** Ordem de exibição: do que mais se usa no teste para o que menos se usa. */
const ORDEM: ContaDeTeste['papel'][] = ['admin', 'professor', 'aluno'];

function ehPapel(valor: string): valor is ContaDeTeste['papel'] {
  return valor === 'admin' || valor === 'professor' || valor === 'aluno';
}

/**
 * Lê as contas do ambiente.
 *
 * Formato de `EXPO_PUBLIC_DEV_CONTAS`: `papel:email|papel:email`.
 * A senha é a mesma para todas (`EXPO_PUBLIC_DEV_SENHA`), como no seed local.
 */
export function lerContasDeTeste(
  // Lida direto do ambiente, e não de `env`: assim este módulo não exige a
  // configuração inteira validada só para decidir se mostra um atalho.
  variante: string = process.env.EXPO_PUBLIC_APP_VARIANT ?? 'production',
  contas: string | undefined = process.env.EXPO_PUBLIC_DEV_CONTAS,
  senha: string | undefined = process.env.EXPO_PUBLIC_DEV_SENHA,
): ContaDeTeste[] {
  if (variante !== 'development') {
    return [];
  }
  const senhaLimpa = senha?.trim() ?? '';
  if (contas === undefined || senhaLimpa === '') {
    return [];
  }

  const lidas: ContaDeTeste[] = [];
  for (const parte of contas.split('|')) {
    const [papel, email] = parte.split(':');
    const papelLimpo = papel?.trim() ?? '';
    const emailLimpo = email?.trim() ?? '';
    if (!ehPapel(papelLimpo) || emailLimpo === '') {
      continue;
    }
    lidas.push({ papel: papelLimpo, rotulo: ROTULOS[papelLimpo], email: emailLimpo, senha: senhaLimpa });
  }

  return ORDEM.flatMap((papel) => lidas.filter((conta) => conta.papel === papel));
}
