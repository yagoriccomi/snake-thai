import { useCallback, useState } from 'react';

import { AVISO_DE_ANEXO_QUE_FALHOU, type JustificationDraft } from '@/components/JustificationSheet';
import type { AulaDoAluno, ResultadoDaDeclaracao } from '@/services/aulas.service';
import { enviarJustificativa as enviarAoBanco } from '@/services/justifications.service';
import { abrirSolicitacao } from '@/services/solicitacoes.service';

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
 *   quando a aula ainda aceita (`can_justify`) e ainda não tem justificativa
 *   (§ 9.1: uma por aula; o estado e o reenvio ficam em Minhas justificativas);
 * - "Desmarcar" limpa.
 */
export function useAcoesDaAula({ userId, declarar, recarregar }: Parametros) {
  const [aviso, setAviso] = useState<AvisoDeCota | null>(null);
  const [aulaDaFalta, setAulaDaFalta] = useState<AulaDoAluno | null>(null);
  const [aulaDoPedido, setAulaDoPedido] = useState<AulaDoAluno | null>(null);

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
      if (aula.can_justify && aula.justification_id === null) setAulaDaFalta(aula);
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
    async (rascunho: JustificationDraft): Promise<string | undefined> => {
      if (userId === null || aulaDaFalta === null) return undefined;
      const { anexoFalhou } = await enviarAoBanco({
        scope: 'class',
        classId: aulaDaFalta.class_id,
        weekStart: null,
        texto: rascunho.message,
        anexo: rascunho.attachment,
      });
      await recarregar();
      return anexoFalhou ? AVISO_DE_ANEXO_QUE_FALHOU : undefined;
    },
    [userId, aulaDaFalta, recarregar],
  );

  // "Eu estava na aula" (§ 9.3): o banco confere tudo; a linha some depois.
  const onEuEstava = useCallback((aula: AulaDoAluno) => setAulaDoPedido(aula), []);
  const fecharPedido = useCallback(() => setAulaDoPedido(null), []);
  const enviarPedido = useCallback(
    async (texto: string): Promise<void> => {
      if (aulaDoPedido === null) return;
      await abrirSolicitacao('student_was_present', aulaDoPedido.class_id, texto);
      await recarregar();
    },
    [aulaDoPedido, recarregar],
  );

  return {
    aviso,
    aulaDaFalta,
    aulaDoPedido,
    onEuEstava,
    fecharPedido,
    enviarPedido,
    onVou,
    onNaoVou,
    onDesmarcar,
    desfazerAviso,
    fecharAviso,
    fecharFalta,
    enviarJustificativa,
  };
}
