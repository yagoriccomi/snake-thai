import { createQueryChain, type QueryChainMock } from '@/test-utils/supabaseMock';

const mockFrom = jest.fn();
const mockApiDisponivel = jest.fn();
const mockChamarApi = jest.fn();
const mockEnviarArquivo = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: { from: (...args: unknown[]): unknown => mockFrom(...args) },
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
  fetchJustificationAttachmentUrl,
  JUSTIFICATION_MESSAGE_MAX,
  JustificativaInvalidaError,
  reviewJustification,
  submitJustification,
} from '@/services/justifications.service';

const ALUNO = '219ce3c9-5ad7-4319-9cde-7dbe07e1a573';
const AULA = '5b4c3d2e-1f0a-4b9c-8d7e-6f5a4b3c2d1e';
const JUSTIFICATIVA = '7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const ANEXO = { uri: 'file:///cache/atestado.pdf', name: 'atestado.pdf' };

function mockQuery(): QueryChainMock {
  const chain = createQueryChain({ data: null, error: null });
  mockFrom.mockReturnValue(chain);
  return chain;
}

beforeEach(() => {
  mockFrom.mockReset();
  mockApiDisponivel.mockReset().mockReturnValue(true);
  mockChamarApi.mockReset();
  mockEnviarArquivo.mockReset();
});

describe('submitJustification — validação antes da rede', () => {
  it('deveRecusarMensagemAcimaDoLimiteSemTocarNoBancoNemNoProvedor', async () => {
    await expect(
      submitJustification(ALUNO, {
        classId: AULA,
        message: 'x'.repeat(JUSTIFICATION_MESSAGE_MAX + 1),
        attachment: null,
      }),
    ).rejects.toBeInstanceOf(JustificativaInvalidaError);

    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockEnviarArquivo).not.toHaveBeenCalled();
  });

  it('deveAceitarExatamenteOLimite', async () => {
    mockQuery();
    await expect(
      submitJustification(ALUNO, {
        classId: AULA,
        message: 'x'.repeat(JUSTIFICATION_MESSAGE_MAX),
        attachment: null,
      }),
    ).resolves.toBeUndefined();
  });

  it('deveRecusarJustificativaSoComEspacosESemAnexo', async () => {
    await expect(
      submitJustification(ALUNO, { classId: AULA, message: '   ', attachment: null }),
    ).rejects.toBeInstanceOf(JustificativaInvalidaError);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe('submitJustification — gravação', () => {
  it('deveGravarSoAMensagemAparadaQuandoNaoHaAnexo', async () => {
    const chain = mockQuery();

    await submitJustification(ALUNO, { classId: AULA, message: '  Consulta médica  ', attachment: null });

    expect(chain.upsert).toHaveBeenCalledWith(
      {
        class_id: AULA,
        user_id: ALUNO,
        message: 'Consulta médica',
        proof_provider: null,
        proof_public_id: null,
      },
      { onConflict: 'class_id,user_id' },
    );
    expect(mockEnviarArquivo).not.toHaveBeenCalled();
  });

  it('deveSubirOAnexoAntesDeGravarALinha', async () => {
    const chain = mockQuery();
    mockEnviarArquivo.mockResolvedValue(`justificativas/${ALUNO}/${AULA}`);

    await submitJustification(ALUNO, { classId: AULA, message: null, attachment: ANEXO });

    expect(mockEnviarArquivo).toHaveBeenCalledWith(
      '/v1/justifications/sign-upload',
      { classId: AULA },
      ANEXO,
    );
    // Gravar antes deixaria a linha apontando para um arquivo que talvez não chegue.
    const ordemDoUpload = mockEnviarArquivo.mock.invocationCallOrder[0] ?? Infinity;
    const ordemDaGravacao = chain.upsert.mock.invocationCallOrder[0] ?? -Infinity;
    expect(ordemDoUpload).toBeLessThan(ordemDaGravacao);
    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        message: null,
        proof_provider: 'cloudinary',
        proof_public_id: `justificativas/${ALUNO}/${AULA}`,
      }),
      { onConflict: 'class_id,user_id' },
    );
  });

  it('naoDeveGravarALinhaQuandoOUploadFalha', async () => {
    const chain = mockQuery();
    mockEnviarArquivo.mockRejectedValue(new Error('Cloudinary recusou o upload (HTTP 400)'));

    await expect(
      submitJustification(ALUNO, { classId: AULA, message: 'Atestado', attachment: ANEXO }),
    ).rejects.toThrow('HTTP 400');
    expect(chain.upsert).not.toHaveBeenCalled();
  });

  it('deveRecusarAnexoNumBuildSemBackendEmVezDeFalharEmSilencio', async () => {
    mockApiDisponivel.mockReturnValue(false);

    await expect(
      submitJustification(ALUNO, { classId: AULA, message: 'Atestado', attachment: ANEXO }),
    ).rejects.toBeInstanceOf(AnexoIndisponivelError);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe('reviewJustification', () => {
  it('deveEnviarSoOStatusDeixandoOCarimboParaOBanco', async () => {
    const chain = mockQuery();

    await reviewJustification(JUSTIFICATIVA, 'approved');

    // reviewed_by/reviewed_at são carimbados pelo gatilho: o app não escolhe
    // em nome de quem a revisão ficou registrada.
    expect(chain.update).toHaveBeenCalledWith({ status: 'approved' });
    expect(chain.eq).toHaveBeenCalledWith('id', JUSTIFICATIVA);
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
