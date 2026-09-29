import React, { useCallback, useLayoutEffect, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { SolicitacoesBotao } from '@/components/SolicitacoesBotao';
import { useCaixaDeSolicitacoes } from '@/hooks/useSolicitacoes';

interface ComCabecalho {
  setOptions: (opcoes: { headerRight?: () => React.ReactNode }) => void;
}

/**
 * Põe o atalho Solicitações no cabeçalho da primeira aba da equipe (§ 9.3):
 * Aulas, para o professor, e Painel, para o admin. O contador soma o que
 * falta decidir e é relido a cada volta à tela.
 *
 * @param enabled `false` para aluno: nem a caixa é pedida.
 */
export function useAtalhoDeSolicitacoes(navigation: ComCabecalho, abrir: () => void, enabled: boolean): void {
  const caixa = useCaixaDeSolicitacoes(enabled);
  const recarregar = caixa.reload;
  const total = useMemo(() => caixa.items.reduce((soma, item) => soma + item.quantidade, 0), [caixa.items]);

  useFocusEffect(
    useCallback(() => {
      if (enabled) void recarregar();
    }, [enabled, recarregar]),
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: enabled ? () => <SolicitacoesBotao quantidade={total} onPress={abrir} /> : undefined,
    });
  }, [navigation, enabled, total, abrir]);
}
