import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Checkbox } from '@/components/Checkbox';
import { LegalDocumentLinks } from '@/components/LegalDocumentLinks';
import { LegalDocumentModal } from '@/components/LegalDocumentModal';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { useAuth } from '@/context/AuthProvider';
import { useLegalConsent } from '@/context/LegalConsentProvider';
import { useLegalDocuments } from '@/hooks/useLegalDocuments';
import { createLogger } from '@/lib/logger';
import { acceptLegalDocuments, type DocumentoLegalVigente } from '@/services/legalDocuments.service';
import { useTheme } from '@/theme/ThemeProvider';
import { describeError } from '@/utils/errors';
import { rotuloDoAceite } from '@/utils/legalText';

const log = createLogger('AceiteDocumentosScreen');

/**
 * Novo aceite (L4): aparece depois do login quando a academia publicou uma
 * versão da Política de Privacidade ou dos Termos de Uso que a pessoa ainda
 * não aceitou. Só se sai daqui aceitando ou saindo da conta.
 *
 * Os documentos listados vêm com o texto (a pessoa aceita o que pode ler); se
 * a versão mudar enquanto ela lê, o banco recusa e a lista recarrega.
 */
export function AceiteDocumentosScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const { signOut } = useAuth();
  const { verificar } = useLegalConsent();
  const { documentos, carregando, erro, recarregar } = useLegalDocuments();

  const [concordo, setConcordo] = useState(false);
  const [lendo, setLendo] = useState<DocumentoLegalVigente | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erroDoAceite, setErroDoAceite] = useState<string | null>(null);
  const [saindo, setSaindo] = useState(false);

  const pendentes = useMemo(() => documentos.filter((documento) => documento.aceitoEm === null), [documentos]);
  const semPendencia = !carregando && erro === null && pendentes.length === 0;

  // Aceito em outro aparelho enquanto esta tela abria: confere de novo e libera.
  useEffect(() => {
    if (semPendencia) void verificar();
  }, [semPendencia, verificar]);

  const aceitar = useCallback(async () => {
    setEnviando(true);
    setErroDoAceite(null);
    try {
      await acceptLegalDocuments(pendentes.map((documento) => documento.id));
      await verificar();
    } catch (falha) {
      log.error('Falha ao registrar o aceite dos documentos legais', falha);
      setErroDoAceite(describeError(falha));
      // Se a versão mudou, a lista nova precisa ser lida e aceita de novo.
      setConcordo(false);
      void recarregar();
    } finally {
      setEnviando(false);
    }
  }, [pendentes, verificar, recarregar]);

  const sair = useCallback(async () => {
    setSaindo(true);
    try {
      await signOut();
    } catch (falha) {
      log.error('Falha ao sair da conta na tela de aceite', falha);
      setErroDoAceite(describeError(falha));
    } finally {
      setSaindo(false);
    }
  }, [signOut]);

  const fecharLeitura = useCallback(() => setLendo(null), []);

  return (
    <ScreenWrapper>
      <ScrollView contentContainerStyle={styles.conteudo} showsVerticalScrollIndicator={false}>
        <AppText variant="heading" accessibilityRole="header">
          Termos atualizados
        </AppText>
        <AppText variant="body" color={colors.textSecondary}>
          A academia publicou uma nova versão dos documentos abaixo. Leia e aceite para continuar usando o app.
        </AppText>

        {carregando ? (
          <View style={styles.carregando} accessible accessibilityLabel="Carregando os documentos">
            <ActivityIndicator color={colors.primary} />
            <AppText variant="caption">Carregando os documentos…</AppText>
          </View>
        ) : null}

        {!carregando && erro !== null ? (
          <View style={styles.bloco}>
            <AppText variant="caption" color={colors.error} accessibilityLiveRegion="polite">
              {erro}
            </AppText>
            <Button title="Tentar de novo" variant="secondary" onPress={() => void recarregar()} />
          </View>
        ) : null}

        {!carregando && erro === null && pendentes.length > 0 ? (
          <View style={styles.bloco}>
            <LegalDocumentLinks documentos={pendentes} onLer={setLendo} mostrarVersao />
            <Checkbox checked={concordo} onChange={setConcordo} accessibilityLabel={rotuloDoAceite(pendentes)}>
              <AppText variant="caption" color={colors.textPrimary}>
                {rotuloDoAceite(pendentes)}
              </AppText>
            </Checkbox>
          </View>
        ) : null}

        {erroDoAceite !== null ? (
          <AppText variant="caption" color={colors.error} accessibilityLiveRegion="polite">
            {erroDoAceite}
          </AppText>
        ) : null}
      </ScrollView>

      <View style={styles.rodape}>
        <Button
          title="Aceitar e continuar"
          onPress={() => void aceitar()}
          loading={enviando}
          disabled={!concordo || pendentes.length === 0 || carregando}
        />
        <Button title="Sair da conta" variant="secondary" onPress={() => void sair()} loading={saindo} />
        <AppText variant="caption" style={styles.aviso}>
          Se não concordar, saia da conta e peça à academia a exclusão dos seus dados.
        </AppText>
      </View>

      <LegalDocumentModal documento={lendo} onClose={fecharLeitura} />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  conteudo: {
    paddingTop: 24,
    paddingBottom: 16,
    gap: 12,
  },
  carregando: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  bloco: {
    gap: 14,
    marginTop: 8,
  },
  rodape: {
    gap: 10,
    paddingTop: 12,
    paddingBottom: 8,
  },
  aviso: {
    textAlign: 'center',
  },
});
