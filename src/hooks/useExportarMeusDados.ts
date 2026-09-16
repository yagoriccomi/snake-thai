import { useCallback, useState } from 'react';
import { Share } from 'react-native';

import { createLogger } from '@/lib/logger';
import { exportMyData } from '@/services/profile.service';
import { describeError } from '@/utils/errors';

const log = createLogger('useExportarMeusDados');

interface UseExportarMeusDadosResult {
  exportar: () => Promise<void>;
  exportando: boolean;
  erro: string | null;
}

/**
 * Portabilidade (LGPD art. 18, V): busca os dados do titular e abre o
 * compartilhamento do sistema com o JSON — a pessoa escolhe para onde mandar
 * (e-mail, WhatsApp, arquivos). Nada é gravado no aparelho pelo app.
 */
export function useExportarMeusDados(): UseExportarMeusDadosResult {
  const [exportando, setExportando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const exportar = useCallback(async () => {
    setExportando(true);
    setErro(null);
    try {
      const dados = await exportMyData();
      await Share.share({ title: 'Meus dados — Snake Thai', message: JSON.stringify(dados, null, 2) });
    } catch (falha) {
      log.error('Falha ao exportar os dados do titular', falha);
      setErro(describeError(falha));
    } finally {
      setExportando(false);
    }
  }, []);

  return { exportar, exportando, erro };
}
