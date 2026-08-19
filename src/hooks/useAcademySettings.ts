import { useCallback, useEffect, useState } from 'react';

import { createLogger } from '@/lib/logger';
import { useTheme } from '@/theme/ThemeProvider';

import {
  fetchAcademySettings,
  updateAcademySettings,
  type AcademySettingsInput,
  type AcademySettingsRow,
} from '@/services/settings.service';

const log = createLogger('useAcademySettings');

interface UseAcademySettingsResult {
  settings: AcademySettingsRow | null;
  loading: boolean;
  /** Mensagem amigável quando a carga falhou; `null` quando está tudo bem. */
  error: string | null;
  reload: () => Promise<void>;
  save: (input: AcademySettingsInput) => Promise<void>;
}

/**
 * Carrega a configuração da academia e expõe a gravação.
 *
 * Falha de leitura devolve `null` em vez de propagar: a configuração é
 * conveniência de personalização, não pode derrubar a tela de quem só quer ver
 * a agenda. Quem consome deve ter um padrão para o caso nulo.
 */
export function useAcademySettings(): UseAcademySettingsResult {
  const { applyBrandColor } = useTheme();
  const [settings, setSettings] = useState<AcademySettingsRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await fetchAcademySettings();
      setSettings(loaded);
      // A cor da marca vale para o app inteiro, não só para esta tela.
      applyBrandColor(loaded?.primary_color ?? null);
    } catch (loadError) {
      // Lista vazia mentiria: o usuário concluiria que não há dados, quando na
      // verdade a carga falhou. Sinaliza o erro e deixa a tela oferecer retry.
      log.error('Falha ao carregar dados', loadError);
      setError('Não foi possível carregar. Verifique sua conexão.');
      setSettings(null);
    } finally {
      setLoading(false);
    }
  }, [applyBrandColor]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    async (input: AcademySettingsInput) => {
      const updated = await updateAcademySettings(input);
      setSettings(updated);
      // Reflete a nova cor imediatamente, sem exigir reinício do app.
      applyBrandColor(updated.primary_color);
    },
    [applyBrandColor],
  );

  return { settings, loading, error, reload: load, save };
}
