// Testes das partes puras da send-push, sem rede nem dependência externa:
//   deno test supabase/functions/send-push/
import {
  buscarRecibos,
  classificarRecibo,
  classificarTicket,
  compararSegredo,
  emLotes,
  enviarLote,
  type LinhaReivindicada,
  montarEnvios,
  type OpcoesDaExpo,
} from './expo.ts';
import { conteudoDaNotificacao, type NotificacaoDaFila, quandoFoiAAula } from './mensagens.ts';

function igual(recebido: unknown, esperado: unknown, contexto = ''): void {
  const a = JSON.stringify(recebido);
  const b = JSON.stringify(esperado);
  if (a !== b) {
    throw new Error(`${contexto}\n  recebido: ${a}\n  esperado: ${b}`);
  }
}

function base(kind: NotificacaoDaFila['kind'], extra: Partial<NotificacaoDaFila> = {}): NotificacaoDaFila {
  return {
    kind,
    data: {},
    payment_id: null,
    class_id: null,
    justification_id: null,
    class_title: null,
    class_date_time: null,
    ...extra,
  };
}

function linha(outbox: string, recipient: string, device: string, kind: NotificacaoDaFila['kind']): LinhaReivindicada {
  return { ...base(kind, { payment_id: `pay-${outbox}` }), outbox_id: outbox, recipient_id: recipient, device_id: device, expo_token: `ExponentPushToken[${device}]` };
}

