import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Checkbox } from '@/components/Checkbox';
import {
  pickDocumentProof,
  pickImageProof,
  type PickedFile,
} from '@/services/filePicker.service';
import {
  AnexoIndisponivelError,
  JUSTIFICATION_MESSAGE_MAX,
  JustificativaInvalidaError,
} from '@/services/justifications.service';
import { useTheme } from '@/theme/ThemeProvider';

/** O que o aluno preencheu — o envio em si é de quem abriu a folha. */
export interface JustificationDraft {
  message: string;
  attachment: PickedFile | null;
}

interface JustificationSheetProps {
  visible: boolean;
  classTitle: string;
  onClose: () => void;
  /** Deve lançar em caso de falha; a folha mostra a mensagem e continua aberta. */
  onSubmit: (draft: JustificationDraft) => Promise<void>;
}

const FALHA_NO_ENVIO = 'Não foi possível enviar a justificativa. Tente de novo.';

/** Só erros escritos para o aluno chegam à tela; o resto vira mensagem genérica. [#93] */
function mensagemDeErro(erro: unknown): string {
  if (erro instanceof JustificativaInvalidaError || erro instanceof AnexoIndisponivelError) {
    return erro.message;
  }
  return FALHA_NO_ENVIO;
}

/**
 * Folha exibida depois que o aluno avisa a falta. A falta já está declarada;
 * aqui ele decide se "Acrescentar justificativa?" — mensagem de até 255
 * caracteres e/ou imagem ou PDF (docs/FREQUENCIA.md).
 *
 * É uma `BottomSheet`, não um `Modal`: o campo de mensagem ficava escondido
 * atrás do teclado no Android (ver Portal.tsx).
 *
 * Remonte com `key` para cada aula: o rascunho é local e não deve vazar de
 * uma aula para outra.
 */
export function JustificationSheet({
  visible,
  classTitle,
  onClose,
  onSubmit,
}: JustificationSheetProps): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const [querJustificar, setQuerJustificar] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [anexo, setAnexo] = useState<PickedFile | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const podeEnviar = mensagem.trim() !== '' || anexo !== null;

  const escolher = useCallback(async (picker: () => Promise<PickedFile | null>) => {
    setErro(null);
    const arquivo = await picker();
    if (arquivo !== null) {
      setAnexo(arquivo);
    }
  }, []);

  const handleEnviar = useCallback(async () => {
    setEnviando(true);
    setErro(null);
    try {
      await onSubmit({ message: mensagem, attachment: anexo });
      onClose();
    } catch (falha) {
      setErro(mensagemDeErro(falha));
    } finally {
      setEnviando(false);
    }
  }, [onSubmit, onClose, mensagem, anexo]);

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <AppText variant="subtitle">Falta avisada</AppText>
      <AppText variant="caption" color={colors.textSecondary}>
        {classTitle} · a presença só vale com a chamada do professor.
      </AppText>

      <Checkbox
        checked={querJustificar}
        onChange={setQuerJustificar}
        accessibilityLabel="Acrescentar justificativa?"
        style={styles.checkbox}
      >
        <AppText variant="body">Acrescentar justificativa?</AppText>
      </Checkbox>

      {querJustificar ? (
        <>
          <TextInput
            value={mensagem}
            onChangeText={setMensagem}
            maxLength={JUSTIFICATION_MESSAGE_MAX}
            multiline
            placeholder="Conte o motivo da falta"
            placeholderTextColor={colors.textSecondary}
            style={styles.mensagem}
            accessibilityLabel="Mensagem da justificativa"
          />
          <Text style={styles.contador}>
            {mensagem.length}/{JUSTIFICATION_MESSAGE_MAX}
          </Text>

          {anexo !== null ? (
            <View style={styles.anexo}>
              <Ionicons name="document-attach-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.anexoNome} numberOfLines={1}>
                {anexo.name}
              </Text>
              <Pressable
                onPress={() => setAnexo(null)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Remover anexo"
              >
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
          ) : (
            <View style={styles.botoes}>
              <Button
                title="Anexar imagem"
                variant="secondary"
                onPress={() => void escolher(pickImageProof)}
                style={styles.botao}
              />
              <Button
                title="Anexar PDF"
                variant="secondary"
                onPress={() => void escolher(pickDocumentProof)}
                style={styles.botao}
              />
            </View>
          )}

          {erro !== null ? (
            <AppText variant="caption" color={colors.error}>
              {erro}
            </AppText>
          ) : null}

          <Button
            title="Enviar justificativa"
            onPress={() => void handleEnviar()}
            disabled={!podeEnviar}
            loading={enviando}
            accessibilityHint="Envia a justificativa para o professor analisar"
          />
        </>
      ) : (
        <Button title="Fechar" variant="secondary" onPress={onClose} />
      )}
    </BottomSheet>
  );
}

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  fonts: ReturnType<typeof useTheme>['fonts'],
) {
  return StyleSheet.create({
    checkbox: { marginTop: 4 },
    mensagem: {
      minHeight: 96,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      textAlignVertical: 'top',
      fontFamily: fonts.body,
      fontSize: 15,
      color: colors.textPrimary,
      backgroundColor: colors.inputBackground,
    },
    contador: {
      alignSelf: 'flex-end',
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.textSecondary,
      fontVariant: ['tabular-nums'],
    },
    botoes: { flexDirection: 'row', gap: 10 },
    botao: { flex: 1 },
    anexo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: 44,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    anexoNome: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.textPrimary },
  });
}
