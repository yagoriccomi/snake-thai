import { lerContasDeTeste } from '@/config/contasDeTeste';

const CONTAS = 'aluno:aluno@snake.com|admin:adm@snake.com|professor:professor@snake.com';
const SENHA = 'senha-do-seed';

describe('lerContasDeTeste', () => {
  it('deveDevolverAsContasNaOrdemDeUso', () => {
    const contas = lerContasDeTeste('development', CONTAS, SENHA);

    expect(contas.map((conta) => conta.papel)).toEqual(['admin', 'professor', 'aluno']);
    expect(contas.map((conta) => conta.rotulo)).toEqual(['Admin', 'Professor', 'Aluno']);
    expect(contas[0]).toEqual({
      papel: 'admin',
      rotulo: 'Admin',
      email: 'adm@snake.com',
      senha: SENHA,
    });
  });

  it('naoDeveDevolverNadaNoAppDeProducao', () => {
    // Atalho de login em produção seria porta aberta, mesmo com a variável presente.
    expect(lerContasDeTeste('production', CONTAS, SENHA)).toEqual([]);
  });

  it('naoDeveDevolverNadaSemSenhaOuSemContas', () => {
    expect(lerContasDeTeste('development', CONTAS, '   ')).toEqual([]);
    expect(lerContasDeTeste('development', undefined, SENHA)).toEqual([]);
    expect(lerContasDeTeste('development', '', SENHA)).toEqual([]);
  });

  it('deveIgnorarPedacoMalFormado', () => {
    const contas = lerContasDeTeste('development', 'admin:adm@snake.com|lixo|dono:x@y.com|aluno:', SENHA);

    expect(contas.map((conta) => conta.email)).toEqual(['adm@snake.com']);
  });
});
