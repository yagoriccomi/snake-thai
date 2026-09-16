import React, { useMemo } from 'react';
import {
  createNativeStackNavigator,
  type NativeStackNavigationOptions,
} from '@react-navigation/native-stack';

import type { PainelStackParamList } from '@/navigation/types';
import { PainelScreen } from '@/screens/painel/PainelScreen';
import { useTheme } from '@/theme/ThemeProvider';

const Stack = createNativeStackNavigator<PainelStackParamList>();

/** Stack da aba "Painel" (só admin): os números da academia. */
export function PainelStackNavigator(): React.JSX.Element {
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
      <Stack.Screen name="PainelHome" component={PainelScreen} options={HOME_OPTIONS} />
    </Stack.Navigator>
  );
}

const HOME_OPTIONS: NativeStackNavigationOptions = { title: 'Painel' };
