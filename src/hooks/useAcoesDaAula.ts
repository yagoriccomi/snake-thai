import { useCallback, useState } from 'react';

import type { JustificationDraft } from '@/components/JustificationSheet';
import type { AulaDoAluno, ResultadoDaDeclaracao } from '@/services/aulas.service';
import { submitJustification } from '@/services/justifications.service';

export interface AvisoDeCota {
  aula: AulaDoAluno;
  marcadas: number;
  cota: number;
}

interface Parametros {
  userId: string | null;
  declarar: (aula: AulaDoAluno, vou: boolean) => Promise<ResultadoDaDeclaracao | null>;
  recarregar: () => Promise<void>;
}

/**
 * As ações de declaração da lista de Aulas e do menu Aulas da semana, num lugar
 * só (§ 9.2, § 12.2):
 * - "Vou" marca e, acima da cota, mostra o aviso com Desfazer (D4: nunca
 *   bloqueia);
 * - "Não vou" na aula da grade do fixo grava a falta e abre a justificativa,
 *   quando a aula ainda aceita (`can_justify`, ou a justificativa pendente);
 * - "Desmarcar" limpa.
 */
export function useAcoesDaAula({ userId, declarar, recarregar }: Parametros) {
  const [aviso, setAviso] = useState<AvisoDeCota | null>(null);
  const [aulaDaFalta, setAulaDaFalta] = useState<AulaDoAluno | null>(null);

  const onVou = useCallback(
    async (aula: AulaDoAluno) => {
      setAviso(null);
      const resultado = await declarar(aula, true);
      if (resultado !== null && resultado.acimaDaCota && resultado.cota !== null) {
        setAviso({ aula, marcadas: resultado.marcadasNaSemana, cota: resultado.cota });
      }
    },
    [declarar],
  );

  const onDesmarcar = useCallback(
    async (aula: AulaDoAluno) => {
      setAviso(null);
      await declarar(aula, false);
    },
    [declarar],
  );

  const onNaoVou = useCallback(
    async (aula: AulaDoAluno) => {
      // Tocar de novo em "Não vou" reabre a justificativa sem regravar a falta.
      if (aula.declared_status !== 'absent' && (await declarar(aula, false)) === null) return;
      if (aula.can_justify || aula.justification_status === 'pending') setAulaDaFalta(aula);
    },
    [declarar],
  );

  const desfazerAviso = useCallback(async () => {
    if (aviso === null) return;
    const aula = aviso.aula;
    setAviso(null);
    await declarar(aula, false);
  }, [aviso, declarar]);

  const fecharAviso = useCallback(() => setAviso(null), []);
  const fecharFalta = useCallback(() => setAulaDaFalta(null), []);

  const enviarJustificativa = useCallback(
    async (rascunho: JustificationDraft) => {
      if (userId === null || aulaDaFalta === null) return;
      await submitJustification(userId, {
        classId: aulaDaFalta.class_id,
        message: rascunho.message,
        attachment: rascunho.attachment,
      });
      await recarregar();
    },
    [userId, aulaDaFalta, recarregar],
  );

  return {
    aviso,
    aulaDaFalta,
    onVou,
    onNaoVou,
    onDesmarcar,
    desfazerAviso,
    fecharAviso,
    fecharFalta,
    enviarJustificativa,
  };
}
