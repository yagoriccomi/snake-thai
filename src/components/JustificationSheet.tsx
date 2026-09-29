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
import { createLogger } from '@/lib/logger';
import {
  AnexoIndisponivelError,
  JUSTIFICATION_MESSAGE_MAX,
  JustificativaInvalidaError,
} from '@/services/justifications.service';
import { useTheme } from '@/theme/ThemeProvider';
import { classifyError } from '@/utils/errors';

const log = createLogger('JustificationSheet');

/** O texto foi, o arquivo não (§ 9.1, fluxo 3): a justificativa vale só com o texto. */
export const AVISO_DE_ANEXO_QUE_FALHOU = 'A justificativa foi enviada, mas o anexo não. Ela vale só com o texto.';

/** O que o aluno preencheu — o envio em si é de quem abriu a folha. */
export interface JustificationDraft {
  message: string;
  attachment: PickedFile | null;
}

interface JustificationSheetProps {
  visible: boolean;
  /** Título da aula (na falta avisada). */
  classTitle?: string;
  /** Padrão "Falta avisada". */
  titulo?: string;
  /** Linha de contexto; padrão: a aula e a regra da chamada. */
  contexto?: string;
  /** Depois do "Não vou", pergunta antes se quer justificar. Padrão: sim. */
  perguntarSeQuer?: boolean;
  /** A semana e o reenvio vão sem anexo até o G2. Padrão: sim. */
  permiteAnexo?: boolean;
  onClose: () => void;
  /**
   * Deve lançar em caso de falha; a folha mostra a mensagem e continua aberta.
   * Devolver um texto (ex.: o anexo não foi) mostra o aviso e troca o botão por Fechar.
   */
  onSubmit: (draft: JustificationDraft) => Promise<string | undefined | void>;
}

const FALHA_NO_ENVIO = 'Não foi possível enviar a justificativa. Tente de novo.';

/**
 * As recusas do banco (§ 9.1), de rede e de validação chegam à tela como estão;
 * a falha interna vira mensagem genérica, sem detalhe técnico. [#93]
 */
function mensagemDeErro(erro: unknown): string {
  if (erro instanceof JustificativaInvalidaError || erro instanceof AnexoIndisponivelError) {
    return erro.message;
  }
  const { kind, message } = classifyError(erro);
  return kind === 'interno' ? FALHA_NO_ENVIO : message;
}

/**
 * Folha da justificativa (§ 9.1): depois do "Não vou" (a falta já está
 * declarada, e o aluno decide se "Acrescentar justificativa?"), na semana do
 * livre e no reenvio. O motivo escrito, de até 255 caracteres, é obrigatório;
 * a imagem ou o PDF são opcionais (docs/FREQUENCIA.md).
 *
 * É uma `BottomSheet`, não um `Modal`: o campo de mensagem ficava escondido
 * atrás do teclado no Android (ver Portal.tsx).
 *
 * Remonte com `key` para cada aula: o rascunho é local e não deve vazar de
 * uma aula para outra.
 */
export function JustificationSheet({
  visible,
  classTitle = '',
  titulo = 'Falta avisada',
  contexto,
  perguntarSeQuer = true,
  permiteAnexo = true,
  onClose,
  onSubmit,
}: JustificationSheetProps): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const [querJustificar, setQuerJustificar] = useState(!perguntarSeQuer);
  const [aviso, setAviso] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState('');
  const [anexo, setAnexo] = useState<PickedFile | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Contrato § 9.1: o motivo escrito é obrigatório; o anexo é opcional.
  const podeEnviar = mensagem.trim() !== '';

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
      const avisoDoEnvio = await onSubmit({ message: mensagem, attachment: anexo });
      if (typeof avisoDoEnvio === 'string') {
        setAviso(avisoDoEnvio);
        return;
      }
      onClose();
    } catch (falha) {
      log.warn('Justificativa não enviada', falha);
      setErro(mensagemDeErro(falha));
    } finally {
      setEnviando(false);
    }
  }, [onSubmit, onClose, mensagem, anexo]);

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <AppText variant="subtitle">{titulo}</AppText>
      <AppText variant="caption" color={colors.textSecondary}>
        {contexto ?? `${classTitle} · a presença só vale com a chamada do professor.`}
      </AppText>

      {perguntarSeQuer ? (
        <Checkbox
          checked={querJustificar}
          onChange={setQuerJustificar}
          accessibilityLabel="Acrescentar justificativa?"
          style={styles.checkbox}
        >
          <AppText variant="body">Acrescentar justificativa?</AppText>
        </Checkbox>
      ) : null}

      {aviso !== null ? (
        <>
          <AppText variant="caption" color={colors.warning} accessibilityRole="alert">
            {aviso}
          </AppText>
          <Button title="Fechar" variant="secondary" onPress={onClose} />
        </>
      ) : querJustificar ? (
        <>
          <TextInput
            value={mensagem}
            onChangeText={setMensagem}
            maxLength={JUSTIFICATION_MESSAGE_MAX}
            multiline
            placeholder="Conte o motivo da falta (obrigatório)"
            placeholderTextColor={colors.textSecondary}
            style={styles.mensagem}
            accessibilityLabel="Motivo da falta"
          />
          <Text style={styles.contador}>
            {mensagem.length}/{JUSTIFICATION_MESSAGE_MAX}
          </Text>

          {!permiteAnexo ? null : anexo !== null ? (
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
