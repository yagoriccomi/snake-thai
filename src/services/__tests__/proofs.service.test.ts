/**
 * Comprovantes no app — a escolha do provedor.
 *
 * Durante a migração existem arquivos nos DOIS provedores. Escolher errado não
 * dá erro barulhento: dá um link quebrado, em silêncio, para um dado
 * financeiro. Por isso a maior parte destes casos ataca a convivência entre o
 * legado e o novo, não o caminho feliz. [Regra de Ouro nº 3]
 */

jest.mock('@/lib/api', () => ({
  apiDisponivel: jest.fn(),
  chamarApi: jest.fn(),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    storage: { from: jest.fn() },
    from: jest.fn(),
  },
}));

jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn(() => Promise.resolve('YmFzZTY0')),
  EncodingType: { Base64: 'base64' },
}));

import { apiDisponivel, chamarApi } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import {
  createSignedProofUrl,
  removerArquivoDoComprovante,
  submitProof,
  type ReferenciaDeComprovante,
} from '@/services/proofs.service';

const mockApiDisponivel = apiDisponivel as jest.Mock;
const mockChamarApi = chamarApi as jest.Mock;
const mockStorageFrom = supabase.storage.from as jest.Mock;
const mockFrom = supabase.from as jest.Mock;

const USUARIO = '11111111-1111-1111-1111-111111111111';
const PAGAMENTO = '22222222-2222-2222-2222-222222222222';

const UPLOAD = {
  userId: USUARIO,
  paymentId: PAGAMENTO,
  fileUri: 'file:///tmp/recibo.jpg',
  fileName: 'recibo.jpg',
  contentType: 'image/jpeg',
  base64: 'YmFzZTY0',
};

/** Comprovante já migrado. */
const NA_CLOUDINARY: ReferenciaDeComprovante = {
  id: PAGAMENTO,
  proof_provider: 'cloudinary',
  proof_public_id: `comprovantes/${USUARIO}/${PAGAMENTO}`,
  proof_storage_path: null,
  proof_url: null,
};

/** Comprovante enviado por um APK antigo, ainda no bucket. */
const NO_STORAGE: ReferenciaDeComprovante = {
  id: PAGAMENTO,
  proof_provider: 'supabase_storage',
  proof_public_id: null,
  proof_storage_path: `${USUARIO}/${PAGAMENTO}_recibo.jpg`,
  proof_url: `${USUARIO}/${PAGAMENTO}_recibo.jpg`,
};

/** Linha gravada antes da migration que criou as colunas novas. */
const ANTES_DA_MIGRATION: ReferenciaDeComprovante = {
  id: PAGAMENTO,
  proof_provider: null,
  proof_public_id: null,
  proof_storage_path: null,
  proof_url: `${USUARIO}/${PAGAMENTO}_antigo.jpg`,
};

function prepararUpdateDoPagamento() {
  const eq = jest.fn(() => Promise.resolve({ error: null }));
  const update = jest.fn(() => ({ eq }));
  mockFrom.mockReturnValue({ update });
  return { update, eq };
}

