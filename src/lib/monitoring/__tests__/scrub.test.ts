import type { Breadcrumb, ErrorEvent } from '@sentry/react-native';

import {
  isExpectedNetworkError,
  scrubBreadcrumb,
  scrubEvent,
  scrubText,
  scrubUrl,
  TEXTO_REMOVIDO,
} from '@/lib/monitoring/scrub';

describe('scrubText', () => {
  it('deveRemoverCpfDoDetailsDoPostgrest', () => {
    const texto = 'duplicate key value violates unique constraint. Key (cpf)=(12345678900) already exists.';
    expect(scrubText(texto)).not.toContain('12345678900');
    expect(scrubText('CPF 123.456.789-00 inválido')).toBe(`CPF ${TEXTO_REMOVIDO} inválido`);
  });

  it('deveRemoverEmailETelefone', () => {
    const limpo = scrubText('aluno.teste@exemplo.com.br ligou de (11) 91234-5678');
    expect(limpo).not.toMatch(/exemplo|91234/);
  });

  it('deveRemoverJwtEBearer', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.assinatura_Xy-1';
    expect(scrubText(`token ${jwt}`)).toBe(`token ${TEXTO_REMOVIDO}`);
    expect(scrubText('Authorization: Bearer abc.def-123')).toBe(`Authorization: ${TEXTO_REMOVIDO}`);
  });

  it('naoDeveEstragarIdsEDatasUsadosParaDepurar', () => {
    const texto = 'pagamento 4f1c9a2e-0b7d-4c1e-9f7a-1234567890ab em 2026-09-16 status 42501';
    expect(scrubText(texto)).toBe(texto);
  });
});

describe('scrubUrl', () => {
  it('deveRemoverQueryStringDeUrlAssinada', () => {
    expect(scrubUrl('https://res.cloudinary.com/x/image/upload/s--abc--/v1/a.jpg?_a=assinatura#f')).toBe(
      'https://res.cloudinary.com/x/image/upload/s--abc--/v1/a.jpg',
    );
    expect(scrubUrl('https://api.exemplo.com/v1/proofs')).toBe('https://api.exemplo.com/v1/proofs');
  });
});

describe('scrubEvent', () => {
  it('deveApagarIpEEmailDoUsuarioEManterSoOIdPseudonimo', () => {
    const evento = {
      type: undefined,
      user: { id: 'instalacao-1', email: 'a@b.com', ip_address: '189.1.2.3', username: 'fulano' },
      request: { url: 'https://api.exemplo.com/x?token=abc', headers: { Authorization: 'Bearer x' } },
    } as ErrorEvent;

    const limpo = scrubEvent(evento);

    expect(limpo.user).toEqual({ id: 'instalacao-1' });
    expect(limpo.request).toEqual({ url: 'https://api.exemplo.com/x' });
  });

  it('deveFiltrarOTextoDaExcecaoDosExtrasEDasTrilhas', () => {
    const evento = {
      type: undefined,
      exception: { values: [{ type: 'Error', value: 'Key (cpf)=(12345678900) already exists.' }] },
      extra: { errorMessage: '{"details":"Key (cpf)=(12345678900)"}', contagem: 3 },
      breadcrumbs: [
        { category: 'console', message: '{"stack":"..."}' },
        { category: 'fetch', data: { url: 'https://x.com/a?sig=1' } },
      ],
    } as ErrorEvent;

    const limpo = scrubEvent(evento);

    expect(JSON.stringify(limpo)).not.toContain('12345678900');
    expect(limpo.extra?.contagem).toBe(3);
    expect(limpo.breadcrumbs).toEqual([{ category: 'fetch', data: { url: 'https://x.com/a' } }]);
  });
});

describe('scrubBreadcrumb', () => {
  it('deveDescartarBreadcrumbDeConsole', () => {
    expect(scrubBreadcrumb({ category: 'console', message: 'x' })).toBeNull();
  });

  it('deveTirarAQueryDaUrlDeHttp', () => {
    const migalha: Breadcrumb = { category: 'xhr', data: { url: 'https://x.com/y?assinatura=1', status_code: 200 } };
    expect(scrubBreadcrumb(migalha)).toEqual({ category: 'xhr', data: { url: 'https://x.com/y', status_code: 200 } });
  });
});

describe('isExpectedNetworkError', () => {
  it('deveReconhecerFalhaDeRede', () => {
    expect(isExpectedNetworkError(new TypeError('Network request failed'))).toBe(true);
    expect(isExpectedNetworkError(Object.assign(new Error('abortado'), { name: 'AbortError' }))).toBe(true);
    expect(isExpectedNetworkError({ name: 'ApiError', code: 'falha_de_rede' })).toBe(true);
  });

  it('naoDeveEsconderErroDeVerdade', () => {
    expect(isExpectedNetworkError(new Error('Cannot read property x of undefined'))).toBe(false);
    expect(isExpectedNetworkError({ code: '42501', message: 'RLS negou' })).toBe(false);
    expect(isExpectedNetworkError('Network request failed')).toBe(false);
  });
});
