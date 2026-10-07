import { createQueryChain } from '@/test-utils/supabaseMock';

const mockRpc = jest.fn();
const mockFrom = jest.fn();
const mockApiDisponivel = jest.fn();
const mockChamarApi = jest.fn();
const mockEnviarArquivo = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]): unknown => mockRpc(...args),
    from: (...args: unknown[]): unknown => mockFrom(...args),
  },
}));

jest.mock('@/lib/api', () => ({
  apiDisponivel: (): unknown => mockApiDisponivel(),
  chamarApi: (...args: unknown[]): unknown => mockChamarApi(...args),
}));

jest.mock('@/lib/cloudinaryUpload', () => ({
  enviarArquivoAssinado: (...args: unknown[]): unknown => mockEnviarArquivo(...args),
}));

import {
  AnexoIndisponivelError,
  decidirJustificativa,
  enviarJustificativa,
  fetchJustificationAttachmentUrl,
  fetchMinhasJustificativas,
  JUSTIFICATION_MESSAGE_MAX,
  JustificativaInvalidaError,
  reenviarJustificativa,
  type NovaJustificativa,
} from '@/services/justifications.service';

const AULA = '5b4c3d2e-1f0a-4b9c-8d7e-6f5a4b3c2d1e';
const JUSTIFICATIVA = '7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const ANEXO = { uri: 'file:///cache/atestado.pdf', name: 'atestado.pdf' };

function daAula(parcial: Partial<NovaJustificativa> = {}): NovaJustificativa {
  return { scope: 'class', classId: AULA, weekStart: null, texto: 'Consulta médica', anexo: null, ...parcial };
}

beforeEach(() => {
  mockRpc.mockReset().mockResolvedValue({ data: JUSTIFICATIVA, error: null });
  mockFrom.mockReset().mockReturnValue(createQueryChain({ data: null, error: null }));
  mockApiDisponivel.mockReset().mockReturnValue(true);
  mockChamarApi.mockReset();
  mockEnviarArquivo.mockReset();
});

