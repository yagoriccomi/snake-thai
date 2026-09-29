import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { ROTULO_DO_PEDIDO, TEXTO_MAXIMO } from '@/constants/solicitacoes';
import { createLogger } from '@/lib/logger';
import { decidirSolicitacao, fetchSolicitacaoParaDecidir, type SolicitacaoParaDecidir } from '@/services/solicitacoes.service';
import { useTheme } from '@/theme/ThemeProvider';
import { formatFullDateTime } from '@/utils/datetime';
import { describeError } from '@/utils/errors';

const log = createLogger('DecidirSolicitacaoSheet');

type Decisao = 'approved' | 'rejected';

/** O que a aprovação faz, dito antes de aprovar (§ 9.3). */
const EFEITO_DA_APROVACAO: Record<SolicitacaoParaDecidir['kind'], string> = {
  student_was_present: 'Aprovar dá presença ao aluno nesta aula, como uma retificação da chamada.',
  teacher_was_present: 'Aprovar dá presença ao professor nesta aula.',
  teacher_absence: 'Aprovar abona a aula para o professor.',
  teacher_asks_edit: 'Aprovar só marca o pedido como resolvido: corrija a chamada pela tela dela.',
  teacher_asks_inclusion: 'Aprovar inclui o professor na aula, com presença.',
};

interface DecidirSolicitacaoSheetProps {
  /** O id da solicitação; `null` fecha a folha. */
  id: string | null;
  onClose: () => void;
  onDecidida: () => void;
}

/**
 * A folha de decisão (§ 9.3): o pedido, quem pediu, a aula e o texto. A nota
 * é obrigatória e fica só para a administração (D16).
 */
export function DecidirSolicitacaoSheet({ id, onClose, onDecidida }: DecidirSolicitacaoSheetProps): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(), []);
  const [pedido, setPedido] = useState<SolicitacaoParaDecidir | null>(null);
  const [erroDaCarga, setErroDaCarga] = useState<string | null>(null);
  const [nota, setNota] = useState('');
  const [salvando, setSalvando] = useState<Decisao | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setPedido(null);
    setErroDaCarga(null);
    setNota('');
    setErro(null);
    if (id === null) return undefined;
    let cancelado = false;
    fetchSolicitacaoParaDecidir(id)
      .then((resultado) => {
        if (!cancelado) setPedido(resultado);
      })
      .catch((falha: unknown) => {
        log.error('Falha ao carregar a solicitação', falha, { requestId: id });
        if (!cancelado) setErroDaCarga(describeError(falha));
      });
    return () => {
      cancelado = true;
    };
  }, [id]);

  const decidir = async (decisao: Decisao): Promise<void> => {
    if (id === null) return;
    setSalvando(decisao);
    setErro(null);
    try {
      await decidirSolicitacao(id, decisao, nota);
      onDecidida();
      onClose();
    } catch (falha) {
      log.error('Falha ao decidir a solicitação', falha, { requestId: id });
      setErro(describeError(falha));
    } finally {
      setSalvando(null);
    }
  };

  const semNota = nota.trim() === '';

  return (
    <BottomSheet visible={id !== null} onClose={salvando !== null ? () => undefined : onClose}>
      <AppText variant="subtitle" accessibilityRole="header">
        {pedido !== null ? ROTULO_DO_PEDIDO[pedido.kind] : 'Solicitação'}
      </AppText>
      {pedido === null && erroDaCarga === null ? (
        <ActivityIndicator color={colors.primary} accessibilityLabel="Carregando a solicitação" />
      ) : null}
      {erroDaCarga !== null ? (
        <AppText variant="caption" color={colors.error} accessibilityRole="alert">
          {erroDaCarga}
        </AppText>
      ) : null}
      {pedido !== null ? (
        <>
          <View style={styles.resumo}>
            <AppText variant="body">{pedido.subjectName ?? 'Pessoa'}</AppText>
            <AppText variant="caption" color={colors.textSecondary}>
              {`${pedido.classTitle} · ${formatFullDateTime(pedido.classDateTime)}`}
            </AppText>
            <AppText variant="body">{`"${pedido.texto}"`}</AppText>
            {pedido.anexos > 0 ? (
              <AppText variant="caption" color={colors.textSecondary}>
                {`${pedido.anexos === 1 ? '1 anexo' : `${pedido.anexos} anexos`} (abre quando o servidor novo for publicado)`}
              </AppText>
            ) : null}
          </View>
          <AppText variant="caption" color={colors.textSecondary}>
            {EFEITO_DA_APROVACAO[pedido.kind]}
          </AppText>
          <Input
            label="Nota da decisão (obrigatória)"
            value={nota}
            onChangeText={setNota}
            multiline
            maxLength={TEXTO_MAXIMO}
            placeholder="Ex.: conferido com a recepção."
          />
          {erro !== null ? (
            <AppText variant="caption" color={colors.error} accessibilityRole="alert">
              {erro}
            </AppText>
          ) : null}
          <View style={styles.acoes}>
            <Button
              title="Negar"
              variant="danger"
              onPress={() => void decidir('rejected')}
              loading={salvando === 'rejected'}
              disabled={semNota || salvando !== null}
              style={styles.metade}
            />
            <Button
              title="Aprovar"
              onPress={() => void decidir('approved')}
              loading={salvando === 'approved'}
              disabled={semNota || salvando !== null}
              style={styles.metade}
            />
          </View>
        </>
      ) : null}
    </BottomSheet>
  );
}

function makeStyles() {
  return StyleSheet.create({
    resumo: { gap: 4 },
    acoes: { flexDirection: 'row', gap: 12, marginTop: 4 },
    metade: { flex: 1 },
  });
}
