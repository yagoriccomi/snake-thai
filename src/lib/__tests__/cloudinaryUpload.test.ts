const mockChamarApi = jest.fn();

jest.mock('@/lib/api', () => ({
  chamarApi: (...args: unknown[]): unknown => mockChamarApi(...args),
}));

import { enviarArquivoAssinado, sanitizeFileName } from '@/lib/cloudinaryUpload';

const URL_DO_UPLOAD = 'https://api.cloudinary.com/v1_1/nuvem/auto/upload';
const ARQUIVO = { uri: 'file:///cache/atestado.jpg', name: 'meu atestado (1).jpg' };

const ASSINATURA = {
  cloudName: 'nuvem',
  apiKey: 'chave',
  timestamp: 1_700_000_000,
  signature: 'assinatura',
  folder: 'justificativas/aluno',
  public_id: 'aula',
  type: 'authenticated',
  uploadUrl: URL_DO_UPLOAD,
};

interface RespostaDoUpload {
  ok: boolean;
  status?: number;
  json?: () => Promise<unknown>;
  text?: () => Promise<string>;
}

function prepararFetch(respostaDoUpload: RespostaDoUpload): jest.Mock {
  const fetchFalso = jest.fn((url: string) =>
    url === URL_DO_UPLOAD
      ? Promise.resolve(respostaDoUpload)
      : Promise.resolve({ blob: () => Promise.resolve(new Blob(['bytes'], { type: 'image/jpeg' })) }),
  );
  globalThis.fetch = fetchFalso as unknown as typeof fetch;
  return fetchFalso;
}

beforeEach(() => {
  mockChamarApi.mockReset().mockResolvedValue(ASSINATURA);
});

describe('sanitizeFileName', () => {
  it('deveTrocarCaracteresPerigososPorSublinhado', () => {
    expect(sanitizeFileName('meu atestado (1).jpg')).toBe('meu_atestado__1_.jpg');
    expect(sanitizeFileName('../../etc/passwd')).toBe('.._.._etc_passwd');
  });
});

describe('enviarArquivoAssinado', () => {
  it('deveAnexarUmBlobRealComOsCamposDaAssinatura', async () => {
    const fetchFalso = prepararFetch({
      ok: true,
      json: () => Promise.resolve({ public_id: 'justificativas/aluno/aula' }),
    });

    await enviarArquivoAssinado('/v1/justifications/sign-upload', { classId: 'aula' }, ARQUIVO);

    expect(mockChamarApi).toHaveBeenCalledWith('/v1/justifications/sign-upload', { classId: 'aula' });
    const chamadaDoUpload = fetchFalso.mock.calls.find((c) => c[0] === URL_DO_UPLOAD) as
      | [string, { body: FormData }]
      | undefined;
    const corpo = chamadaDoUpload?.[1].body;
    // Regressão do SDK 57: o `{ uri, name, type }` falhava ao montar o corpo.
    expect(corpo?.get('file')).toBeInstanceOf(Blob);
    expect(corpo?.get('signature')).toBe('assinatura');
    expect(corpo?.get('folder')).toBe('justificativas/aluno');
    expect(corpo?.get('public_id')).toBe('aula');
    expect(corpo?.get('type')).toBe('authenticated');
  });

  it('deveDevolverOPublicIdQueOProvedorConfirmou', async () => {
    prepararFetch({ ok: true, json: () => Promise.resolve({ public_id: 'definitivo' }) });
    await expect(
      enviarArquivoAssinado('/v1/proofs/sign-upload', { paymentId: 'p' }, ARQUIVO),
    ).resolves.toBe('definitivo');
  });

  it('deveMontarOPublicIdPelaAssinaturaQuandoOProvedorNaoDevolve', async () => {
    prepararFetch({ ok: true, json: () => Promise.resolve({}) });
    await expect(
      enviarArquivoAssinado('/v1/proofs/sign-upload', { paymentId: 'p' }, ARQUIVO),
    ).resolves.toBe('justificativas/aluno/aula');
  });

  it('deveIncluirARecusaDaCloudinaryNoErroEmVezDeDescartala', async () => {
    prepararFetch({
      ok: false,
      status: 400,
      text: () => Promise.resolve('{"error":{"message":"Invalid Signature"}}'),
    });

    await expect(
      enviarArquivoAssinado('/v1/proofs/sign-upload', { paymentId: 'p' }, ARQUIVO),
    ).rejects.toThrow(/HTTP 400.*Invalid Signature/);
  });
});
