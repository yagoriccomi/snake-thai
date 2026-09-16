import { createNavigationContainerRef } from '@react-navigation/native';

import type { RootStackParamList } from '@/navigation/types';

/**
 * Referência da navegação raiz, para quem precisa navegar de FORA de uma tela
 * — tocar numa notificação push, por exemplo. Telas continuam usando a prop
 * `navigation`.
 */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
