import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { createLogger } from '@/lib/logger';
import { decidirJustificativa, type JustificativaParaRevisar } from '@/services/justifications.service';
import { useTheme } from '@/theme/ThemeProvider';
import { describeError } from '@/utils/errors';
import { assuntoDaJustificativa } from '@/utils/justificativas';

const log = createLogger('DecidirJustificativaSheet');

/** O teto da nota aceito pelo banco (§ 9.1). */
const NOTA_MAXIMA = 500;

type Decisao = 'approved' | 'rejected';

interface DecidirJustificativaSheetProps {
  justificativa: JustificativaParaRevisar | null;
  onClose: () => void;
  /** Depois que o banco aceitou: a lista recarrega. */
  onDecidida: () => void;
}

/**
 * Aprovar ou negar (D15, § 9.1). A nota é obrigatória nas duas decisões e
 * fica só para o admin (D16): o aluno nunca a lê, nem sabe quem negou.
 */
export function DecidirJustificativaSheet({
  justificativa,
  onClose,
  onDecidida,
}: DecidirJustificativaSheetProps): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(), []);
  const [nota, setNota] = useState('');
  const [salvando, setSalvando] = useState<Decisao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const id = justificativa?.id ?? null;

  useEffect(() => {
    setNota('');
    setErro(null);
  }, [id]);

  const decidir = async (decisao: Decisao): Promise<void> => {
    if (id === null) return;
    setSalvando(decisao);
    setErro(null);
    try {
      await decidirJustificativa(id, decisao, nota);
      onDecidida();
      onClose();
    } catch (falha) {
      log.error('Falha ao decidir a justificativa', falha, { justificationId: id });
      setErro(describeError(falha));
    } finally {
      setSalvando(null);
    }
  };

  const semNota = nota.trim() === '';

  return (
    <BottomSheet visible={justificativa !== null} onClose={salvando !== null ? () => undefined : onClose}>
      <AppText variant="subtitle" accessibilityRole="header">
        Revisar justificativa
      </AppText>
      {justificativa !== null ? (
        <View style={styles.resumo}>
          <AppText variant="body">{justificativa.studentName ?? 'Aluno'}</AppText>
          <AppText variant="caption" color={colors.textSecondary}>
            {assuntoDaJustificativa(justificativa)}
            {justificativa.attempt >= 2 ? ' · 2ª tentativa' : ''}
          </AppText>
          {justificativa.message !== null ? <AppText variant="body">{`“${justificativa.message}”`}</AppText> : null}
        </View>
      ) : null}
      <Input
        label="Nota da decisão (obrigatória)"
        value={nota}
        onChangeText={setNota}
        multiline
        maxLength={NOTA_MAXIMA}
        placeholder="Ex.: atestado conferido."
      />
      <AppText variant="caption" color={colors.textSecondary}>
        A nota fica só para a administração. O aluno vê se foi aprovada e, na aprovação, quem aprovou.
      </AppText>
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
