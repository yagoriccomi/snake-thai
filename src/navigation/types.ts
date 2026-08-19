import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type {
  CompositeScreenProps,
  NavigatorScreenParams,
} from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

/** Stack interna da aba "Dados" (perfil + cadastro/gestão de alunos pelo admin). */
export type DadosStackParamList = {
  Perfil: undefined;
  CadastrarAluno: undefined;
  AlterarSenha: undefined;
  GerenciarAlunos: undefined;
};

/** Stack interna da aba "Aulas" (lista + criação + frequência). */
export type AulasStackParamList = {
  AulasHome: undefined;
  CriarAula: undefined;
  Frequencia: { classId: string; title: string; groupId: string | null };
};

/** Stack interna da aba "Financeiro" (lista + pagamento + validação). */
export type FinanceiroStackParamList = {
  FinanceiroHome: undefined;
  Pagamento: { paymentId: string; dueDate: string };
  Comprovante: {
    paymentId: string;
    proofPath: string | null;
    studentName: string;
  };
};

/** Abas do painel principal (usuário autenticado e onboarded). */
export type MainTabParamList = {
  Aulas: NavigatorScreenParams<AulasStackParamList>;
  Financeiro: NavigatorScreenParams<FinanceiroStackParamList>;
  Dados: NavigatorScreenParams<DadosStackParamList>;
};

/**
 * Stack raiz. As rotas são exibidas condicionalmente conforme o estado de
 * autenticação (sessão, onboarding, lock de admin) — ver `RootNavigator`.
 */
export type RootStackParamList = {
  Loading: undefined;
  Login: undefined;
  Onboarding: undefined;
  BiometricLock: undefined;
  BiometricSetup: undefined;
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

/** Props tipadas para telas da stack de "Dados". */
export type DadosStackScreenProps<T extends keyof DadosStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<DadosStackParamList, T>,
    MainTabScreenProps<keyof MainTabParamList>
  >;

/** Props tipadas para telas da stack de "Aulas". */
export type AulasStackScreenProps<T extends keyof AulasStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<AulasStackParamList, T>,
    MainTabScreenProps<keyof MainTabParamList>
  >;

/** Props tipadas para telas da stack de "Financeiro". */
export type FinanceiroStackScreenProps<T extends keyof FinanceiroStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<FinanceiroStackParamList, T>,
    MainTabScreenProps<keyof MainTabParamList>
  >;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