describe('proofs.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Duas chamadas acontecem agora: a primeira LÊ o arquivo local (o
    // `fetch(uri).blob()` que substituiu o `{uri,name,type}` recusado pelo
    // fetch do SDK 57), a segunda envia à Cloudinary. Por isso o dublê
    // precisa saber responder `blob()` também.
    globalThis.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        blob: () => Promise.resolve(new Blob(['conteudo'], { type: 'image/jpeg' })),
        json: () => Promise.resolve({ public_id: `comprovantes/${USUARIO}/${PAGAMENTO}` }),
      }),
    ) as unknown as typeof fetch;
  });

  describe('submitProof', () => {
    it('deveGravarOProvedorJuntoComOIdentificadorParaNaoDeixarALinhaAmbigua', async () => {
      // A constraint do banco recusa provider sem identificador. Gravar um sem
      // o outro derruba o envio inteiro do aluno.
      mockApiDisponivel.mockReturnValue(true);
      mockChamarApi.mockResolvedValue({
        cloudName: 'nuvem',
        apiKey: 'chave',
        timestamp: 1,
        signature: 'assinatura',
        folder: `comprovantes/${USUARIO}`,
        public_id: PAGAMENTO,
        type: 'authenticated',
        uploadUrl: 'https://api.cloudinary.com/v1_1/nuvem/auto/upload',
      });
      const { update } = prepararUpdateDoPagamento();

      await submitProof(UPLOAD);

      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'pending_approval',
          proof_provider: 'cloudinary',
          proof_public_id: `comprovantes/${USUARIO}/${PAGAMENTO}`,
          proof_storage_path: null,
        }),
      );
    });

    it('naoDeveEnviarOArquivoPeloNossoServidorEsimDiretoAoProvedor', async () => {
      // O backend limita o corpo a 32kb. Se o arquivo passasse por ele,
      // qualquer comprovante real seria rejeitado. [#65]
      mockApiDisponivel.mockReturnValue(true);
      mockChamarApi.mockResolvedValue({
        cloudName: 'nuvem',
        apiKey: 'chave',
        timestamp: 1,
        signature: 'assinatura',
        folder: `comprovantes/${USUARIO}`,
        public_id: PAGAMENTO,
        type: 'authenticated',
        uploadUrl: 'https://api.cloudinary.com/v1_1/nuvem/auto/upload',
      });
      prepararUpdateDoPagamento();

      await submitProof(UPLOAD);

      const urls = (globalThis.fetch as jest.Mock).mock.calls.map(
        (chamada) => chamada[0] as string,
      );
      // O arquivo sobe DIRETO ao provedor: nenhuma chamada de upload passa
      // pelo nosso backend, que só assina (corpo limitado a 32kb).
      expect(urls.some((url) => url.includes('api.cloudinary.com'))).toBe(true);
      expect(urls.some((url) => url.includes('/v1/proofs/'))).toBe(false);
      expect(mockChamarApi).toHaveBeenCalledWith('/v1/proofs/sign-upload', {
        paymentId: PAGAMENTO,
      });
    });

    it('deveAnexarUmBlobRealPorqueOFetchDoSdk57RecusaOFormatoAntigo', async () => {
      prepararUpdateDoPagamento();

      await submitProof(UPLOAD);

      // Regressão de uma falha verificada no aparelho: anexar
      // `{ uri, name, type }` — o jeito clássico do React Native — quebra com
      // "Unsupported FormDataPart implementation" ao MONTAR o corpo, antes de
      // qualquer byte sair. Nenhum comprovante era enviado, e o servidor
      // parecia saudável porque a requisição nunca chegava nele.
      const chamadas = (globalThis.fetch as jest.Mock).mock.calls;
      const upload = chamadas.find((c) => String(c[0]).includes('api.cloudinary.com'));
      const corpo = upload?.[1]?.body as FormData;
      const anexo = corpo.get('file');
      expect(anexo).toBeInstanceOf(Blob);
      // O uri local é LIDO (vira Blob), não repassado como se fosse o arquivo.
      expect(chamadas.some((c) => c[0] === UPLOAD.fileUri)).toBe(true);
    });

    it('deveCairNoStorageQuandoOBuildNaoTemBackendConfigurado', async () => {
      // Um APK publicado sem EXPO_PUBLIC_API_URL precisa continuar aceitando
      // comprovante. Falhar aqui quebraria o pagamento de quem não atualizou.
      mockApiDisponivel.mockReturnValue(false);
      const upload = jest.fn(() => Promise.resolve({ error: null }));
      mockStorageFrom.mockReturnValue({ upload });
      const { update } = prepararUpdateDoPagamento();

      await submitProof(UPLOAD);

      expect(upload).toHaveBeenCalled();
      expect(mockChamarApi).not.toHaveBeenCalled();
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          proof_provider: 'supabase_storage',
          proof_public_id: null,
        }),
      );
    });

    it('naoDeveMarcarOPagamentoComoEnviadoQuandoOUploadFalha', async () => {
      // Marcar `pending_approval` sem arquivo faria o admin abrir um
      // comprovante que não existe — e o aluno achar que já pagou.
      mockApiDisponivel.mockReturnValue(true);
      mockChamarApi.mockResolvedValue({
        cloudName: 'nuvem',
        apiKey: 'chave',
        timestamp: 1,
        signature: 'assinatura',
        folder: `comprovantes/${USUARIO}`,
        public_id: PAGAMENTO,
        type: 'authenticated',
        uploadUrl: 'https://api.cloudinary.com/v1_1/nuvem/auto/upload',
      });
      globalThis.fetch = jest.fn(() =>
        Promise.resolve({ ok: false, json: () => Promise.resolve({}) }),
      ) as unknown as typeof fetch;
      const { update } = prepararUpdateDoPagamento();

      await expect(submitProof(UPLOAD)).rejects.toThrow();
      expect(update).not.toHaveBeenCalled();
    });

    it('deveSanitizarONomeDoArquivoAntesDeCompoOCaminhoNoStorage', async () => {
      // Um nome com "../" poderia escapar da pasta do próprio aluno, que é o
      // limite em que a RLS de Storage se apoia. [#51]
      mockApiDisponivel.mockReturnValue(false);
      const upload = jest.fn(() => Promise.resolve({ error: null }));
      mockStorageFrom.mockReturnValue({ upload });
      prepararUpdateDoPagamento();

      await submitProof({ ...UPLOAD, fileName: '../../etc/passwd' });

      const [caminho] = upload.mock.calls[0] as unknown as [string];

      // O que impede a travessia não é remover os pontos — é remover as
      // BARRAS. Sem separador, "../.." vira um nome de arquivo comum e o
      // caminho não consegue sair da pasta do próprio aluno. Por isso a
      // asserção conta segmentos em vez de procurar "..": o caminho tem que
      // ter exatamente dois, `<userId>/<arquivo>`.
      expect(caminho.split('/')).toHaveLength(2);
      expect(caminho.startsWith(`${USUARIO}/`)).toBe(true);
    });
  });

  describe('createSignedProofUrl', () => {
    it('devePedirAUrlAoBackendQuandoOComprovanteJaEstaNaCloudinary', async () => {
      mockChamarApi.mockResolvedValue({
        url: 'https://res.cloudinary.com/assinada',
        paginas: 1,
        pagina: 1,
      });

      const visualizavel = await createSignedProofUrl(NA_CLOUDINARY);

      expect(visualizavel.url).toBe('https://res.cloudinary.com/assinada');
      expect(mockChamarApi).toHaveBeenCalledWith('/v1/proofs/view-url', {
        paymentId: PAGAMENTO,
        pagina: 1,
      });
    });

    it('deveLerDoStorageQuandoOComprovanteEhLegadoEmVezDePedirAoBackend', async () => {
      // ESTE É O CASO QUE MOTIVOU O CONTRATO. Mandar um path do Storage para o
      // endpoint da Cloudinary devolveria link quebrado sem erro visível.
      const createSignedUrl = jest.fn(() =>
        Promise.resolve({ data: { signedUrl: 'https://supabase/assinada' }, error: null }),
      );
      mockStorageFrom.mockReturnValue({ createSignedUrl });

      const visualizavel = await createSignedProofUrl(NO_STORAGE);

      expect(visualizavel.url).toBe('https://supabase/assinada');
      expect(mockChamarApi).not.toHaveBeenCalled();
    });

    it('deveExpirarAUrlDoComprovanteLegadoEmVezDeEntregarLinkVitalicio', async () => {
      // Comprovante é PII financeira: a URL não pode valer para sempre. [#63]
      const createSignedUrl = jest.fn(() =>
        Promise.resolve({ data: { signedUrl: 'https://supabase/assinada' }, error: null }),
      );
      mockStorageFrom.mockReturnValue({ createSignedUrl });

      await createSignedProofUrl(NO_STORAGE);

      const [, validade] = createSignedUrl.mock.calls[0] as unknown as [string, number];
      expect(validade).toBeGreaterThan(0);
      expect(validade).toBeLessThanOrEqual(600);
    });

    it('deveUsarOProofUrlAntigoQuandoALinhaEhAnteriorAMigration', async () => {
      // Linhas gravadas antes das colunas novas só têm `proof_url`. Sem este
      // fallback, todo comprovante histórico vira "indisponível". [#15]
      const createSignedUrl = jest.fn(() =>
        Promise.resolve({ data: { signedUrl: 'https://supabase/antiga' }, error: null }),
      );
      mockStorageFrom.mockReturnValue({ createSignedUrl });

      const visualizavel = await createSignedProofUrl(ANTES_DA_MIGRATION);

      expect(visualizavel.url).toBe('https://supabase/antiga');
      const [caminho] = createSignedUrl.mock.calls[0] as unknown as [string];
      expect(caminho).toBe(ANTES_DA_MIGRATION.proof_url);
    });

    it('deveRepassarOTotalDePaginasParaATelaPoderAvisarOAdmin', async () => {
      // Sem este número, um extrato com o comprovante na página 2 mostraria a
      // folha de rosto e mais nada — e o admin recusaria um pagamento legítimo
      // achando que o aluno não enviou.
      mockChamarApi.mockResolvedValue({
        url: 'https://res.cloudinary.com/pag1',
        paginas: 3,
        pagina: 1,
      });

      const visualizavel = await createSignedProofUrl(NA_CLOUDINARY);

      expect(visualizavel.paginas).toBe(3);
    });

    it('devePedirAPaginaEscolhidaQuandoOAdminNavegaNoDocumento', async () => {
      mockChamarApi.mockResolvedValue({
        url: 'https://res.cloudinary.com/pag2',
        paginas: 3,
        pagina: 2,
      });

      await createSignedProofUrl(NA_CLOUDINARY, 2);

      expect(mockChamarApi).toHaveBeenCalledWith('/v1/proofs/view-url', {
        paymentId: PAGAMENTO,
        pagina: 2,
      });
    });

    it('deveDeclararUmaPaginaParaOComprovanteLegadoQueOAppNuncaSoubeDividir', async () => {
      // O Storage não pagina documento. Declarar 1 mantém a tela coerente sem
      // prometer uma navegação que não existe para o arquivo antigo. [#15]
      const createSignedUrl = jest.fn(() =>
        Promise.resolve({ data: { signedUrl: 'https://supabase/x' }, error: null }),
      );
      mockStorageFrom.mockReturnValue({ createSignedUrl });

      const visualizavel = await createSignedProofUrl(NO_STORAGE);

      expect(visualizavel.paginas).toBe(1);
      expect(visualizavel.pagina).toBe(1);
    });

    it('deveFalharComMensagemClaraQuandoNaoHaComprovanteNenhum', async () => {
      const semNada: ReferenciaDeComprovante = {
        id: PAGAMENTO,
        proof_provider: null,
        proof_public_id: null,
        proof_storage_path: null,
        proof_url: null,
      };

      await expect(createSignedProofUrl(semNada)).rejects.toThrow(
        'Este pagamento não tem comprovante.',
      );
    });
  });

  describe('removerArquivoDoComprovante', () => {
    it('naoDeveApagarNaCloudinaryPeloAppPorqueAFilaDoBancoCuidaDisso', async () => {
      // Uma exclusão que depende de o app estar aberto e com rede não é
      // exclusão confiável — e a LGPD não aceita "quase apagado". O gatilho
      // do banco enfileira; o servidor consome. [#25]
      await removerArquivoDoComprovante(NA_CLOUDINARY);

      expect(mockStorageFrom).not.toHaveBeenCalled();
    });

    it('deveApagarDoStorageOComprovanteLegadoQueOGatilhoNaoAlcanca', async () => {
      const remove = jest.fn(() => Promise.resolve({ error: null }));
      mockStorageFrom.mockReturnValue({ remove });

      await removerArquivoDoComprovante(NO_STORAGE);

      expect(remove).toHaveBeenCalledWith([NO_STORAGE.proof_storage_path]);
    });

    it('naoDeveQuebrarQuandoNaoHaArquivoParaApagar', async () => {
      const semNada: ReferenciaDeComprovante = {
        id: PAGAMENTO,
        proof_provider: null,
        proof_public_id: null,
        proof_storage_path: null,
        proof_url: null,
      };

      await expect(removerArquivoDoComprovante(semNada)).resolves.toBeUndefined();
      expect(mockStorageFrom).not.toHaveBeenCalled();
    });
  });
});
