import React from 'react';

import { ErrorFallbackScreen } from '@/components/ErrorFallbackScreen';
import { createLogger } from '@/lib/logger';

const log = createLogger('AppErrorBoundary');

interface AppErrorBoundaryProps {
  children: React.ReactNode;
}

interface AppErrorBoundaryState {
  temErro: boolean;
}

/**
 * Última rede contra erro de renderização: sem ela, um erro em qualquer tela
 * fecha o app em release sem deixar rastro.
 *
 * O registro passa pelo logger, que entrega o erro original ao monitoramento
 * (src/lib/monitoring) — um caminho só para todo erro do app. [#93]
 */
export class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { temErro: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { temErro: true };
  }

  componentDidCatch(erro: unknown): void {
    log.error('Erro de renderização derrubou a tela', erro);
  }

  private tentarDeNovo = (): void => {
    this.setState({ temErro: false });
  };

  render(): React.ReactNode {
    if (this.state.temErro) {
      return <ErrorFallbackScreen onTentarDeNovo={this.tentarDeNovo} />;
    }
    return this.props.children;
  }
}
