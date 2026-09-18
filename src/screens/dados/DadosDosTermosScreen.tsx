import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { LegalDocumentModal } from '@/components/LegalDocumentModal';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { ORDEM_DOS_DOCUMENTOS, TITULO_DO_DOCUMENTO, type TipoDeDocumentoLegal } from '@/constants/legal';
import { CAMPOS_LEGAIS, LIMITE_DO_CAMPO_LEGAL, SECOES_DE_CAMPOS_LEGAIS } from '@/constants/legalFields';
import type { Fonts } from '@/constants/theme';
import { createLogger } from '@/lib/logger';
import {
  fetchLegalFieldValues,
  previewLegalDocument,
  saveLegalFieldValues,
} from '@/services/legalFields.service';
import type { DocumentoLegalVigente } from '@/services/legalDocuments.service';
import type { ColorScheme } from '@/theme/colors';
import { useTheme } from '@/theme/ThemeProvider';
import { describeError } from '@/utils/errors';

const log = createLogger('DadosDosTermos');
const EDGES = ['bottom'] as const;

/**
 * Onde o admin preenche o que só a academia sabe (razão social, CNPJ, prazos,
 * foro) para a Política de Privacidade e os Termos de Uso.
 *
 * Aqui não se publica nada: o texto só vai ao ar numa versão nova, pela equipe
 * técnica, e isso obriga todo mundo a aceitar de novo. Esta tela existe para
 * que o texto esteja completo e conferido ANTES disso.
 */
export function DadosDosTermosScreen(): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  const [valores, setValores] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [previa, setPrevia] = useState<DocumentoLegalVigente | null>(null);
  const [gerandoPrevia, setGerandoPrevia] = useState<TipoDeDocumentoLegal | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setValores(await fetchLegalFieldValues());
    } catch (falha) {
      log.error('Falha ao carregar os dados dos termos', falha);
      setErro('Não foi possível carregar os dados. Verifique a conexão e tente de novo.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const faltando = useMemo(
    () => CAMPOS_LEGAIS.filter((campo) => (valores[campo.id] ?? '').trim() === ''),
    [valores],
  );

  const alterar = useCallback((id: string, texto: string) => {
    setSalvo(false);
    setValores((atual) => ({ ...atual, [id]: texto }));
  }, []);

  const salvar = useCallback(async () => {
    setSalvando(true);
    setErro(null);
    try {
      await saveLegalFieldValues(valores);
      setSalvo(true);
    } catch (falha) {
      log.error('Falha ao salvar os dados dos termos', falha);
      setErro(describeError(falha));
    } finally {
      setSalvando(false);
    }
  }, [valores]);

  const verPrevia = useCallback(
    async (tipo: TipoDeDocumentoLegal) => {
      setGerandoPrevia(tipo);
      setErro(null);
      try {
        // Salva antes: a prévia é montada pelo banco, com o que está gravado.
        await saveLegalFieldValues(valores);
        setSalvo(true);
        const resultado = await previewLegalDocument(tipo);
        setPrevia({
          id: `previa-${tipo}`,
          tipo,
          versao: 'rascunho',
          publicadoEm: new Date().toISOString(),
          conteudo: resultado.conteudo,
          aceitoEm: null,
        });
      } catch (falha) {
        log.error('Falha ao gerar a prévia do documento', falha);
        setErro(describeError(falha));
      } finally {
        setGerandoPrevia(null);
      }
    },
    [valores],
  );

  const fecharPrevia = useCallback(() => setPrevia(null), []);

  if (carregando) {
    return (
      <ScreenWrapper edges={EDGES}>
        <View style={styles.centro} accessible accessibilityLabel="Carregando os dados dos termos">
          <ActivityIndicator color={colors.primary} />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper edges={EDGES} avoidKeyboard>
      <ScrollView contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
        <AppText variant="body" color={colors.textSecondary}>
          Estes dados entram na Política de Privacidade e nos Termos de Uso. Preencha com calma: é o que a
          academia promete por escrito a cada aluno.
        </AppText>

        <View style={[styles.aviso, faltando.length === 0 ? styles.avisoPronto : null]} accessibilityLiveRegion="polite">
          <AppText variant="caption" color={faltando.length === 0 ? colors.success : colors.warning}>
            {faltando.length === 0
              ? 'Tudo preenchido. A equipe técnica já pode publicar os documentos.'
              : `Faltam ${faltando.length} de ${CAMPOS_LEGAIS.length} campos. Sem todos, os documentos não podem ser publicados.`}
          </AppText>
        </View>

        {SECOES_DE_CAMPOS_LEGAIS.map((secao) => (
          <View key={secao.titulo} style={styles.secao}>
            <Text style={styles.tituloDaSecao}>{secao.titulo}</Text>
            {secao.campos.map((campo) => (
              <View key={campo.id} style={styles.campo}>
                <Input
                  label={campo.rotulo}
                  value={valores[campo.id] ?? ''}
                  onChangeText={(texto) => alterar(campo.id, texto)}
                  multiline={campo.tipo === 'longo'}
                  maxLength={LIMITE_DO_CAMPO_LEGAL}
                  autoCapitalize="sentences"
                />
                <AppText variant="caption" style={styles.ajuda}>
                  {campo.ajuda} Aparece em: {campo.onde}.
                </AppText>
              </View>
            ))}
          </View>
        ))}

        {erro !== null ? (
          <AppText variant="caption" color={colors.error} accessibilityLiveRegion="polite">
            {erro}
          </AppText>
        ) : null}
        {salvo && erro === null ? (
          <AppText variant="caption" color={colors.success}>
            Dados salvos.
          </AppText>
        ) : null}

        <Button title="Salvar" onPress={() => void salvar()} loading={salvando} />

        <View style={styles.previas}>
          <AppText variant="caption">
            Veja como o texto fica com o que você preencheu. O que faltar aparece entre chaves duplas.
          </AppText>
          {ORDEM_DOS_DOCUMENTOS.map((tipo) => (
            <Button
              key={tipo}
              title={`Ver ${TITULO_DO_DOCUMENTO[tipo]}`}
              variant="secondary"
              onPress={() => void verPrevia(tipo)}
              loading={gerandoPrevia === tipo}
            />
          ))}
        </View>

        <AppText variant="caption" style={styles.rodape}>
          Publicar é passo da equipe técnica, e faz todos os alunos, professores e administradores aceitarem os
          documentos de novo ao abrir o app. Por isso não se publica daqui.
        </AppText>
      </ScrollView>

      <LegalDocumentModal documento={previa} onClose={fecharPrevia} />
    </ScreenWrapper>
  );
}

function makeStyles(colors: ColorScheme, fonts: Fonts) {
  return StyleSheet.create({
    centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    conteudo: { paddingTop: 12, paddingBottom: 32, gap: 14 },
    aviso: {
      borderWidth: 1,
      borderColor: colors.warning,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    avisoPronto: { borderColor: colors.success },
    secao: { gap: 4 },
    tituloDaSecao: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 11,
      letterSpacing: 1,
      color: colors.textSecondary,
      marginTop: 8,
      marginBottom: 4,
    },
    campo: { gap: 2 },
    ajuda: { marginBottom: 8 },
    previas: { gap: 10, marginTop: 8 },
    rodape: { marginTop: 4 },
  });
}
