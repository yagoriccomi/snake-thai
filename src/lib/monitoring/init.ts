import { initMonitoring } from '@/lib/monitoring';

// Importado na PRIMEIRA linha de index.ts: o monitoramento precisa estar ligado
// antes do resto do app carregar, para registrar também as falhas de boot
// (ex.: variável de ambiente ausente em src/config/env.ts).
initMonitoring();
