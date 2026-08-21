import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type {
  CompositeScreenProps,
  NavigatorScreenParams,
} from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

/** Abas do painel principal (usuário autenticado). */
export type MainTabParamList = {
  Aulas: undefined;
  Financeiro: undefined;
  Dados: undefined;
};

/** Stack raiz: fluxo de autenticação + painel principal. */
export type RootStackParamList = {
  Login: undefined;
  Main: NavigatorScreenParams<MainTabParamList>;
};

/** Props tipadas para telas da stack raiz. */
export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

/** Props tipadas para telas das abas (compostas com a stack raiz). */
export type MainTabScreenProps<T extends keyof MainTabParamList> =
  CompositeScreenProps<
    BottomTabScreenProps<MainTabParamList, T>,
    RootStackScreenProps<keyof RootStackParamList>
  >;

/**
 * Registra os tipos de rota globalmente, dando autocomplete e checagem
 * estrita ao `useNavigation()` em qualquer ponto do app.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
