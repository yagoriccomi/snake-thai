import type { AulaDoAluno } from '@/services/aulas.service';
import type { MinhaTroca, TipoDeTroca } from '@/services/trocas.service';
import { diaEHora, type TomDoSelo } from '@/utils/aulasDoAluno';

/** Textos da § 3 para a folha Trocar aula. */
export const TEXTOS_DA_TROCA = {
  pergunta: 'Qual aula sua você quer trocar por esta?',
  campoDaPermanente: 'Por que você precisa mudar de horário?',
  avisoDaPermanente: 'A troca permanente muda a sua grade a partir da próxima aula depois da aprovação.',
  semOpcao: 'Nenhuma aula sua nesta semana pode ser trocada por esta.',
} as const;

export const ROTULO_DO_TIPO: Readonly<Record<TipoDeTroca, string>> = {
  once: 'Só nesta semana',
  permanent: 'Permanente',
};

/** "Este horário termina em dd/mm." (§ 3), a partir de `AAAA-MM-DD`. */
export function avisoDeFimDoHorario(fim: string): string {
  return `Este horário termina em ${fim.slice(8, 10)}/${fim.slice(5, 7)}.`;
}

/** Reposição: a aula original já começou (§ 9.4, `is_makeup`). */
export function ehReposicao(original: Pick<AulaDoAluno, 'date_time'>, agora: Date = new Date()): boolean {
  return new Date(original.date_time) <= agora;
}

/**
 * As aulas dele que podem ir para a troca (as colunas do banco, § 12): na
 * avulsa, `can_swap_from`; na permanente, `can_swap_from_permanent`. A nova
 * nunca aparece como original.
 */
export function opcoesDeOrigem(aulas: readonly AulaDoAluno[], nova: AulaDoAluno, tipo: TipoDeTroca): AulaDoAluno[] {
  return aulas.filter(
    (aula) =>
      aula.class_id !== nova.class_id && (tipo === 'once' ? aula.can_swap_from : aula.can_swap_from_permanent),
  );
}

/** O rótulo do acompanhamento (§ 3). Quem negou nunca aparece (D16). */
export function rotuloDaTroca(troca: Pick<MinhaTroca, 'status' | 'decidedVia' | 'approvedByName'>): string {
  switch (troca.status) {
    case 'pending':
      return 'Troca pendente';
    case 'approved':
      if (troca.decidedVia === 'system') return 'Troca abonada: a aula nova foi cancelada';
      return troca.approvedByName !== null ? `Troca aprovada por ${troca.approvedByName}` : 'Troca aprovada';
    case 'rejected':
      return 'Troca negada';
    case 'expired':
      return 'Troca expirada · vale a aula original';
    case 'cancelled':
      return troca.decidedVia === 'student' ? 'Você desistiu da troca' : 'Troca cancelada';
  }
}

export function tomDaTroca(status: MinhaTroca['status']): TomDoSelo {
  if (status === 'approved') return 'destaque';
  if (status === 'rejected') return 'erro';
  if (status === 'pending') return 'aviso';
  return 'neutro';
}

/** "Muay Thai · seg 06/10 19:00", ou o aviso de aula removida. */
export function descricaoDaAulaDaTroca(titulo: string | null, quando: string | null): string {
  if (titulo === null || quando === null) return 'Aula removida';
  return `${titulo} · ${diaEHora(quando)}`;
}
