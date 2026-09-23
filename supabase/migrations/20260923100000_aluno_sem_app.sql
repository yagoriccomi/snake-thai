-- ============================================================================
-- Aluno que não usa o aplicativo
--
-- Não existe app para iPhone. Esses alunos precisam existir no sistema mesmo
-- assim: o professor faz a chamada deles, e a mensalidade deles conta no
-- financeiro. Sem isso, a frequência da turma e o faturamento ficam errados.
--
-- O problema não é só "não conseguir entrar". Hoje o cadastro cria a conta com
-- o e-mail e mais nada: nome, CPF, telefone e nascimento são preenchidos pelo
-- PRÓPRIO aluno no primeiro acesso, e a tela de edição os bloqueia enquanto
-- isso não acontece. Quem nunca entra fica como "Aluno pendente", sem nome,
-- para sempre — e o professor não sabe quem marcar na chamada.
--
-- Então a marcação não é uma etiqueta: ela decide QUEM preenche os dados.
-- Marcada a pessoa como sem acesso, o administrador preenche, e o banco exige.
--
-- `access_channel` nasce com dois valores. Quando a página web existir (ela
-- está planejada, para justamente estes alunos), entra um terceiro, `'web'`,
-- e quem está em `'none'` migra para lá.
-- ============================================================================

alter table public.profiles
  add column access_channel text not null default 'app';

alter table public.profiles
  add constraint profiles_access_channel_valido
  check (access_channel in ('app', 'none'));

comment on column public.profiles.access_channel is
  'Por onde a pessoa acessa: ''app'' (padrão) ou ''none'' (não acessa; a academia registra por ela). Quem é ''none'' tem os dados preenchidos pelo administrador. Um valor ''web'' entra quando a página web existir.';

-- Quem não acessa não tem como se identificar depois: os dados precisam estar
-- ali no cadastro, senão a chamada mostra um aluno sem nome.
alter table public.profiles
  add constraint profiles_sem_acesso_tem_dados
  check (
    access_channel <> 'none'
    or (name is not null and btrim(name) <> '' and cpf is not null)
  );
