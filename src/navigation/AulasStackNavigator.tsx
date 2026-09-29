import React, { useMemo } from 'react';
import {
  createNativeStackNavigator,
  type NativeStackNavigationOptions,
} from '@react-navigation/native-stack';

import type { AulasStackParamList } from '@/navigation/types';
import { AulasDaSemanaScreen } from '@/screens/aulas/AulasDaSemanaScreen';
import { AulasHomeScreen } from '@/screens/aulas/AulasHomeScreen';
import { ChamadasPendentesScreen } from '@/screens/aulas/ChamadasPendentesScreen';
import { CriarAulaScreen } from '@/screens/aulas/CriarAulaScreen';
import { DetalheAulaScreen } from '@/screens/aulas/DetalheAulaScreen';
import { FrequenciaScreen } from '@/screens/aulas/FrequenciaScreen';
import { HistoricoFrequenciaScreen } from '@/screens/aulas/HistoricoFrequenciaScreen';
import { JustificativasParaRevisarScreen } from '@/screens/aulas/JustificativasParaRevisarScreen';
import { MinhasJustificativasScreen } from '@/screens/aulas/MinhasJustificativasScreen';
import { useTheme } from '@/theme/ThemeProvider';

const Stack = createNativeStackNavigator<AulasStackParamList>();

/** Stack da aba "Aulas": lista, criação, chamada e frequência. */
export function AulasStackNavigator(): React.JSX.Element {
  const { colors, fonts } = useTheme();

  const screenOptions = useMemo<NativeStackNavigationOptions>(
    () => ({
      headerStyle: { backgroundColor: colors.background },
      headerTitleStyle: { fontFamily: fonts.heading, color: colors.textPrimary },
      headerTintColor: colors.primary,
      headerShadowVisible: false,
      contentStyle: { backgroundColor: colors.background },
    }),
    [colors, fonts],
  );

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="AulasHome" component={AulasHomeScreen} options={HOME_OPTIONS} />
      <Stack.Screen name="DetalheAula" component={DetalheAulaScreen} options={DETALHE_OPTIONS} />
      <Stack.Screen
        name="CriarAula"
        component={CriarAulaScreen}
        // Título muda conforme criar (sem params) ou editar (com a aula nos params).
        options={({ route }) => ({
          title: route.params?.classId !== undefined ? 'Editar aula' : 'Criar Aula',
        })}
      />
      <Stack.Screen
        name="Frequencia"
        component={FrequenciaScreen}
        options={FREQUENCIA_OPTIONS}
      />
      <Stack.Screen name="AulasDaSemana" component={AulasDaSemanaScreen} options={AULAS_DA_SEMANA_OPTIONS} />
      <Stack.Screen name="ChamadasPendentes" component={ChamadasPendentesScreen} options={PENDENTES_OPTIONS} />
      <Stack.Screen
        name="HistoricoFrequencia"
        component={HistoricoFrequenciaScreen}
        options={HISTORICO_OPTIONS}
      />
      <Stack.Screen name="MinhasJustificativas" component={MinhasJustificativasScreen} options={MINHAS_JUSTIFICATIVAS_OPTIONS} />
      <Stack.Screen
        name="JustificativasParaRevisar"
        component={JustificativasParaRevisarScreen}
        options={PARA_REVISAR_OPTIONS}
      />
    </Stack.Navigator>
  );
}

const HOME_OPTIONS: NativeStackNavigationOptions = { title: 'Aulas' };
const DETALHE_OPTIONS: NativeStackNavigationOptions = { title: 'Aula' };
const FREQUENCIA_OPTIONS: NativeStackNavigationOptions = { title: 'Chamada' };
const PENDENTES_OPTIONS: NativeStackNavigationOptions = { title: 'Chamadas pendentes' };
const HISTORICO_OPTIONS: NativeStackNavigationOptions = { title: 'Frequência' };
const AULAS_DA_SEMANA_OPTIONS: NativeStackNavigationOptions = { title: 'Aulas da semana' };
const MINHAS_JUSTIFICATIVAS_OPTIONS: NativeStackNavigationOptions = { title: 'Minhas justificativas' };
const PARA_REVISAR_OPTIONS: NativeStackNavigationOptions = { title: 'Justificativas para revisar' };
