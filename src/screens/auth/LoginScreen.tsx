import React, { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { SegmentedControl, type SegmentOption } from '@/components/SegmentedControl';
import { lerContasDeTeste, type ContaDeTeste } from '@/config/contasDeTeste';
import { useAuth } from '@/context/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { isValidEmail } from '@/utils/validation';

const SCREEN_EDGES = ['bottom'] as const;

/** Superfície escura levemente esverdeada do herói de marca (decorativa). */
const HERO_SURFACE = '#0F140F';

/**
 * Tela de login (layout "herói de marca"). A mesma tela atende administradores e
 * alunos — o roteamento pós-login (onboarding, lock biométrico, painel) é
 * decidido pelo estado de autenticação.
 */
export function LoginScreen(): React.JSX.Element {
  const { colors, fonts } = useTheme();
  const styles = React.useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Só o app DEV tem contas de teste (vêm do .env.dev); em produção é lista vazia.
  const contasDeTeste = React.useMemo(() => lerContasDeTeste(), []);
  const [papelEscolhido, setPapelEscolhido] = useState<ContaDeTeste['papel'] | null>(null);
  const opcoesDeTeste = React.useMemo<SegmentOption<ContaDeTeste['papel']>[]>(
    () => contasDeTeste.map((conta) => ({ value: conta.papel, label: conta.rotulo })),
    [contasDeTeste],
  );

  /** Preenche o formulário com a conta escolhida; entrar continua sendo um toque seu. */
  const usarContaDeTeste = useCallback(
    (papel: ContaDeTeste['papel']) => {
      const conta = contasDeTeste.find((candidata) => candidata.papel === papel);
      if (conta === undefined) return;
      setPapelEscolhido(papel);
      setError(null);
      setEmail(conta.email);
      setPassword(conta.senha);
    },
    [contasDeTeste],
  );
  const passwordRef = useRef<TextInput>(null);

  /** "Próximo" no teclado do e-mail leva direto ao campo de senha. */
  const focusPassword = useCallback(() => {
    passwordRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(async () => {
    setError(null);
    if (!isValidEmail(email)) {
      setError('Informe um e-mail válido.');
      return;
    }
    if (password.length === 0) {
      setError('Informe sua senha.');
      return;
    }
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch {
      setError('E-mail ou senha inválidos.');
    } finally {
      setSubmitting(false);
    }
  }, [email, password, signIn]);

  // A redefinição de senha do aluno é feita pela academia (admin), não por
  // e-mail — então orientamos, em vez de um link que não faz nada.
  const handleForgot = useCallback(() => {
    Alert.alert(
      'Esqueceu a senha?',
      'Procure a recepção da academia para redefinir seu acesso. ' +
        'Um administrador reinicia sua senha e você cria uma nova no próximo login.',
    );
  }, []);

  return (
    <ScreenWrapper edges={SCREEN_EDGES} padded={false} avoidKeyboard>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Herói de marca */}
        <View style={styles.hero}>
          <View style={styles.mark}>
            <MaterialCommunityIcons name="snake" size={34} color={colors.onPrimary} />
          </View>
          <Text style={styles.brand}>Snake Thai</Text>
          <Text style={styles.tagline}>Gestão da sua academia, no bolso.</Text>
        </View>

        {/* Formulário */}
        <View style={styles.form}>
          <Input
            label="E-mail"
            placeholder="voce@exemplo.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            returnKeyType="next"
            onSubmitEditing={focusPassword}
            submitBehavior="submit"
          />
          <Input
            ref={passwordRef}
            label="Senha"
            placeholder="••••••••"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            value={password}
            onChangeText={setPassword}
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
          />

          {error !== null ? (
            <AppText variant="caption" color={colors.error} style={styles.error}>
              {error}
            </AppText>
          ) : null}

          <Button
            title="Entrar"
            onPress={handleSubmit}
            loading={submitting}
            accessibilityHint="Autentica e acessa o aplicativo"
            style={styles.submit}
          />

          {contasDeTeste.length > 0 ? (
            <View style={styles.atalho}>
              <AppText variant="caption">Atalho de teste — preenche o login do banco local:</AppText>
              <SegmentedControl
                options={opcoesDeTeste}
                value={papelEscolhido ?? contasDeTeste[0]?.papel ?? 'admin'}
                onChange={usarContaDeTeste}
              />
            </View>
          ) : null}

          <Pressable
            onPress={handleForgot}
            hitSlop={8}
            style={styles.forgot}
            accessibilityRole="button"
            accessibilityLabel="Esqueci minha senha"
          >
            <Text style={styles.forgotText}>Esqueci minha senha</Text>
          </Pressable>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  fonts: ReturnType<typeof useTheme>['fonts'],
) {
  return StyleSheet.create({
    atalho: { gap: 8, marginTop: 18 },
    scroll: {
      flexGrow: 1,
    },
    hero: {
      backgroundColor: HERO_SURFACE,
      borderBottomWidth: 2,
      borderBottomColor: colors.primary,
      paddingHorizontal: 24,
      paddingTop: 44,
      paddingBottom: 28,
      justifyContent: 'flex-end',
      minHeight: 300,
    },
    mark: {
      width: 56,
      height: 56,
      borderRadius: 18,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 18,
    },
    brand: {
      fontFamily: fonts.headingBold,
      fontSize: 40,
      color: colors.textPrimary,
      letterSpacing: -0.5,
    },
    tagline: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 6,
    },
    form: {
      paddingHorizontal: 24,
      paddingTop: 26,
      gap: 4,
    },
    error: {
      marginBottom: 4,
    },
    submit: {
      marginTop: 8,
    },
    forgot: {
      alignSelf: 'center',
      marginTop: 16,
      padding: 4,
    },
    forgotText: {
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
      color: colors.primaryText,
    },
  });
}
