import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { ConfirmarExclusaoSheet } from '@/components/ConfirmarExclusaoSheet';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { GroupPicker } from '@/components/GroupPicker';
import { Input } from '@/components/Input';
import { PlanPicker } from '@/components/PlanPicker';
import { ScreenWrapper } from '@/components/ScreenWrapper';
import { SegmentedControl, type SegmentOption } from '@/components/SegmentedControl';
import { createLogger } from '@/lib/logger';
import type { DadosStackScreenProps } from '@/navigation/types';
import { fetchStudentPayments } from '@/services/payments.service';
import {
  deleteUserAccount,
  fetchProfile,
  fetchUserEmail,
  updateStudentByAdmin,
  updateUserEmail,
} from '@/services/profile.service';
import { useTheme } from '@/theme/ThemeProvider';
import type { Profile } from '@/types/models';
import { describeError } from '@/utils/errors';
import { dateIsoToBr, maskCpf, maskDate, maskPhone } from '@/utils/masks';
import { contarMensalidadesEmAberto } from '@/utils/payments';
import {
  normalizarFormularioDeAluno,
  validarEmailDoAluno,
  validarFormularioDeAluno,
  type ErrosDoFormularioDeAluno,
  type ValoresDoFormularioDeAluno,
} from '@/utils/studentForm';

const log = createLogger('EditarAlunoScreen');

type Situacao = 'ativo' | 'trancado';

const SITUACOES: ReadonlyArray<SegmentOption<Situacao>> = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'trancado', label: 'Trancado' },
];

interface Aviso {
  texto: string;
  tipo: 'sucesso' | 'erro';
}

function valoresDoPerfil(perfil: Profile): ValoresDoFormularioDeAluno {
  return {
    nome: perfil.name ?? '',
    cpf: perfil.cpf === null ? '' : maskCpf(perfil.cpf),
    celular: perfil.phone === null ? '' : maskPhone(perfil.phone),
    nascimento: perfil.dob === null ? '' : dateIsoToBr(perfil.dob),
  };
}

/**
 * Edição dos dados de um aluno pelo admin: dados pessoais, turma, plano,
 * situação e e-mail de login — e, na zona de perigo, a exclusão da conta (LGPD).
 *
 * Aluno que ainda não fez o primeiro acesso tem nome e CPF travados: são dele,
 * informados no onboarding. Conta de administrador não é excluída aqui (rebaixe
 * antes, na gestão). A permissão de verdade é do banco e das Edge Functions.
 */