Deno.test('emLotes divide respeitando o tamanho', () => {
  igual(emLotes([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  igual(emLotes(Array.from({ length: 250 }, (_, i) => i), 100).map((l) => l.length), [100, 100, 50]);
  igual(emLotes([], 100), []);
});

Deno.test('compararSegredo só aceita o segredo exato e nunca vazio', () => {
  igual(compararSegredo('abc123', 'abc123'), true);
  igual(compararSegredo('abc124', 'abc123'), false);
  igual(compararSegredo('abc', 'abc123'), false);
  igual(compararSegredo('', ''), false);
});

Deno.test('classificarTicket separa aceito, aparelho inexistente e credencial', () => {
  igual(classificarTicket({ status: 'ok', id: 'tk-1' }), { ok: true, ticketId: 'tk-1', errorCode: null });
  igual(
    classificarTicket({ status: 'error', message: 'not registered', details: { error: 'DeviceNotRegistered' } }),
    { ok: false, ticketId: null, errorCode: 'DeviceNotRegistered' },
  );
  igual(classificarTicket({ status: 'error', details: { error: 'InvalidCredentials' } }).errorCode, 'InvalidCredentials');
  igual(classificarTicket(undefined), { ok: false, ticketId: null, errorCode: 'SemTicket' });
});

Deno.test('classificarRecibo', () => {
  igual(classificarRecibo({ status: 'ok' }), { ok: true, errorCode: null });
  igual(classificarRecibo({ status: 'error', details: { error: 'MessageRateExceeded' } }), { ok: false, errorCode: 'MessageRateExceeded' });
});

Deno.test('montarEnvios junta comprovantes do mesmo admin por aparelho e mantém o resto separado', () => {
  const envios = montarEnvios([
    linha('o1', 'adm', 'd1', 'comprovante_enviado'),
    linha('o2', 'adm', 'd1', 'comprovante_enviado'),
    linha('o2', 'adm', 'd2', 'comprovante_enviado'),
    linha('o3', 'alu', 'd3', 'comprovante_aprovado'),
    linha('o4', 'alu', 'd3', 'mensalidade_vence_hoje'),
  ]);
  igual(envios.map((e) => [e.deviceId, e.outboxIds, e.mensagem.title]), [
    ['d1', ['o1', 'o2'], '2 comprovantes para analisar'],
    ['d2', ['o2'], 'Novo comprovante para analisar'],
    ['d3', ['o3'], 'Pagamento aprovado'],
    ['d3', ['o4'], 'Sua mensalidade vence hoje'],
  ]);
  igual(envios[0]?.mensagem.data, { tipo: 'comprovante_enviado' }, 'agrupado não leva id de um pagamento só');
  igual(envios[2]?.mensagem.channelId, 'financeiro');
});

Deno.test('mensagens não levam nome nem valor e usam o horário de São Paulo', () => {
  const aula = base('aula_sem_chamada', {
    class_id: 'c1',
    class_title: 'Muay Thai — Turma Noite',
    class_date_time: '2030-03-10T21:00:00+00:00',
  });
  igual(conteudoDaNotificacao(aula).body, 'Muay Thai — Turma Noite, 10/03 às 18:00: ainda sem chamada.');
  igual(conteudoDaNotificacao(aula).channelId, 'frequencia');
  igual(quandoFoiAAula('2030-03-11T02:30:00Z'), '10/03 às 23:30');

  igual(conteudoDaNotificacao(base('mensalidade_vence_em_breve', { data: { dias: 3 } })).title, 'Mensalidade vence em 3 dias');
  igual(conteudoDaNotificacao(base('mensalidade_atrasada', { data: { dias: 1 } })).body, 'Sua mensalidade está atrasada há 1 dia. Regularize pelo app.');
  igual(conteudoDaNotificacao(base('aulas_sem_chamada_resumo', { data: { quantidade: 2 } })).body, '2 aulas de hoje ainda estão sem chamada.');

  const todos: NotificacaoDaFila['kind'][] = [
    'mensalidade_vence_em_breve', 'mensalidade_vence_hoje', 'mensalidade_atrasada', 'comprovante_enviado',
    'comprovante_aprovado', 'comprovante_recusado', 'justificativa_pendente', 'aula_sem_chamada', 'aulas_sem_chamada_resumo',
  ];
  for (const kind of todos) {
    const { title, body } = conteudoDaNotificacao(base(kind, { data: { dias: 2, quantidade: 3 } }));
    if (/R\$|\d{3}\.\d{3}\.\d{3}|@/.test(`${title} ${body}`) || title === '' || body === '') {
      throw new Error(`texto inadequado para ${kind}: ${title} / ${body}`);
    }
  }
});

function expoFalsa(resposta: { status: number; corpo: unknown } | 'rede'): { opcoes: OpcoesDaExpo; chamadas: { url: string; body: string; auth: string | null }[] } {
  const chamadas: { url: string; body: string; auth: string | null }[] = [];
  const falso = ((url: string | URL | Request, init?: RequestInit) => {
    chamadas.push({ url: String(url), body: String(init?.body ?? ''), auth: new Headers(init?.headers).get('Authorization') });
    if (resposta === 'rede') return Promise.reject(new TypeError('network'));
    return Promise.resolve(new Response(JSON.stringify(resposta.corpo), { status: resposta.status }));
  }) as typeof fetch;
  return { opcoes: { baseUrl: 'http://expo.falsa', accessToken: 'tok', fetch: falso }, chamadas };
}

Deno.test('enviarLote devolve os tickets na ordem ou o erro do lote', async () => {
  const ok = expoFalsa({ status: 200, corpo: { data: [{ status: 'ok', id: 't1' }] } });
  const resultado = await enviarLote([{ to: 'x', title: 't', body: 'b', data: {}, channelId: 'financeiro', priority: 'high', ttl: 1 }], ok.opcoes);
  igual(resultado, { tickets: [{ status: 'ok', id: 't1' }] });
  igual(ok.chamadas[0]?.url, 'http://expo.falsa/send');
  igual(ok.chamadas[0]?.auth, 'Bearer tok');

  igual(await enviarLote([], expoFalsa({ status: 429, corpo: {} }).opcoes), { erro: 'HTTP_429' });
  igual(await enviarLote([], expoFalsa('rede').opcoes), { erro: 'REDE' });
});

Deno.test('buscarRecibos pede os ids e devolve o mapa', async () => {
  const falsa = expoFalsa({ status: 200, corpo: { data: { t1: { status: 'error', details: { error: 'DeviceNotRegistered' } } } } });
  const resultado = await buscarRecibos(['t1', 't2'], falsa.opcoes);
  igual(resultado, { recibos: { t1: { status: 'error', details: { error: 'DeviceNotRegistered' } } } });
  igual(JSON.parse(falsa.chamadas[0]?.body ?? '{}'), { ids: ['t1', 't2'] });
});
