import {
  formatarWhatsapp,
  linkDoEmail,
  linkDoWhatsapp,
  temContato,
  whatsappDigitadoValido,
  whatsappParaCampo,
  whatsappParaGravar,
} from '@/utils/contato';

describe('contato da academia (contrato § 5.4)', () => {
  it('deveGravarOWhatsappComO55NaFrenteESoDigitos', () => {
    expect(whatsappParaGravar('(11) 91234-5678')).toBe('5511912345678');
  });

  it('deveGravarNuloQuandoOCampoFicaVazio', () => {
    // A constraint recusa texto vazio: o cliente grava null.
    expect(whatsappParaGravar('   ')).toBeNull();
  });

  it('deveAceitarCelularEFixoComDddERecusarNumeroCurtoOuDddComZero', () => {
    expect(whatsappDigitadoValido('(11) 91234-5678')).toBe(true);
    expect(whatsappDigitadoValido('(11) 3123-4567')).toBe(true);
    expect(whatsappDigitadoValido('')).toBe(true);
    expect(whatsappDigitadoValido('91234-5678')).toBe(false);
    expect(whatsappDigitadoValido('(01) 91234-5678')).toBe(false);
  });

  it('deveExibirComoPedeOContrato', () => {
    expect(formatarWhatsapp('5511912345678')).toBe('+55 (11) 91234-5678');
    expect(formatarWhatsapp('551131234567')).toBe('+55 (11) 3123-4567');
  });

  it('deveDevolverOCampoSemO55ParaEditar', () => {
    expect(whatsappParaCampo('5511912345678')).toBe('(11) 91234-5678');
    expect(whatsappParaCampo(null)).toBe('');
  });

  it('deveMontarSoOsDoisLinksDoContrato', () => {
    expect(linkDoWhatsapp('5511912345678')).toBe('https://wa.me/5511912345678');
    expect(linkDoEmail('contato@exemplo.com')).toBe('mailto:contato@exemplo.com');
  });

  it('deveDizerSeHaAlgumContato', () => {
    expect(temContato({ whatsapp: null, email: null })).toBe(false);
    expect(temContato({ whatsapp: null, email: 'a@b.com' })).toBe(true);
  });
});
