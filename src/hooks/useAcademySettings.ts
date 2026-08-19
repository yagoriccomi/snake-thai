import { useCallback, useEffect, useState } from 'react';

import {
  fetchAcademySettings,
  updateAcademySettings,
  type AcademySettingsInput,
  type AcademySettingsRow,
} from '@/services/settings.service';

interface UseAcademySettingsResult {
  settings: AcademySettingsRow | null;
  loading: boolean;
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
  const [settings, setSettings] = useState<AcademySettingsRow | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSettings(await fetchAcademySettings());
    } catch {
      setSettings(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async (input: AcademySettingsInput) => {
    const updated = await updateAcademySettings(input);
    setSettings(updated);
  }, []);

  return { settings, loading, reload: load, save };
}
