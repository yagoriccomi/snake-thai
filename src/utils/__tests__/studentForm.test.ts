import {
  normalizarFormularioDeAluno,
  validarEmailDoAluno,
  validarFormularioDeAluno,
  type ValoresDoFormularioDeAluno,
} from '@/utils/studentForm';

const VALIDO: ValoresDoFormularioDeAluno = {
  nome: 'Aluna Teste',
  cpf: '529.982.247-25',
  celular: '(11) 91234-5678',
  nascimento: '31/01/2000',
};

const INTEGRADO = { pendente: false };

describe('validarFormularioDeAluno', () => {
  it('deveAceitarUmCadastroCompletoValido', () => {
    expect(validarFormularioDeAluno(VALIDO, INTEGRADO)).toEqual({});
  });

  it('deveRecusarCpfComDigitoVerificadorErrado', () => {
    expect(validarFormularioDeAluno({ ...VALIDO, cpf: '529.982.247-26' }, INTEGRADO).cpf).toBeDefined();
  });

  it('deveRecusarCpfComTodosOsDigitosIguais', () => {
    expect(validarFormularioDeAluno({ ...VALIDO, cpf: '111.111.111-11' }, INTEGRADO).cpf).toBeDefined();
  });

  it('deveRecusarCelularCurto', () => {
    expect(validarFormularioDeAluno({ ...VALIDO, celular: '91234-567' }, INTEGRADO).celular).toBeDefined();
  });

  it('deveRecusarNascimentoNoFuturo', () => {
    expect(validarFormularioDeAluno({ ...VALIDO, nascimento: '01/01/2999' }, INTEGRADO).nascimento).toBeDefined();
  });

  it('deveAceitarCelularENascimentoVazios', () => {
    expect(validarFormularioDeAluno({ ...VALIDO, celular: '', nascimento: '' }, INTEGRADO)).toEqual({});
  });

  it('deveExigirNomeECpfDePerfilIntegrado', () => {
    const erros = validarFormularioDeAluno({ ...VALIDO, nome: '  ', cpf: '' }, INTEGRADO);
    expect(erros.nome).toBeDefined();
    expect(erros.cpf).toBeDefined();
  });

  it('deveAceitarPerfilPendenteSemNomeNemCpf', () => {
    expect(validarFormularioDeAluno({ ...VALIDO, nome: '', cpf: '' }, { pendente: true })).toEqual({});
  });
});

describe('validarEmailDoAluno', () => {
  it('deveAceitarEmailValidoERecusarInvalido', () => {
    expect(validarEmailDoAluno('aluna@exemplo.com')).toBeNull();
    expect(validarEmailDoAluno('aluna@')).not.toBeNull();
  });
});

describe('normalizarFormularioDeAluno', () => {
  it('deveGravarSoDigitosEDataIso', () => {
    expect(normalizarFormularioDeAluno(VALIDO)).toEqual({
      name: 'Aluna Teste',
      cpf: '52998224725',
      phone: '11912345678',
      dob: '2000-01-31',
    });
  });

  it('deveTransformarVazioEmNulo', () => {
    expect(normalizarFormularioDeAluno({ ...VALIDO, celular: '', nascimento: '' })).toMatchObject({
      phone: null,
      dob: null,
    });
  });
});
