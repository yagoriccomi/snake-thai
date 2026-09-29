import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Stepper } from '@/components/Stepper';
import { createLogger } from '@/lib/logger';
import { definirMetaSemanal } from '@/services/aulas.service';
import { useTheme } from '@/theme/ThemeProvider';
import { formatDayMonth, formatWeekday } from '@/utils/datetime';
import { describeError } from '@/utils/errors';
import { segundaDaSemana } from '@/utils/aulasDoAluno';

const log = createLogger('MetaSemanalSheet');

/** Faixa da meta (§ 5.3, `weekly_goals_meta_valida`). */
const META_MINIMA = 1;
const META_MAXIMA = 6;

interface MetaSemanalSheetProps {
  visible: boolean;
  /** A meta que vale nesta semana. */
  metaAtual: number;
  onClose: () => void;
  onSalva: () => void;
}

/** "{seg dd/mm}" da § 3, pela data local `AAAA-MM-DD`. */
function segundaEmTexto(dataIso: string): string {
  const iso = `${dataIso}T12:00:00`;
  return `${formatWeekday(iso).toLowerCase()} ${formatDayMonth(iso)}`;
}

/**
 * A meta do à vontade (§ 5.3, D36–D38, mockup da linha B). Vale a partir da
 * próxima segunda; a desta semana continua.
 */
export function MetaSemanalSheet({ visible, metaAtual, onClose, onSalva }: MetaSemanalSheetProps): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(), []);
  const [meta, setMeta] = useState(metaAtual);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const proximaSegunda = useMemo(() => {
    const segunda = segundaDaSemana(new Date());
    segunda.setDate(segunda.getDate() + 7);
    const pad = (n: number): string => String(n).padStart(2, '0');
    return `${segunda.getFullYear()}-${pad(segunda.getMonth() + 1)}-${pad(segunda.getDate())}`;
  }, []);

  const salvar = useCallback(async () => {
    setSalvando(true);
    setErro(null);
    try {
      await definirMetaSemanal(meta);
      onSalva();
      onClose();
    } catch (falha) {
      log.warn('Falha ao salvar a meta semanal', falha);
      setErro(describeError(falha));
    } finally {
      setSalvando(false);
    }
  }, [meta, onSalva, onClose]);

  return (
    <BottomSheet visible={visible} onClose={salvando ? () => undefined : onClose}>
      <AppText variant="subtitle" accessibilityRole="header">
        Meta da próxima semana
      </AppText>
      <Stepper
        value={meta}
        min={META_MINIMA}
        max={META_MAXIMA}
        onChange={setMeta}
        unidade="aula por semana"
        legenda={`${meta} aulas por semana`}
      />
      <AppText variant="caption" color={colors.textSecondary}>
        {`Vale a partir de ${segundaEmTexto(proximaSegunda)}. A meta desta semana continua ${metaAtual}x. Para a próxima semana, você pode mudar até domingo às 23:59; sem mudança, a meta se repete.`}
      </AppText>
      <AppText variant="caption" color={colors.textSecondary}>
        A meta é só para você acompanhar: não gera alerta de frequência baixa.
      </AppText>
      {erro !== null ? (
        <AppText variant="caption" color={colors.error} accessibilityRole="alert">
          {erro}
        </AppText>
      ) : null}
      <View style={styles.acoes}>
        <Button title="Fechar" variant="secondary" onPress={onClose} disabled={salvando} style={styles.metade} />
        <Button title="Salvar meta" onPress={() => void salvar()} loading={salvando} style={styles.metade} />
      </View>
    </BottomSheet>
  );
}

function makeStyles() {
  return StyleSheet.create({
    acoes: { flexDirection: 'row', gap: 12, marginTop: 4 },
    metade: { flex: 1 },
  });
}
