// ============================================================================
// Edge Function: send-push
// ----------------------------------------------------------------------------
// Entrega a fila de notificações (notification_outbox) pelo serviço de push da
// Expo. Quem chama é o próprio banco: o pg_cron roda disparar_envio_de_push()
// a cada minuto, que só faz o POST quando há fila ou recibo a conferir.
//
// Autorização: `Authorization: Bearer <PUSH_DISPATCH_SECRET>` (segredo próprio,
// sem JWT de usuário — verify_jwt = false no config.toml). Nada de conta de
// pessoa passa por aqui.
//
// Segredos (só os nomes; valores em `supabase secrets set`):
//   PUSH_DISPATCH_SECRET  igual ao push_dispatch_secret do Vault
//   PUSH_APP_VARIANT      production | development (quais aparelhos atender)
//   EXPO_ACCESS_TOKEN     opcional ("Enhanced Push Security" da Expo)
//   EXPO_PUSH_API_URL     opcional, só para teste local com servidor falso
//
// Duas fases por chamada:
//   1. recibos: tickets com mais de 15 min; DeviceNotRegistered apaga o aparelho;
//   2. envio: reivindica até 200 notificações, envia em lotes de 100 e devolve
//      o resultado ao banco (enviada, nova tentativa, falha, sem aparelho).
//
// Logs só com contagens e códigos de erro: nunca token, nome ou texto.
//
// Deploy (só com aprovação, ver docs/NOTIFICACOES.md):
//   npx supabase functions deploy send-push --no-verify-jwt --project-ref <ref>
// ============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import {
  buscarRecibos,
  classificarRecibo,
  classificarTicket,
  compararSegredo,
  emLotes,
  enviarLote,
  ERROS_DE_CONFIGURACAO,
  EXPO_API_PADRAO,
  type LinhaReivindicada,
  MENSAGENS_POR_ENVIO,
  montarEnvios,
  type OpcoesDaExpo,
  RECIBOS_POR_CONSULTA,
} from './expo.ts';

const NOTIFICACOES_POR_CHAMADA = 200;
const VARIANTES = new Set(['production', 'development']);

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function log(nivel: 'info' | 'warn' | 'error', evento: string, detalhes: Record<string, unknown> = {}): void {
  const linha = JSON.stringify({ nivel, funcao: 'send-push', evento, ...detalhes });
  if (nivel === 'error') console.error(linha);
  else if (nivel === 'warn') console.warn(linha);
  else console.log(linha);
}

interface EntregaParaOBanco {
  outbox_id: string;
  device_id: string;
  ticket_id: string | null;
  ok: boolean;
  error_code: string | null;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return json({ error: 'Método não permitido' }, 405);
  }

  const segredo = Deno.env.get('PUSH_DISPATCH_SECRET') ?? '';
  const variante = Deno.env.get('PUSH_APP_VARIANT') ?? '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (segredo === '' || !VARIANTES.has(variante) || supabaseUrl === '' || serviceRoleKey === '') {
    log('error', 'configuracao_ausente');
    return json({ error: 'Configuração do servidor ausente' }, 500);
  }

  const recebido = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!compararSegredo(recebido, segredo)) {
    return json({ error: 'Não autorizado' }, 401);
  }

  const banco = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const expo: OpcoesDaExpo = {
    baseUrl: (Deno.env.get('EXPO_PUSH_API_URL') ?? EXPO_API_PADRAO).replace(/\/$/, ''),
    accessToken: Deno.env.get('EXPO_ACCESS_TOKEN') ?? null,
    fetch,
  };

  // ---- 1. Recibos ------------------------------------------------------------
  let recibosConferidos = 0;
  const { data: pendencias, error: erroPendencias } = await banco.rpc('pendencias_de_recibo_push', {
    p_limite: RECIBOS_POR_CONSULTA,
  });
  if (erroPendencias !== null) {
    log('error', 'recibos_consulta_falhou', { codigo: erroPendencias.code });
  } else {
    const linhas = (pendencias ?? []) as { delivery_id: string; ticket_id: string }[];
    for (const lote of emLotes(linhas, RECIBOS_POR_CONSULTA)) {
      const resultado = await buscarRecibos([...new Set(lote.map((l) => l.ticket_id))], expo);
      if ('erro' in resultado) {
        log('warn', 'recibos_expo_falhou', { erro: resultado.erro });
        continue;
      }
      const recibos = lote.flatMap((linha) => {
        const recibo = resultado.recibos[linha.ticket_id];
        if (recibo === undefined) return [];
        const { ok, errorCode } = classificarRecibo(recibo);
        if (errorCode !== null && ERROS_DE_CONFIGURACAO.has(errorCode)) {
          log('error', 'credencial_push_invalida', { erro: errorCode });
        }
        return [{ delivery_id: linha.delivery_id, ok, error_code: errorCode }];
      });
      if (recibos.length > 0) {
        const { error } = await banco.rpc('registrar_recibos_de_push', { p_recibos: recibos });
        if (error !== null) log('error', 'recibos_gravacao_falhou', { codigo: error.code });
        else recibosConferidos += recibos.length;
      }
    }
  }

  // ---- 2. Envio --------------------------------------------------------------
  const { data: reivindicadas, error: erroReivindicar } = await banco.rpc('reivindicar_notificacoes', {
    p_limite: NOTIFICACOES_POR_CHAMADA,
    p_variante: variante,
  });
  if (erroReivindicar !== null) {
    log('error', 'reivindicar_falhou', { codigo: erroReivindicar.code });
    return json({ error: 'Falha ao ler a fila' }, 500);
  }

  const envios = montarEnvios((reivindicadas ?? []) as LinhaReivindicada[]);
  const entregas: EntregaParaOBanco[] = [];
  let aceitas = 0;
  let recusadas = 0;

  for (const lote of emLotes(envios, MENSAGENS_POR_ENVIO)) {
    const resultado = await enviarLote(lote.map((envio) => envio.mensagem), expo);
    lote.forEach((envio, indice) => {
      const ticket = 'erro' in resultado
        ? { ok: false, ticketId: null, errorCode: resultado.erro }
        : classificarTicket(resultado.tickets[indice]);
      if (ticket.ok) aceitas += 1;
      else recusadas += 1;
      if (ticket.errorCode !== null && ERROS_DE_CONFIGURACAO.has(ticket.errorCode)) {
        log('error', 'credencial_push_invalida', { erro: ticket.errorCode });
      }
      for (const outboxId of envio.outboxIds) {
        entregas.push({
          outbox_id: outboxId,
          device_id: envio.deviceId,
          ticket_id: ticket.ticketId,
          ok: ticket.ok,
          error_code: ticket.errorCode,
        });
      }
    });
    if ('erro' in resultado) {
      log('warn', 'envio_expo_falhou', { erro: resultado.erro, mensagens: lote.length });
    }
  }

  if (entregas.length > 0) {
    const { error } = await banco.rpc('registrar_envio_de_push', { p_entregas: entregas });
    if (error !== null) {
      // As linhas ficam em 'sending' e voltam à fila em 10 min: pode duplicar
      // um aviso, mas não perde nenhum.
      log('error', 'resultado_gravacao_falhou', { codigo: error.code });
      return json({ error: 'Falha ao gravar o resultado' }, 500);
    }
  }

  const resumo = {
    recibos: recibosConferidos,
    notificacoes: new Set(entregas.map((e) => e.outbox_id)).size,
    mensagens: envios.length,
    aceitas,
    recusadas,
  };
  log('info', 'rodada_concluida', resumo);
  return json(resumo, 200);
});