describe('enviarJustificativa — validação antes da rede', () => {
  it('deveRecusarTextoAcimaDoLimiteSemChamarOBanco', async () => {
    await expect(enviarJustificativa(daAula({ texto: 'x'.repeat(JUSTIFICATION_MESSAGE_MAX + 1) }))).rejects.toBeInstanceOf(
      JustificativaInvalidaError,
    );
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('deveRecusarTextoVazioMesmoComAnexo', async () => {
    await expect(enviarJustificativa(daAula({ texto: '   ', anexo: ANEXO }))).rejects.toBeInstanceOf(
      JustificativaInvalidaError,
    );
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockEnviarArquivo).not.toHaveBeenCalled();
  });

  it('deveRecusarAnexoNumBuildSemBackendEmVezDeFalharEmSilencio', async () => {
    mockApiDisponivel.mockReturnValue(false);
    await expect(enviarJustificativa(daAula({ anexo: ANEXO }))).rejects.toBeInstanceOf(AnexoIndisponivelError);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe('enviarJustificativa — envio', () => {
  it('deveChamarARpcComOTextoAparado', async () => {
    await expect(enviarJustificativa(daAula({ texto: '  Consulta médica  ' }))).resolves.toEqual({
      id: JUSTIFICATIVA,
      anexoFalhou: false,
    });
    expect(mockRpc).toHaveBeenCalledWith('enviar_justificativa', {
      p_scope: 'class',
      p_class_id: AULA,
      p_week_start: null,
      p_texto: 'Consulta médica',
    });
    expect(mockEnviarArquivo).not.toHaveBeenCalled();
  });

  it('deveEnviarASemanaPelaSegundaFeira', async () => {
    await enviarJustificativa({ scope: 'week', classId: null, weekStart: '2026-09-28', texto: 'Viagem', anexo: null });
    expect(mockRpc).toHaveBeenCalledWith('enviar_justificativa', {
      p_scope: 'week',
      p_class_id: null,
      p_week_start: '2026-09-28',
      p_texto: 'Viagem',
    });
  });

  it('deveMostrarAFraseDoBancoQuandoARpcRecusa', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: '23514', message: 'Você já usou as justificativas deste mês.' },
    });
    await expect(enviarJustificativa(daAula())).rejects.toMatchObject({
      message: 'Você já usou as justificativas deste mês.',
    });
  });

  it('deveSubirOAnexoPeloIdELigaloPelaRpcDepoisDeCriarAJustificativa', async () => {
    mockEnviarArquivo.mockResolvedValue(`justificativas/x/${JUSTIFICATIVA}`);

    await expect(enviarJustificativa(daAula({ anexo: ANEXO }))).resolves.toEqual({
      id: JUSTIFICATIVA,
      anexoFalhou: false,
    });

    expect(mockEnviarArquivo).toHaveBeenCalledWith('/v1/justifications/sign-upload', { justificationId: JUSTIFICATIVA }, ANEXO);
    expect(mockRpc).toHaveBeenNthCalledWith(2, 'anexar_a_justificativa', { p_id: JUSTIFICATIVA });
    // Só depois do texto aceito: a justificativa vale mesmo que o arquivo não chegue (§ 9.1).
    expect(mockRpc.mock.invocationCallOrder[0]).toBeLessThan(mockEnviarArquivo.mock.invocationCallOrder[0] ?? 0);
    expect(mockEnviarArquivo.mock.invocationCallOrder[0]).toBeLessThan(mockRpc.mock.invocationCallOrder[1] ?? 0);
    // C11: o caminho do anexo é do banco; o app não grava `proof_*` direto.
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('deveAceitarAnexoNaJustificativaDaSemana', async () => {
    await expect(
      enviarJustificativa({ scope: 'week', classId: null, weekStart: '2026-09-28', texto: 'Viagem', anexo: ANEXO }),
    ).resolves.toEqual({ id: JUSTIFICATIVA, anexoFalhou: false });
    expect(mockEnviarArquivo).toHaveBeenCalledWith('/v1/justifications/sign-upload', { justificationId: JUSTIFICATIVA }, ANEXO);
  });

  it('deveAvisarQueOAnexoFalhouSemPerderOTexto', async () => {
    mockEnviarArquivo.mockRejectedValue(new Error('Cloudinary recusou o upload (HTTP 400)'));
    await expect(enviarJustificativa(daAula({ anexo: ANEXO }))).resolves.toEqual({
      id: JUSTIFICATIVA,
      anexoFalhou: true,
    });
    expect(mockRpc).not.toHaveBeenCalledWith('anexar_a_justificativa', expect.anything());
  });

  it('deveAvisarQueOAnexoFalhouQuandoORegistroDoAnexoERecusado', async () => {
    mockRpc
      .mockResolvedValueOnce({ data: JUSTIFICATIVA, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'Operação negada.' } });
    await expect(enviarJustificativa(daAula({ anexo: ANEXO }))).resolves.toEqual({
      id: JUSTIFICATIVA,
      anexoFalhou: true,
    });
  });
});

describe('reenviar e decidir', () => {
  it('deveReenviarComOTextoAparado', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await expect(reenviarJustificativa(JUSTIFICATIVA, ' Segue o atestado ')).resolves.toEqual({ anexoFalhou: false });
    expect(mockRpc).toHaveBeenCalledWith('reenviar_justificativa', { p_id: JUSTIFICATIVA, p_texto: 'Segue o atestado' });
    expect(mockEnviarArquivo).not.toHaveBeenCalled();
  });

  it('deveRecusarReenvioSemTexto', async () => {
    await expect(reenviarJustificativa(JUSTIFICATIVA, '')).rejects.toBeInstanceOf(JustificativaInvalidaError);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('deveAnexarNoReenvioDepoisDoTextoAceito', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await expect(reenviarJustificativa(JUSTIFICATIVA, 'Segue o atestado', ANEXO)).resolves.toEqual({ anexoFalhou: false });
    // O `-2` da tentativa 2 é o banco quem deriva; o app manda só o id.
    expect(mockRpc).toHaveBeenNthCalledWith(1, 'reenviar_justificativa', { p_id: JUSTIFICATIVA, p_texto: 'Segue o atestado' });
    expect(mockEnviarArquivo).toHaveBeenCalledWith('/v1/justifications/sign-upload', { justificationId: JUSTIFICATIVA }, ANEXO);
    expect(mockRpc).toHaveBeenNthCalledWith(2, 'anexar_a_justificativa', { p_id: JUSTIFICATIVA });
  });

  it('deveRecusarAnexoNoReenvioNumBuildSemBackend', async () => {
    mockApiDisponivel.mockReturnValue(false);
    await expect(reenviarJustificativa(JUSTIFICATIVA, 'Segue', ANEXO)).rejects.toBeInstanceOf(AnexoIndisponivelError);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('naoDeveAnexarQuandoOReenvioERecusado', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: '22023', message: 'O prazo de reenvio acabou.' } });
    await expect(reenviarJustificativa(JUSTIFICATIVA, 'Segue', ANEXO)).rejects.toMatchObject({
      message: 'O prazo de reenvio acabou.',
    });
    expect(mockEnviarArquivo).not.toHaveBeenCalled();
  });

  it('deveDecidirComANota', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await decidirJustificativa(JUSTIFICATIVA, 'rejected', ' Sem atestado ');
    expect(mockRpc).toHaveBeenCalledWith('decidir_justificativa', {
      p_id: JUSTIFICATIVA,
      p_decisao: 'rejected',
      p_nota: 'Sem atestado',
    });
  });
});

describe('fetchMinhasJustificativas', () => {
  it('deveTraduzirAsLinhas', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          id: JUSTIFICATIVA,
          scope: 'class',
          class_id: AULA,
          class_title: 'Muay Thai',
          class_date_time: '2026-09-28T22:00:00Z',
          week_start: '2026-09-28',
          message: 'Consulta',
          has_attachment: false,
          status: 'rejected',
          attempt: 1,
          approved_by_name: null,
          can_resend: true,
          resend_until: '2026-10-05T22:00:00Z',
          created_at: '2026-09-28T23:00:00Z',
        },
      ],
      error: null,
    });
    const [linha] = await fetchMinhasJustificativas();
    expect(linha).toMatchObject({ id: JUSTIFICATIVA, status: 'rejected', canResend: true, classTitle: 'Muay Thai' });
  });
});

describe('fetchJustificationAttachmentUrl', () => {
  it('devePedirAUrlAoBackendPeloIdDaJustificativa', async () => {
    mockChamarApi.mockResolvedValue({ url: 'https://assinada', paginas: 1, pagina: 1 });

    await expect(fetchJustificationAttachmentUrl(JUSTIFICATIVA)).resolves.toEqual({
      url: 'https://assinada',
      paginas: 1,
      pagina: 1,
    });
    expect(mockChamarApi).toHaveBeenCalledWith('/v1/justifications/view-url', {
      justificationId: JUSTIFICATIVA,
      pagina: 1,
    });
  });
});
