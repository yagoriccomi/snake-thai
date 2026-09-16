import * as Sentry from '@sentry/react-native';
import type { ComponentType } from 'react';

import { setLogSink, type LogSink } from '@/lib/logger';
import { obterIdDeInstalacao } from '@/lib/monitoring/installId';
import { isExpectedNetworkError, scrubBreadcrumb, scrubEvent, scrubText } from '@/lib/monitoring/scrub';

/**
 * Monitoramento de erros no aparelho (Sentry). ÚNICO arquivo que importa o SDK.
 *
 * - Desligado sem `EXPO_PUBLIC_SENTRY_DSN` e no Metro em modo debug: nada sai
 *   do aparelho e nenhuma cota é gasta.
 * - Nenhum dado pessoal sai: sem IP, e-mail ou nome; usuário = id aleatório da
 *   instalação + papel; textos e URLs filtrados em `scrub.ts`.
 * - Só `log.error` vira evento; warn/info viram trilha do próximo erro.
 * - DEV e produção separados por `environment` (a variante do app, T1).
 *
 * Nunca derruba o app: toda chamada ao SDK é protegida. Não importa
 * `src/config/env.ts` de propósito — ele lança exceção na importação, e o
 * monitoramento precisa estar de pé justamente para registrar essa falha.
 */

export type AmbienteDeMonitoramento = 'development' | 'production';

export interface ConfiguracaoDeMonitoramento {
  dsn: string | null;
  ambiente: AmbienteDeMonitoramento;
  /** Metro em modo debug: nada é enviado. */
  modoDebug: boolean;
}

/** Lida por acesso ESTÁTICO a `process.env`, a única forma que o Expo embute no bundle. */
function lerConfiguracao(): ConfiguracaoDeMonitoramento {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();
  return {
    dsn: dsn === undefined || dsn === '' ? null : dsn,
    ambiente: process.env.EXPO_PUBLIC_APP_VARIANT === 'development' ? 'development' : 'production',
    modoDebug: __DEV__,
  };
}

/** Ambiente deste build: o diagnóstico de erros só aparece fora de produção. */
export const monitoringEnvironment: AmbienteDeMonitoramento = lerConfiguracao().ambiente;

const MAXIMO_DE_TRILHAS = 50;

let ativo = false;

const sinkDoSentry: LogSink = {
  error: ({ scope, message, context, error }) => reportError({ scope, message, error, context }),
  breadcrumb: ({ level, scope, message, context }) =>
    addMonitoringBreadcrumb({ level: level === 'warn' ? 'warning' : 'info', scope, message, context }),
};

/**
 * Liga o monitoramento. Chamada uma vez, antes de qualquer outro import do app
 * (`src/lib/monitoring/init.ts`).
 *
 * @returns `true` se o SDK foi iniciado.
 */
export function initMonitoring(configuracao: ConfiguracaoDeMonitoramento = lerConfiguracao()): boolean {
  if (ativo) return true;
  if (configuracao.dsn === null || configuracao.modoDebug) return false;
  try {
    Sentry.init({
      dsn: configuracao.dsn,
      environment: configuracao.ambiente,
      sendDefaultPii: false,
      attachScreenshot: false,
      attachViewHierarchy: false,
      maxBreadcrumbs: MAXIMO_DE_TRILHAS,
      // O release (pacote@versão+código) vem do build nativo — ver docs/VERSIONAMENTO.md.
      beforeSend: (evento, dica) => (isExpectedNetworkError(dica.originalException) ? null : scrubEvent(evento)),
      beforeBreadcrumb: (trilha) => scrubBreadcrumb(trilha),
    });
    ativo = true;
    setLogSink(sinkDoSentry);
  } catch {
    ativo = false;
  }
  return ativo;
}

interface RelatoDeErro {
  scope: string;
  message: string;
  error?: unknown;
  context?: Record<string, unknown>;
}

/**
 * Envia um erro. `Error` vai com a stack (simbolizada no painel); objeto de
 * erro (PostgREST) vai como mensagem com o conteúdo filtrado. Falha de rede
 * esperada não é enviada.
 */
export function reportError({ scope, message, error, context = {} }: RelatoDeErro): void {
  if (!ativo || isExpectedNetworkError(error)) return;
  try {
    Sentry.withScope((escopo) => {
      escopo.setTag('scope', scope);
      escopo.setExtras({ ...context, mensagem: scrubText(message) });
      // Agrupa por onde e o quê, não pelo texto variável do erro.
      escopo.setFingerprint([scope, message]);
      if (error instanceof Error) {
        Sentry.captureException(error);
        return;
      }
      if (error !== undefined) {
        escopo.setExtra('errorMessage', typeof context.errorMessage === 'string' ? context.errorMessage : '[objeto]');
      }
      Sentry.captureMessage(`${scope}: ${scrubText(message)}`, 'error');
    });
  } catch {
    // O monitoramento nunca derruba o app.
  }
}

interface Trilha {
  level: 'info' | 'warning';
  scope: string;
  message: string;
  context?: Record<string, unknown>;
}

/** Deixa uma trilha anexada ao próximo erro enviado. */
export function addMonitoringBreadcrumb({ level, scope, message, context }: Trilha): void {
  if (!ativo) return;
  try {
    Sentry.addBreadcrumb({ category: scope, level, message: scrubText(message), data: context });
  } catch {
    // Idem.
  }
}

/** Usuário do monitoramento: id aleatório da instalação + papel. Nunca e-mail ou nome. */
export async function setMonitoringUser(papel: string): Promise<void> {
  if (!ativo) return;
  try {
    const id = await obterIdDeInstalacao();
    Sentry.setUser(id === null ? null : { id });
    Sentry.setTag('role', papel);
  } catch {
    // Idem.
  }
}

/** Ao sair do login. */
export function clearMonitoringUser(): void {
  if (!ativo) return;
  try {
    Sentry.setUser(null);
    Sentry.setTag('role', 'sem_login');
  } catch {
    // Idem.
  }
}

/** Envolve o componente raiz (toques e ciclo de vida) quando o SDK está ligado. */
export function wrapRoot<P extends Record<string, unknown>>(componente: ComponentType<P>): ComponentType<P> {
  if (!ativo) return componente;
  try {
    return Sentry.wrap(componente);
  } catch {
    return componente;
  }
}

/** Diagnóstico fora de produção: provoca um travamento nativo de verdade. */
export function forceNativeCrash(): void {
  if (!ativo || monitoringEnvironment === 'production') return;
  Sentry.nativeCrash();
}

/** Só para testes. */
export function _reiniciarMonitoramento(): void {
  ativo = false;
  setLogSink(null);
}
