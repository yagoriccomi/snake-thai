import type { ReferenciaDeComprovante } from '@/services/proofs.service';

import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type {
  CompositeScreenProps,
  NavigatorScreenParams,
} from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { ClassType } from '@/services/classes.service';

/** Dados de uma aula trafegados entre a lista, o detalhe e a edição. */
export interface ClassNavParams {
  classId: string;
  title: string;
  type: ClassType;
  dateTimeIso: string;
  groupId: string | null;
}

/** Stack interna da aba "Dados" (perfil + cadastro/gestão de alunos pelo admin). */
export type DadosStackParamList = {
  Perfil: undefined;
  CadastrarAluno: undefined;
  /** Cadastro de professor/admin (admin) — cadastro completo, sem onboarding. [#55] */
  CadastrarEquipe: undefined;
  AlterarSenha: undefined;
  Planos: undefined;
  Configuracoes: undefined;
  GerenciarAlunos: undefined;
};

/** Stack interna da aba "Aulas" (lista + detalhe + criação/edição + frequência). */
export type AulasStackParamList = {
  AulasHome: undefined;
  /** Sem params: nova aula. Com params: edição da aula existente. */
  CriarAula: ClassNavParams | undefined;
  /** Detalhe da aula (admin): abre edição ou chamada de presença. */
  DetalheAula: ClassNavParams & { groupLabel: string };
  Frequencia: {
    classId: string;
    title: string;
    groupId: string | null;
    /**
     * Admin: sempre `true`. Professor: só `true` para as aulas onde ele é um
     * dos professores (a RLS barra a escrita mesmo que a tela minta, mas o
     * botão de ação nem aparece fora daí — sem convite a um 403). [#55]
     */
    canManage: boolean;
  };
};

/** Stack interna da aba "Financeiro" (lista + pagamento + validação). */
export type FinanceiroStackParamList = {
  FinanceiroHome: undefined;
  /** Plano, benefício e mensalidade do próprio aluno — só leitura. [#55] */
  MeuPlano: undefined;
  Pagamento: { paymentId: string; dueDate: string };
  Comprovante: {
    paymentId: string;
    /**
     * Referencia completa do arquivo — provedor + identificador. Antes era so
     * um `proofPath`, o que forcava a tela a adivinhar onde o arquivo estava.
     * Com dois provedores em convivencia, adivinhar produz link quebrado.
     */
    comprovante: ReferenciaDeComprovante;
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
