import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { AvisoDeMudancaDeTurma } from '@/components/AvisoDeMudancaDeTurma';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { GroupPicker } from '@/components/GroupPicker';
import { PlanPicker } from '@/components/PlanPicker';
import { createLogger } from '@/lib/logger';
import { useTheme } from '@/theme/ThemeProvider';
import { describeError } from '@/utils/errors';

const log = createLogger('TurmaOuPlanoSheet');

interface TurmaOuPlanoSheetProps {
  nome: string | null;
  turmaAtual: string | null;
  planoAtual: string | null;
  onClose: () => void;
  /** Deve lançar em caso de falha; a folha mostra a frase e continua aberta. */
  onSalvar: (turma: string | null, plano: string | null) => Promise<void>;
}

/**
 * "Trocar turma ou plano" (folha da opção A): antes, a turma e o plano
 * mudavam direto na linha, sem aviso. Agora o aviso da D58 aparece antes de
 * salvar, e nada muda sem o toque em Salvar.
 */
export function TurmaOuPlanoSheet({ nome, turmaAtual, planoAtual, onClose, onSalvar }: TurmaOuPlanoSheetProps): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(), []);
  const [turma, setTurma] = useState(turmaAtual);
  const [plano, setPlano] = useState(planoAtual);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const mudou = turma !== turmaAtual || plano !== planoAtual;

  const salvar = async (): Promise<void> => {
    setSalvando(true);
    setErro(null);
    try {
      await onSalvar(turma, plano);
      onClose();
    } catch (falha) {
      log.error('Falha ao trocar a turma ou o plano', falha);
      setErro(describeError(falha));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <BottomSheet visible onClose={salvando ? () => undefined : onClose}>
      <AppText variant="subtitle" accessibilityRole="header">
        Trocar turma ou plano
      </AppText>
      {nome !== null ? (
        <AppText variant="caption" color={colors.textSecondary}>
          {nome}
        </AppText>
      ) : null}
      <GroupPicker label="Turma" value={turma} onChange={setTurma} />
      <PlanPicker label="Plano" value={plano} onChange={setPlano} />
      <AvisoDeMudancaDeTurma turmaAtual={turmaAtual} turmaNova={turma} />
      {erro !== null ? (
        <AppText variant="caption" color={colors.error} accessibilityRole="alert">
          {erro}
        </AppText>
      ) : null}
      <View style={styles.acoes}>
        <Button title="Voltar" variant="secondary" onPress={onClose} disabled={salvando} style={styles.metade} />
        <Button title="Salvar" onPress={() => void salvar()} loading={salvando} disabled={!mudou} style={styles.metade} />
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