export function EditarAlunoScreen({
  navigation,
  route,
}: DadosStackScreenProps<'EditarAluno'>): React.JSX.Element {
  const { userId } = route.params;
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  const [perfil, setPerfil] = useState<Profile | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [mensalidadesEmAberto, setMensalidadesEmAberto] = useState<number | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroDeCarga, setErroDeCarga] = useState<string | null>(null);

  const [valores, setValores] = useState<ValoresDoFormularioDeAluno>({ nome: '', cpf: '', celular: '', nascimento: '' });
  const [groupId, setGroupId] = useState<string | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [situacao, setSituacao] = useState<Situacao>('ativo');
  const [erros, setErros] = useState<ErrosDoFormularioDeAluno>({});
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<Aviso | null>(null);

  const [folhaDoEmail, setFolhaDoEmail] = useState(false);
  const [novoEmail, setNovoEmail] = useState('');
  const [trocandoEmail, setTrocandoEmail] = useState(false);
  const [erroDoEmail, setErroDoEmail] = useState<string | null>(null);

  const [folhaDeExclusao, setFolhaDeExclusao] = useState(false);

  const aplicarPerfil = useCallback((carregado: Profile) => {
    setPerfil(carregado);
    setValores(valoresDoPerfil(carregado));
    setGroupId(carregado.group_id);
    setPlanId(carregado.plan_id);
    setSituacao(carregado.status === 'active' ? 'ativo' : 'trancado');
  }, []);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroDeCarga(null);
    try {
      const carregado = await fetchProfile(userId);
      if (carregado === null) {
        setPerfil(null);
        return;
      }
      aplicarPerfil(carregado);
      // E-mail e mensalidades são complementares: faltar um não impede editar.
      const [emailCarregado, pagamentos] = await Promise.all([
        fetchUserEmail(userId).catch((erro: unknown) => {
          log.warn('Não foi possível ler o e-mail do aluno', erro);
          return null;
        }),
        fetchStudentPayments(userId, 'active').catch((erro: unknown) => {
          log.warn('Não foi possível contar as mensalidades em aberto', erro);
          return null;
        }),
      ]);
      setEmail(emailCarregado);
      setMensalidadesEmAberto(pagamentos === null ? null : contarMensalidadesEmAberto(pagamentos));
    } catch (erro) {
      log.error('Falha ao carregar o aluno', erro);
      setErroDeCarga(describeError(erro));
    } finally {
      setCarregando(false);
    }
  }, [userId, aplicarPerfil]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Pendente de verdade é quem AINDA VAI entrar e preencher os próprios dados.
  // Quem não acessa o sistema nunca vai: os campos ficam com o administrador.
  const semAcesso = perfil?.access_channel === 'none';
  const pendente = (perfil?.is_first_login ?? false) && !semAcesso;

  const mudarCampo = useCallback((campo: keyof ValoresDoFormularioDeAluno, valor: string) => {
    setAviso(null);
    setErros((anteriores) => ({ ...anteriores, [campo]: undefined }));
    setValores((anteriores) => ({ ...anteriores, [campo]: valor }));
  }, []);

  const salvar = useCallback(async () => {
    if (perfil === null) return;
    const encontrados = validarFormularioDeAluno(valores, { pendente });
    setErros(encontrados);
    if (Object.keys(encontrados).length > 0) return;

    const normalizados = normalizarFormularioDeAluno(valores);
    setSalvando(true);
    setAviso(null);
    try {
      const gravou = await updateStudentByAdmin(userId, perfil, {
        name: pendente ? undefined : normalizados.name,
        cpf: pendente ? undefined : normalizados.cpf,
        phone: normalizados.phone,
        dob: normalizados.dob,
        groupId,
        planId,
        active: situacao === 'ativo',
      });
      if (gravou) {
        const atualizado = await fetchProfile(userId);
        if (atualizado !== null) aplicarPerfil(atualizado);
      }
      setAviso({ texto: gravou ? 'Alterações salvas.' : 'Nada foi alterado.', tipo: 'sucesso' });
    } catch (erro) {
      log.error('Falha ao salvar o aluno', erro);
      setAviso({ texto: describeError(erro), tipo: 'erro' });
    } finally {
      setSalvando(false);
    }
  }, [perfil, valores, pendente, userId, groupId, planId, situacao, aplicarPerfil]);

  const abrirFolhaDoEmail = useCallback(() => {
    setNovoEmail(email ?? '');
    setErroDoEmail(null);
    setFolhaDoEmail(true);
  }, [email]);

  const trocarEmail = useCallback(async () => {
    const invalido = validarEmailDoAluno(novoEmail);
    if (invalido !== null) {
      setErroDoEmail(invalido);
      return;
    }
    setTrocandoEmail(true);
    setErroDoEmail(null);
    try {
      await updateUserEmail(userId, novoEmail);
      setEmail(novoEmail.trim().toLowerCase());
      setFolhaDoEmail(false);
      setAviso({ texto: 'E-mail de login alterado.', tipo: 'sucesso' });
    } catch (erro) {
      log.error('Falha ao trocar o e-mail do aluno', erro);
      setErroDoEmail(describeError(erro));
    } finally {
      setTrocandoEmail(false);
    }
  }, [novoEmail, userId]);

  const excluir = useCallback(async () => {
    await deleteUserAccount(userId);
    setFolhaDeExclusao(false);
    Alert.alert('Conta excluída', 'Os dados pessoais foram apagados. Os registros financeiros continuam, sem identificação.');
    navigation.goBack();
  }, [userId, navigation]);

  if (carregando && perfil === null) {
    return (
      <ScreenWrapper edges={['bottom']}>
        <View style={styles.centro}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenWrapper>
    );
  }

  if (erroDeCarga !== null) {
    return (
      <ScreenWrapper edges={['bottom']}>
        <ErrorState message={erroDeCarga} onRetry={() => void carregar()} />
      </ScreenWrapper>
    );
  }

  if (perfil === null || perfil.anonymized_at !== null) {
    return (
      <ScreenWrapper edges={['bottom']}>
        <EmptyState
          icon="person-remove-outline"
          title={perfil === null ? 'Aluno não encontrado' : 'Conta excluída'}
          message={perfil === null ? 'Este cadastro não existe mais.' : 'Os dados pessoais desta conta já foram apagados.'}
        />
      </ScreenWrapper>
    );
  }

  const ehAdmin = perfil.role === 'admin';

  return (
    <ScreenWrapper edges={['bottom']} avoidKeyboard>
      <ScrollView contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {pendente ? (
          <AppText variant="caption" color={colors.textSecondary} style={styles.nota}>
            Este aluno ainda não fez o primeiro acesso: nome e CPF são informados por ele no app.
          </AppText>
        ) : null}

        <Input
          label="Nome"
          value={valores.nome}
          onChangeText={(texto) => mudarCampo('nome', texto)}
          editable={!pendente}
          error={erros.nome}
          autoCapitalize="words"
        />
        <Input
          label="CPF"
          value={valores.cpf}
          onChangeText={(texto) => mudarCampo('cpf', maskCpf(texto))}
          editable={!pendente}
          error={erros.cpf}
          keyboardType="number-pad"
        />
        <Input
          label="Celular (opcional)"
          value={valores.celular}
          onChangeText={(texto) => mudarCampo('celular', maskPhone(texto))}
          error={erros.celular}
          keyboardType="phone-pad"
        />
        <Input
          label="Nascimento (opcional)"
          placeholder="DD/MM/AAAA"
          value={valores.nascimento}
          onChangeText={(texto) => mudarCampo('nascimento', maskDate(texto))}
          error={erros.nascimento}
          keyboardType="number-pad"
        />

        <GroupPicker label="Turma" value={groupId} onChange={setGroupId} />
        <PlanPicker label="Plano" value={planId} onChange={setPlanId} />

        <Text style={styles.rotulo}>Situação</Text>
        <SegmentedControl options={SITUACOES} value={situacao} onChange={setSituacao} />

        <View style={styles.linhaDoEmail}>
          <View style={styles.flex}>
            <Text style={styles.rotulo}>E-mail de login</Text>
            <Text style={styles.valor} numberOfLines={1}>
              {email ?? 'Indisponível'}
            </Text>
          </View>
          <Button title="Alterar" variant="secondary" onPress={abrirFolhaDoEmail} accessibilityHint="Troca o e-mail que o aluno usa para entrar" />
        </View>

        {aviso !== null ? (
          <AppText
            variant="caption"
            color={aviso.tipo === 'sucesso' ? colors.success : colors.error}
            accessibilityLiveRegion="polite"
          >
            {aviso.texto}
          </AppText>
        ) : null}

        <Button title="Salvar alterações" onPress={() => void salvar()} loading={salvando} style={styles.salvar} />

        <View style={styles.zonaDePerigo}>
          <Text style={[styles.rotulo, { color: colors.error }]}>Zona de perigo</Text>
          {ehAdmin ? (
            <AppText variant="caption" color={colors.textSecondary}>
              Contas de administrador não são excluídas. Rebaixe a aluno na gestão antes, se for o caso.
            </AppText>
          ) : (
            <>
              <AppText variant="caption" color={colors.textSecondary}>
                Apaga os dados pessoais a pedido do titular (LGPD). Não tem volta.
              </AppText>
              <Button
                title="Excluir conta"
                variant="danger"
                onPress={() => setFolhaDeExclusao(true)}
                accessibilityHint="Abre a confirmação da exclusão da conta"
              />
            </>
          )}
        </View>
      </ScrollView>

      <BottomSheet visible={folhaDoEmail} onClose={() => (trocandoEmail ? undefined : setFolhaDoEmail(false))}>
        <AppText variant="subtitle" accessibilityRole="header">
          Alterar e-mail de login
        </AppText>
        <AppText variant="caption" color={colors.textSecondary}>
          O aluno passa a entrar com o e-mail novo; a senha continua a mesma.
        </AppText>
        <Input
          label="Novo e-mail"
          value={novoEmail}
          onChangeText={(texto) => {
            setErroDoEmail(null);
            setNovoEmail(texto);
          }}
          autoCapitalize="none"
          keyboardType="email-address"
          error={erroDoEmail ?? undefined}
          editable={!trocandoEmail}
        />
        <Button title="Salvar e-mail" onPress={() => void trocarEmail()} loading={trocandoEmail} />
        <Button title="Cancelar" variant="secondary" onPress={() => setFolhaDoEmail(false)} disabled={trocandoEmail} />
      </BottomSheet>

      <ConfirmarExclusaoSheet
        visible={folhaDeExclusao}
        onClose={() => setFolhaDeExclusao(false)}
        modo="administrador"
        nome={perfil.name}
        mensalidadesEmAberto={mensalidadesEmAberto}
        onConfirmar={excluir}
      />
    </ScreenWrapper>
  );
}

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  fonts: ReturnType<typeof useTheme>['fonts'],
) {
  return StyleSheet.create({
    centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    conteudo: { paddingTop: 16, paddingBottom: 32, gap: 4 },
    nota: { marginBottom: 8 },
    flex: { flex: 1, minWidth: 0 },
    rotulo: { marginTop: 8, marginBottom: 6, fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.textSecondary },
    valor: { fontFamily: fonts.body, fontSize: 15, color: colors.textPrimary },
    linhaDoEmail: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
    salvar: { marginTop: 16 },
    zonaDePerigo: {
      marginTop: 28,
      paddingTop: 16,
      gap: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
  });
}
