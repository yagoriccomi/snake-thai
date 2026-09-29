import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { createLogger } from '@/lib/logger';
import { fetchPreviaDosAvisos, mudarSituacaoDaAula, type PreviaDosAvisos } from '@/services/cancelamento.service';
import { useTheme } from '@/theme/ThemeProvider';
import { textoDaPrevia } from '@/utils/cancelamento';
import { describeError } from '@/utils/errors';

const log = createLogger('SituacaoDaAulaSheet');

/** O motivo aceito pelo banco (§ 8). */
const MOTIVO_MAXIMO = 500;

interface SituacaoDaAulaSheetProps {
  visible: boolean;
  classId: string;
  acao: 'cancelar' | 'reativar';
  onClose: () => void;
  /** Depois que o banco aceitou: a tela recarrega a aula. */
  onFeito: () => void;
}

/**
 * As folhas Cancelar aula e Reativar aula (§ 6.1, D18, D25, T22; mockups da
 * linha C): quem será avisado, o motivo obrigatório e a confirmação. Os anexos
 * entram quando as rotas do servidor forem publicadas (G2).
 */
export function SituacaoDaAulaSheet({ visible, classId, acao, onClose, onFeito }: SituacaoDaAulaSheetProps): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [previa, setPrevia] = useState<PreviaDosAvisos | null>(null);
  const [erroDaPrevia, setErroDaPrevia] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const cancelar = acao === 'cancelar';

  useEffect(() => {
    if (!visible) {
      setMotivo('');
      setErro(null);
      setPrevia(null);
      setErroDaPrevia(null);
      return;
    }
    let cancelado = false;
    fetchPreviaDosAvisos(classId)
      .then((resultado) => {
        if (!cancelado) setPrevia(resultado);
      })
      .catch((falha: unknown) => {
        log.warn('Falha ao carregar quem será avisado', falha, { classId });
        if (!cancelado) setErroDaPrevia('Não foi possível ver quem será avisado. Você ainda pode seguir.');
      });
    return () => {
      cancelado = true;
    };
  }, [visible, classId]);

  const confirmar = async (): Promise<void> => {
    setSalvando(true);
    setErro(null);
    try {
      await mudarSituacaoDaAula(classId, acao, motivo.trim());
      onFeito();
      onClose();
    } catch (falha) {
      log.error(cancelar ? 'Falha ao cancelar a aula' : 'Falha ao reativar a aula', falha, { classId });
      setErro(describeError(falha));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={salvando ? () => undefined : onClose}>
      <AppText variant="subtitle" accessibilityRole="header">
        {cancelar ? 'Cancelar aula' : 'Reativar aula'}
      </AppText>
      <View style={styles.aviso}>
        <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
        {previa === null && erroDaPrevia === null ? (
          <ActivityIndicator color={colors.primary} accessibilityLabel="Carregando quem será avisado" />
        ) : (
          <AppText variant="caption" style={styles.avisoTexto}>
            {previa !== null ? textoDaPrevia(previa, acao) : erroDaPrevia}
          </AppText>
        )}
      </View>
      <Input
        label="Motivo (obrigatório)"
        value={motivo}
        onChangeText={setMotivo}
        multiline
        maxLength={MOTIVO_MAXIMO}
        placeholder={cancelar ? 'Ex.: manutenção no tatame.' : 'Ex.: o tatame ficou pronto.'}
      />
      <AppText variant="caption" color={colors.textSecondary}>
        {cancelar
          ? 'Os alunos veem só que a aula foi cancelada. O motivo fica para a equipe.'
          : 'Quem tinha trocado para esta aula e teve a troca cancelada não a recupera.'}
      </AppText>
      {erro !== null ? (
        <AppText variant="caption" color={colors.error} accessibilityRole="alert">
          {erro}
        </AppText>
      ) : null}
      <View style={styles.acoes}>
        <Button title="Voltar" variant="secondary" onPress={onClose} disabled={salvando} style={styles.metade} />
        <Button
          title={cancelar ? 'Cancelar aula' : 'Reativar aula'}
          variant={cancelar ? 'danger' : 'primary'}
          onPress={() => void confirmar()}
          loading={salvando}
          disabled={motivo.trim() === ''}
          style={styles.metade}
        />
      </View>
    </BottomSheet>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    aviso: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    avisoTexto: { flex: 1 },
    acoes: { flexDirection: 'row', gap: 12, marginTop: 4 },
    metade: { flex: 1 },
  });
}
