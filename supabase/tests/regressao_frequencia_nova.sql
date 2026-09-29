-- Regressão da frequência nova (bloco 4.5a, migration 20260929130000_frequencia_nova):
-- a § 11.5 do contrato INTEIRA, com os números fechados das tabelas do dono.
-- Roda numa transação e termina em ROLLBACK; mesmo assim, rode SÓ no banco
-- local (scripts\db-dev test).
--
-- Os fluxos que mudam o estado das trocas (a chamada que aprova ou expira, a
-- T50 no cancelamento, a reativação, a retificação) são dos blocos 4.6, 4.7 e
-- 4.9. Aqui cada linha da tabela "Trocas e extra" é montada no ESTADO FINAL
-- que o fluxo deixa, e a conta é conferida.
\set ON_ERROR_STOP on

begin;

update public.academy_settings set class_weekdays = '{1,2,3,4,5,6}';

-- =====================================================================
-- Ferramentas do cenário
-- =====================================================================
create temp table ids (chave text primary key, id uuid not null) on commit drop;
create temp sequence cpf_seq start 1;
grant select on ids to authenticated, anon;

create function pg_temp.id(p_chave text) returns uuid language sql as $$
  select i.id from ids i where i.chave = p_chave;
$$;

create function pg_temp.aluno(p_chave text, p_criado timestamptz default '2026-01-01 10:00-03', p_papel public.user_role default 'user')
returns uuid language plpgsql as $$
declare v uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  values (v, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'f5-' || p_chave || '@t.invalid', 'x', now(), now(), now());
  insert into public.profiles (id, role, name, cpf, is_first_login, status, created_at)
  values (v, p_papel, 'F5 ' || p_chave, '55' || lpad(nextval('cpf_seq')::text, 9, '0'), false, 'active', p_criado);
  insert into ids values (p_chave, v);
  return v;
end $$;

create function pg_temp.grupo(p_id text) returns text language sql as $$
  insert into public.groups (id, name) values (p_id, 'F5 ' || p_id) returning id;
$$;

create function pg_temp.na_turma(p_aluno text, p_grupo text, p_de timestamptz, p_ate timestamptz default null)
returns void language sql as $$
  insert into public.student_group_periods (user_id, group_id, started_at, start_reason, ended_at, end_reason)
  values (pg_temp.id(p_aluno), p_grupo, p_de, 'signup', p_ate, case when p_ate is not null then 'group_changed' end);
$$;

create function pg_temp.no_plano(p_aluno text, p_plano text, p_de timestamptz, p_ate timestamptz default null)
returns void language sql as $$
  insert into public.plan_periods (user_id, plan_id, started_at, ended_at)
  values (pg_temp.id(p_aluno), pg_temp.id(p_plano), p_de, p_ate);
$$;

create function pg_temp.aula(
  p_chave text, p_grupo text, p_quando timestamptz,
  p_publico public.class_audience default 'fixed', p_chamada boolean default true, p_horario uuid default null
) returns uuid language plpgsql as $$
declare v uuid;
begin
  insert into public.classes (title, type, group_id, date_time, attendance_taken_at, audience, schedule_id, occurrence_date)
  values ('F5 ' || p_chave, 'routine', p_grupo, p_quando,
          case when p_chamada then p_quando + interval '1 hour' end, p_publico,
          p_horario, case when p_horario is not null then (p_quando at time zone 'America/Sao_Paulo')::date end)
  returning id into v;
  insert into ids values (p_chave, v);
  return v;
end $$;

create function pg_temp.horario(p_chave text, p_grupo text) returns uuid language plpgsql as $$
declare v uuid;
begin
  insert into public.class_schedules (group_id, title, weekday, start_time, valid_from, audience)
  values (p_grupo, 'F5 ' || p_chave, 3, '19:00', '2026-01-01', 'fixed')
  returning id into v;
  insert into ids values (p_chave, v);
  return v;
end $$;

create function pg_temp.presenca(p_aula text, p_aluno text, p_status public.attendance_status default 'present')
returns void language sql as $$
  insert into public.attendance (class_id, user_id, status) values (pg_temp.id(p_aula), pg_temp.id(p_aluno), p_status)
  on conflict (class_id, user_id) do update set status = excluded.status;
$$;

create function pg_temp.declara(p_aula text, p_aluno text, p_quando timestamptz)
returns void language sql as $$
  insert into public.attendance (class_id, user_id, declared_status, declared_at)
  values (pg_temp.id(p_aula), pg_temp.id(p_aluno), 'present', p_quando)
  on conflict (class_id, user_id) do update set declared_status = 'present', declared_at = excluded.declared_at;
$$;

create function pg_temp.troca(p_aluno text, p_de text, p_para text, p_status public.class_swap_status)
returns void language sql as $$
  insert into public.class_swaps (user_id, kind, from_class_id, to_class_id, status, decided_via, decided_at)
  values (pg_temp.id(p_aluno), 'once', pg_temp.id(p_de), pg_temp.id(p_para), p_status,
          case when p_status <> 'pending' then 'review' end,
          case when p_status <> 'pending' then now() end);
$$;

create function pg_temp.cancela(p_aula text) returns void language sql as $$
  update public.classes set cancelled_at = now() where id = pg_temp.id(p_aula);
$$;

-- "esperado/feitas/%" da semana inteira.
create function pg_temp.semana(p_aluno text, p_segunda date, p_ref timestamptz default '2031-01-01 12:00-03')
returns text language sql as $$
  select f.expected || '/' || f.attended || '/' || coalesce(f.frequency_percent::text, '—')
    from public.frequencia_semanal(array[pg_temp.id(p_aluno)], p_segunda, p_segunda, p_ref) f;
$$;

-- "esperado/feitas" da parte da semana que vai para o mês.
create function pg_temp.parte(p_aluno text, p_mes date, p_segunda date, p_ref timestamptz default '2031-01-01 12:00-03')
returns text language sql as $$
  select coalesce(
    (select s.expected_in_month || '/' || s.attended_in_month
       from public.semanas_do_mes(pg_temp.id(p_aluno), p_mes, p_ref) s
      where s.week_start = p_segunda),
    'fora do mês');
$$;

-- "esperado/feitas/%" do mês.
create function pg_temp.mes(p_aluno text, p_mes date, p_ref timestamptz default '2031-01-01 12:00-03')
returns text language sql as $$
  select f.expected || '/' || f.attended || '/' || coalesce(f.frequency_percent::text, '—')
    from public.frequencia_do_mes(array[pg_temp.id(p_aluno)], p_mes, p_ref) f;
$$;

create function pg_temp.confere(p_caso text, p_obtido text, p_esperado text) returns void language plpgsql as $$
begin
  if p_obtido is distinct from p_esperado then
    raise exception 'FALHOU %: veio %, esperava %', p_caso, coalesce(p_obtido, 'nulo'), p_esperado;
  end if;
  raise notice 'OK %: %', p_caso, p_esperado;
end $$;

-- Planos do cenário.
insert into public.plans (name, price_cents, schedule_mode, weekly_quota) values
  ('F5 Livre 2x', 10000, 'free', 2),
  ('F5 Livre 3x', 10000, 'free', 3),
  ('F5 À vontade', 10000, 'unlimited', null),
  ('F5 Fixo', 10000, 'fixed', null);
insert into ids select 'livre2', id from public.plans where name = 'F5 Livre 2x';
insert into ids select 'livre3', id from public.plans where name = 'F5 Livre 3x';
insert into ids select 'avontade', id from public.plans where name = 'F5 À vontade';
insert into ids select 'fixo', id from public.plans where name = 'F5 Fixo';

-- =====================================================================
-- Calendário (T2): semana, Semana Extra e closes_on
-- =====================================================================
do $$
begin
  perform pg_temp.confere('C1 setembro/2026 fecha no domingo da Semana Extra',
    public.fim_do_mes_de_frequencia('2026-09-01')::text, '2026-10-04');
  perform pg_temp.confere('C2 fevereiro/2027 termina no domingo 28',
    public.fim_do_mes_de_frequencia('2027-02-01')::text, '2027-02-28');
  perform pg_temp.confere('C3 a semana de 28/09/2026 é Semana Extra',
    (select s.mes_inicial || ' ' || s.mes_final from public.meses_da_semana('2026-09-28') s),
    '2026-09-01 2026-10-01');
end $$;

-- =====================================================================
-- FA — o exemplo do dono (D8): livre 2x, fevereiro/2027 com 4 semanas
-- =====================================================================
-- Quatro aulas "só livres" por semana (seg a qui, 10h), todas com chamada.
select pg_temp.aula('fev-' || to_char(d, 'DD'), null, (d::date + time '10:00') at time zone 'America/Sao_Paulo', 'free')
  from generate_series(date '2027-02-01', date '2027-02-25', interval '1 day') as d
 where extract(isodow from d) between 1 and 4;

select pg_temp.aluno('dono');
select pg_temp.no_plano('dono', 'livre2', '2027-01-01 00:00-03');

do $$
begin
  perform pg_temp.presenca('fev-01', 'dono');
  perform pg_temp.presenca('fev-02', 'dono');
  perform pg_temp.presenca('fev-03', 'dono');
  perform pg_temp.confere('FA S1 (3 feitas)', pg_temp.semana('dono', '2027-02-01'), '2/3/150.00');
  perform pg_temp.confere('FA mês depois da S1', pg_temp.mes('dono', '2027-02-01'), '8/3/37.50');

  perform pg_temp.presenca('fev-08', 'dono');
  perform pg_temp.confere('FA S2 (1 feita)', pg_temp.semana('dono', '2027-02-08'), '2/1/50.00');
  perform pg_temp.confere('FA mês depois da S2', pg_temp.mes('dono', '2027-02-01'), '8/4/50.00');

  perform pg_temp.confere('FA S3 (nenhuma)', pg_temp.semana('dono', '2027-02-15'), '2/0/0.00');
  perform pg_temp.confere('FA mês depois da S3', pg_temp.mes('dono', '2027-02-01'), '8/4/50.00');

  perform pg_temp.presenca('fev-22', 'dono');
  perform pg_temp.presenca('fev-23', 'dono');
  perform pg_temp.presenca('fev-24', 'dono');
  perform pg_temp.presenca('fev-25', 'dono');
  perform pg_temp.confere('FA S4 (4 feitas)', pg_temp.semana('dono', '2027-02-22'), '2/4/200.00');
  perform pg_temp.confere('FA mês depois da S4', pg_temp.mes('dono', '2027-02-01'), '8/8/100.00');
end $$;

-- Ritmo (T10) e o legado (§ 15).
do $$
declare v record;
begin
  select * into v from public.frequencia_do_mes(array[pg_temp.id('dono')], '2027-02-01', '2027-02-15 10:00-03');
  perform pg_temp.confere('FA ritmo em 15/02 (S1 e S2 terminadas; S3 em curso sem presença)',
    v.expected_to_date || '/' || v.attended_to_date || ' ' || v.schedule_mode || ' ' || v.is_closed, '4/4 free false');

  select * into v from public.frequencia_mensal(array[pg_temp.id('dono')], '2027-02-15 10:00-03');
  perform pg_temp.confere('FA legado: total = esperado do mês; counted = ritmo; % pelo ritmo',
    v.total_classes || '/' || v.counted_classes || '/' || v.attended || '/' || v.justified || '/' || v.frequency_percent,
    '8/4/4/0/100.00');

  select * into v from public.frequencia_mensal(array[pg_temp.id('dono')], '2027-02-01 09:00-03');
  perform pg_temp.confere('FA legado com esperado até agora 0 dá 100',
    v.counted_classes || '/' || v.frequency_percent, '0/100.00');
end $$;

-- =====================================================================
-- FB — Semana Extra (D10), plano 2x salvo quando dito
-- =====================================================================
-- seg–ter em agosto/2027 e qua–sáb em setembro: semana de 30/08/2027.
select pg_temp.aula('se1-' || to_char(d, 'DD'), null, (d::date + time '10:00') at time zone 'America/Sao_Paulo', 'free')
  from generate_series(date '2027-08-30', date '2027-09-04', interval '1 day') as d;
-- seg–qui em setembro/2027 e sex–sáb em outubro: semana de 27/09/2027.
select pg_temp.aula('se2-' || to_char(d, 'DD'), null, (d::date + time '10:00') at time zone 'America/Sao_Paulo', 'free')
  from generate_series(date '2027-09-27', date '2027-10-02', interval '1 day') as d;

do $$
declare c text;
begin
  foreach c in array array['se-a', 'se-b', 'se-c', 'se-d', 'se-e', 'se-extra'] loop
    perform pg_temp.aluno(c);
    perform pg_temp.no_plano(c, case when c = 'se-e' then 'livre3' else 'livre2' end, '2027-01-01 00:00-03');
  end loop;

  -- foi qua e qui
  perform pg_temp.presenca('se1-01', 'se-a');
  perform pg_temp.presenca('se1-02', 'se-a');
  perform pg_temp.confere('FB1 foi qua e qui: agosto', pg_temp.parte('se-a', '2027-08-01', '2027-08-30'), '0/0');
  perform pg_temp.confere('FB1 foi qua e qui: setembro', pg_temp.parte('se-a', '2027-09-01', '2027-08-30'), '2/2');

  -- 1 em cada mês
  perform pg_temp.presenca('se1-31', 'se-b');
  perform pg_temp.presenca('se1-01', 'se-b');
  perform pg_temp.confere('FB2 uma em cada mês: agosto', pg_temp.parte('se-b', '2027-08-01', '2027-08-30'), '1/1');
  perform pg_temp.confere('FB2 uma em cada mês: setembro', pg_temp.parte('se-b', '2027-09-01', '2027-08-30'), '1/1');

  -- nenhuma vez
  perform pg_temp.confere('FB3 nenhuma vez: agosto', pg_temp.parte('se-c', '2027-08-01', '2027-08-30'), '1/0');
  perform pg_temp.confere('FB3 nenhuma vez: setembro', pg_temp.parte('se-c', '2027-09-01', '2027-08-30'), '1/0');

  -- seg–qui / sex–sáb, foi só na segunda: a sobra ímpar vai para M2
  perform pg_temp.presenca('se2-27', 'se-d');
  perform pg_temp.confere('FB4 só na segunda: setembro', pg_temp.parte('se-d', '2027-09-01', '2027-09-27'), '1/1');
  perform pg_temp.confere('FB4 só na segunda: outubro (sobra ímpar)', pg_temp.parte('se-d', '2027-10-01', '2027-09-27'), '1/0');

  -- plano 3x, nenhuma vez
  perform pg_temp.confere('FB5 3x sem ir: agosto', pg_temp.parte('se-e', '2027-08-01', '2027-08-30'), '1/0');
  perform pg_temp.confere('FB5 3x sem ir: setembro', pg_temp.parte('se-e', '2027-09-01', '2027-08-30'), '2/0');

  -- Caso-limite: presença extra dentro da Semana Extra (foi seg, ter e qua).
  perform pg_temp.presenca('se1-30', 'se-extra');
  perform pg_temp.presenca('se1-31', 'se-extra');
  perform pg_temp.presenca('se1-01', 'se-extra');
  perform pg_temp.confere('FB6 presença extra: agosto fica com as 2 vagas', pg_temp.parte('se-extra', '2027-08-01', '2027-08-30'), '2/2');
  perform pg_temp.confere('FB6 presença extra: setembro conta a mais', pg_temp.parte('se-extra', '2027-09-01', '2027-08-30'), '0/1');
  perform pg_temp.confere('FB6 presença extra: a semana', pg_temp.semana('se-extra', '2027-08-30'), '2/3/150.00');
end $$;

-- =====================================================================
-- FC — casos-limite da § 11.5
-- =====================================================================
do $$
begin
  -- Justificativa aprovada numa semana já cumprida: o percentual não muda (T17).
  perform pg_temp.aluno('cumpriu');
  perform pg_temp.no_plano('cumpriu', 'livre2', '2027-01-01 00:00-03');
  perform pg_temp.presenca('fev-01', 'cumpriu');
  perform pg_temp.presenca('fev-02', 'cumpriu');
  insert into public.absence_justifications (user_id, scope, week_start, message, status, reviewed_at)
  values (pg_temp.id('cumpriu'), 'week', '2027-02-01', 'Viagem', 'approved', now());
  perform pg_temp.confere('FC1 justificativa em semana cumprida', pg_temp.semana('cumpriu', '2027-02-01'), '2/2/100.00');

  -- E numa semana em que faltou: o abono cobre o que faltou.
  perform pg_temp.presenca('fev-08', 'cumpriu');
  insert into public.absence_justifications (user_id, scope, week_start, message, status, reviewed_at)
  values (pg_temp.id('cumpriu'), 'week', '2027-02-08', 'Atestado', 'approved', now());
  perform pg_temp.confere('FC1b justificativa em semana com falta', pg_temp.semana('cumpriu', '2027-02-08'), '1/1/100.00');

  -- Semana de feriado sem aula livre: esperado 0, "—".
  perform pg_temp.confere('FC2 semana sem aula livre', pg_temp.semana('dono', '2027-03-22'), '0/0/—');

  -- Aluno novo cadastrado na terça, livre 3x: cota proporcional ⌊3 × 5 ÷ 6⌋ = 2 (T8).
  perform pg_temp.aluno('novo', '2027-02-09 10:00-03');
  perform pg_temp.no_plano('novo', 'livre3', '2027-02-09 10:00-03');
  perform pg_temp.presenca('fev-10', 'novo');
  perform pg_temp.presenca('fev-11', 'novo');
  perform pg_temp.confere('FC3 aluno novo na terça não dá 150%', pg_temp.semana('novo', '2027-02-08'), '2/2/100.00');
end $$;

-- T30 com oferta parcial, a extra "só livres" e o fixo incluído em outra
-- turma usam a semana de 08/03/2027 (montada em FD).

-- =====================================================================
-- FE — Histórico de turma (D58, T51–T53), fevereiro/2027
-- Noite: seg e qua, 19h. Manhã: ter e qui, 7h. Todas com chamada.
-- =====================================================================
select pg_temp.grupo('f5-noite');
select pg_temp.grupo('f5-manha');
select pg_temp.grupo('f5-outra');
select pg_temp.aula('noite-' || to_char(d, 'DD'), 'f5-noite', (d::date + time '19:00') at time zone 'America/Sao_Paulo')
  from generate_series(date '2027-02-01', date '2027-02-24', interval '1 day') as d
 where extract(isodow from d) in (1, 3);
select pg_temp.aula('manha-' || to_char(d, 'DD'), 'f5-manha', (d::date + time '07:00') at time zone 'America/Sao_Paulo')
  from generate_series(date '2027-02-01', date '2027-02-25', interval '1 day') as d
 where extract(isodow from d) in (2, 4);
select pg_temp.aula('outra-13', 'f5-outra', '2027-02-13 10:00-03');
select pg_temp.aula('outra-19', 'f5-outra', '2027-02-19 19:00-03');

do $$
declare
  d text;
  v record;
begin
  -- H1: mudança na seg 15/02 às 12h; foi a todas.
  perform pg_temp.aluno('h1');
  perform pg_temp.na_turma('h1', 'f5-noite', '2026-01-01 10:00-03', '2027-02-15 12:00-03');
  perform pg_temp.na_turma('h1', 'f5-manha', '2027-02-15 12:00-03');
  foreach d in array array['noite-01', 'noite-03', 'noite-08', 'noite-10', 'manha-16', 'manha-18', 'manha-23', 'manha-25'] loop
    perform pg_temp.presenca(d, 'h1');
  end loop;
  perform pg_temp.confere('H1 mudança em 15/02, foi a todas', pg_temp.mes('h1', '2027-02-01'), '8/8/100.00');
  select * into v from public.frequencia_do_mes(array[pg_temp.id('h1')], '2027-02-01', '2027-02-16 12:00-03');
  perform pg_temp.confere('H1 ritmo do fixo só com chamada concluída', v.expected_to_date || '/' || v.attended_to_date, '5/5');

  -- H2: a mesma mudança; faltou às 4 da Noite e foi às 4 da Manhã.
  perform pg_temp.aluno('h2');
  perform pg_temp.na_turma('h2', 'f5-noite', '2026-01-01 10:00-03', '2027-02-15 12:00-03');
  perform pg_temp.na_turma('h2', 'f5-manha', '2027-02-15 12:00-03');
  foreach d in array array['noite-01', 'noite-03', 'noite-08', 'noite-10'] loop
    perform pg_temp.presenca(d, 'h2', 'absent');
  end loop;
  foreach d in array array['manha-16', 'manha-18', 'manha-23', 'manha-25'] loop
    perform pg_temp.presenca(d, 'h2');
  end loop;
  perform pg_temp.confere('H2 o mês não recomeça', pg_temp.mes('h2', '2027-02-01'), '8/4/50.00');

  -- H3: mudança na qua 10/02 às 21h, depois da aula da Noite; foi a todas.
  perform pg_temp.aluno('h3');
  perform pg_temp.na_turma('h3', 'f5-noite', '2026-01-01 10:00-03', '2027-02-10 21:00-03');
  perform pg_temp.na_turma('h3', 'f5-manha', '2027-02-10 21:00-03');
  foreach d in array array['noite-01', 'noite-03', 'noite-08', 'noite-10', 'manha-11', 'manha-16', 'manha-18', 'manha-23', 'manha-25'] loop
    perform pg_temp.presenca(d, 'h3');
  end loop;
  perform pg_temp.confere('H3 mudança em 10/02 às 21h', pg_temp.mes('h3', '2027-02-01'), '9/9/100.00');
  perform pg_temp.confere('H3 a S2 tem 3 aulas', pg_temp.semana('h3', '2027-02-08'), '3/3/100.00');

  -- H4: mudança em 15/02; foi a todas e ainda foi incluído na Manhã de ter 02/02.
  perform pg_temp.aluno('h4');
  perform pg_temp.na_turma('h4', 'f5-noite', '2026-01-01 10:00-03', '2027-02-15 12:00-03');
  perform pg_temp.na_turma('h4', 'f5-manha', '2027-02-15 12:00-03');
  foreach d in array array['manha-02', 'noite-01', 'noite-03', 'noite-08', 'noite-10', 'manha-16', 'manha-18', 'manha-23', 'manha-25'] loop
    perform pg_temp.presenca(d, 'h4');
  end loop;
  perform pg_temp.confere('H4 presença antes da mudança conta a mais', pg_temp.mes('h4', '2027-02-01'), '8/9/112.50');

  -- H5: mudança para sem turma em 15/02; foi a todas da Noite.
  perform pg_temp.aluno('h5');
  perform pg_temp.na_turma('h5', 'f5-noite', '2026-01-01 10:00-03', '2027-02-15 12:00-03');
  foreach d in array array['noite-01', 'noite-03', 'noite-08', 'noite-10'] loop
    perform pg_temp.presenca(d, 'h5');
  end loop;
  perform pg_temp.confere('H5 mudança para sem turma', pg_temp.mes('h5', '2027-02-01'), '4/4/100.00');

  -- H6: avulsa qua 17 (Noite) → sex 19 (outra turma) aprovada em 12/02; a
  -- mudança de 15/02 a cancela (T53: a original ainda não tinha começado).
  perform pg_temp.aluno('h6');
  perform pg_temp.na_turma('h6', 'f5-noite', '2026-01-01 10:00-03', '2027-02-15 12:00-03');
  perform pg_temp.na_turma('h6', 'f5-manha', '2027-02-15 12:00-03');
  perform pg_temp.troca('h6', 'noite-17', 'outra-19', 'cancelled');
  perform pg_temp.presenca('manha-16', 'h6');
  perform pg_temp.presenca('manha-18', 'h6');
  perform pg_temp.confere('H6 troca cancelada pela mudança', pg_temp.semana('h6', '2027-02-15'), '2/2/100.00');

  -- H7: reposição qua 10 → sáb 13 aprovada; mudança na sex 12/02 às 12h; a
  -- original já tinha passado, e a troca segue (T53).
  perform pg_temp.aluno('h7');
  perform pg_temp.na_turma('h7', 'f5-noite', '2026-01-01 10:00-03', '2027-02-12 12:00-03');
  perform pg_temp.na_turma('h7', 'f5-manha', '2027-02-12 12:00-03');
  perform pg_temp.presenca('noite-10', 'h7', 'absent');
  perform pg_temp.troca('h7', 'noite-10', 'outra-13', 'approved');
  perform pg_temp.presenca('noite-08', 'h7');
  perform pg_temp.presenca('outra-13', 'h7');
  perform pg_temp.confere('H7 reposição segue depois da mudança', pg_temp.semana('h7', '2027-02-08'), '2/2/100.00');
end $$;

-- Mês com troca de modalidade (T3): fixo na Noite nas S1 e S2, livre 2x a
-- partir de seg 15/02 00:00 (as aulas "só livres" de fevereiro são a oferta).
do $$
declare d text;
begin
  perform pg_temp.aluno('modal');
  perform pg_temp.na_turma('modal', 'f5-noite', '2026-01-01 10:00-03');
  perform pg_temp.no_plano('modal', 'fixo', '2026-01-01 10:00-03', '2027-02-15 00:00-03');
  perform pg_temp.no_plano('modal', 'livre2', '2027-02-15 00:00-03');
  foreach d in array array['noite-01', 'noite-03', 'noite-08', 'noite-10', 'fev-15', 'fev-22'] loop
    perform pg_temp.presenca(d, 'modal');
  end loop;
  -- 4 da Noite (fixo) + 2 + 2 (livre) = 8 esperadas; 6 feitas. As aulas da
  -- Noite de 15, 17, 22 e 24 não são dele: a semana já é livre.
  perform pg_temp.confere('FC4 mês com troca de modalidade', pg_temp.mes('modal', '2027-02-01'), '8/6/75.00');
  perform pg_temp.confere('FC4 a modalidade devolvida é a da última semana',
    (select f.schedule_mode::text from public.frequencia_do_mes(array[pg_temp.id('modal')], '2027-02-01', '2027-03-10 12:00-03') f),
    'free');
end $$;

-- =====================================================================
-- FD — Trocas e extra (v3): fixo com qua e sex, semana de 08/03/2027
-- Cada caso tem a sua turma, para cancelar aula sem mexer nos outros.
-- =====================================================================
create function pg_temp.caso(p_caso text) returns void language plpgsql as $$
begin
  perform pg_temp.grupo('f5-' || p_caso);
  perform pg_temp.aluno(p_caso);
  perform pg_temp.na_turma(p_caso, 'f5-' || p_caso, '2026-01-01 10:00-03');
  -- A grade dele: qua 10/03 e sex 12/03, 19h.
  perform pg_temp.aula(p_caso || '-qua', 'f5-' || p_caso, '2027-03-10 19:00-03');
  perform pg_temp.aula(p_caso || '-sex', 'f5-' || p_caso, '2027-03-12 19:00-03');
  -- Aulas de outra turma para a extra e as trocas: seg, ter, qui e sáb.
  perform pg_temp.aula(p_caso || '-seg', 'f5-outra', '2027-03-08 19:00-03');
  perform pg_temp.aula(p_caso || '-ter', 'f5-outra', '2027-03-09 19:00-03');
  perform pg_temp.aula(p_caso || '-qui', 'f5-outra', '2027-03-11 19:00-03');
  perform pg_temp.aula(p_caso || '-sab', 'f5-outra', '2027-03-13 10:00-03');
end $$;

do $$
begin
  -- 1. extra na terça, foi às três (também: fixo incluído em outra turma, 150%)
  perform pg_temp.caso('t01');
  perform pg_temp.declara('t01-ter', 't01', '2027-03-01 10:00-03');
  perform pg_temp.presenca('t01-ter', 't01');
  perform pg_temp.presenca('t01-qua', 't01');
  perform pg_temp.presenca('t01-sex', 't01');
  perform pg_temp.confere('T01 extra na terça, foi às três', pg_temp.semana('t01', '2027-03-08'), '2/3/150.00');

  -- 2. extra marcada e não foi; foi qua e sex
  perform pg_temp.caso('t02');
  perform pg_temp.declara('t02-ter', 't02', '2027-03-01 10:00-03');
  perform pg_temp.presenca('t02-ter', 't02', 'absent');
  perform pg_temp.presenca('t02-qua', 't02');
  perform pg_temp.presenca('t02-sex', 't02');
  perform pg_temp.confere('T02 extra marcada e não foi', pg_temp.semana('t02', '2027-03-08'), '2/2/100.00');

  -- 3. avulsa qua → qui aprovada; foi qui e sex
  perform pg_temp.caso('t03');
  perform pg_temp.troca('t03', 't03-qua', 't03-qui', 'approved');
  perform pg_temp.presenca('t03-qui', 't03');
  perform pg_temp.presenca('t03-sex', 't03');
  perform pg_temp.confere('T03 avulsa aprovada, foi', pg_temp.semana('t03', '2027-03-08'), '2/2/100.00');

  -- 4. avulsa qua → qui aprovada; não foi à qui
  perform pg_temp.caso('t04');
  perform pg_temp.troca('t04', 't04-qua', 't04-qui', 'approved');
  perform pg_temp.presenca('t04-qui', 't04', 'absent');
  perform pg_temp.presenca('t04-sex', 't04');
  perform pg_temp.confere('T04 avulsa aprovada, a falta é na qui', pg_temp.semana('t04', '2027-03-08'), '2/1/50.00');

  -- 5. reposição: faltou na qua, qua → sáb aprovada e foi
  perform pg_temp.caso('t05');
  perform pg_temp.presenca('t05-qua', 't05', 'absent');
  perform pg_temp.troca('t05', 't05-qua', 't05-sab', 'approved');
  perform pg_temp.presenca('t05-sab', 't05');
  perform pg_temp.presenca('t05-sex', 't05');
  perform pg_temp.confere('T05 reposição', pg_temp.semana('t05', '2027-03-08'), '2/2/100.00');

  -- 6. avulsa pendente que expirou na chamada da qui; faltou na qua
  perform pg_temp.caso('t06');
  perform pg_temp.troca('t06', 't06-qua', 't06-qui', 'expired');
  perform pg_temp.presenca('t06-qua', 't06', 'absent');
  perform pg_temp.presenca('t06-sex', 't06');
  perform pg_temp.confere('T06 troca expirada: vale a original', pg_temp.semana('t06', '2027-03-08'), '2/1/50.00');

  -- 7. troca pendente para a qui, foi à qua (a presença a cancela) e à sex
  perform pg_temp.caso('t07');
  perform pg_temp.troca('t07', 't07-qua', 't07-qui', 'cancelled');
  perform pg_temp.presenca('t07-qua', 't07');
  perform pg_temp.presenca('t07-sex', 't07');
  perform pg_temp.confere('T07 troca cancelada pela presença na original', pg_temp.semana('t07', '2027-03-08'), '2/2/100.00');
end $$;

-- 8 e 9. Troca permanente (T37): precisa dos horários.
do $$
begin
  perform pg_temp.grupo('f5-t08');
  perform pg_temp.aluno('t08');
  perform pg_temp.na_turma('t08', 'f5-t08', '2026-01-01 10:00-03');
  perform pg_temp.horario('t08-h-qua', 'f5-t08');
  perform pg_temp.horario('t08-h-sab', 'f5-outra');
  perform pg_temp.aula('t08-qua', 'f5-t08', '2027-03-10 19:00-03', 'fixed', true, pg_temp.id('t08-h-qua'));
  perform pg_temp.aula('t08-sex', 'f5-t08', '2027-03-12 19:00-03');
  perform pg_temp.aula('t08-sab', 'f5-outra', '2027-03-13 10:00-03', 'fixed', true, pg_temp.id('t08-h-sab'));
  perform pg_temp.aula('t08-qua2', 'f5-t08', '2027-03-17 19:00-03', 'fixed', true, pg_temp.id('t08-h-qua'));
  perform pg_temp.aula('t08-sex2', 'f5-t08', '2027-03-19 19:00-03');
  perform pg_temp.aula('t08-sab2', 'f5-outra', '2027-03-20 10:00-03', 'fixed', true, pg_temp.id('t08-h-sab'));
  -- Aprovada na quinta 11/03: a qua já passou e fica; o sáb entra.
  insert into public.class_swap_periods (user_id, from_schedule_id, to_schedule_id, started_at)
  values (pg_temp.id('t08'), pg_temp.id('t08-h-qua'), pg_temp.id('t08-h-sab'), '2027-03-11 15:00-03');
  perform pg_temp.confere('T08 permanente aprovada na quinta: semana de transição',
    split_part(pg_temp.semana('t08', '2027-03-08'), '/', 1), '3');
  perform pg_temp.confere('T08 da semana seguinte em diante: sex e sáb',
    split_part(pg_temp.semana('t08', '2027-03-15'), '/', 1), '2');

  perform pg_temp.grupo('f5-t09');
  perform pg_temp.aluno('t09');
  perform pg_temp.na_turma('t09', 'f5-t09', '2026-01-01 10:00-03');
  perform pg_temp.horario('t09-h-qua', 'f5-t09');
  perform pg_temp.horario('t09-h-seg', 'f5-outra');
  perform pg_temp.aula('t09-seg', 'f5-outra', '2027-03-08 19:00-03', 'fixed', true, pg_temp.id('t09-h-seg'));
  perform pg_temp.aula('t09-qua', 'f5-t09', '2027-03-10 19:00-03', 'fixed', true, pg_temp.id('t09-h-qua'));
  perform pg_temp.aula('t09-sex', 'f5-t09', '2027-03-12 19:00-03');
  -- Aprovada na terça 09/03: a seg já passou; a qua sai.
  insert into public.class_swap_periods (user_id, from_schedule_id, to_schedule_id, started_at)
  values (pg_temp.id('t09'), pg_temp.id('t09-h-qua'), pg_temp.id('t09-h-seg'), '2027-03-09 15:00-03');
  perform pg_temp.confere('T09 permanente aprovada na terça: só a sex',
    split_part(pg_temp.semana('t09', '2027-03-08'), '/', 1), '1');
end $$;

do $$
begin
  -- 10. avulsa qua → qui aprovada; depois a qui é cancelada; foi à sex
  perform pg_temp.caso('t10');
  perform pg_temp.troca('t10', 't10-qua', 't10-qui', 'approved');
  perform pg_temp.cancela('t10-qui');
  perform pg_temp.presenca('t10-sex', 't10');
  perform pg_temp.confere('T10 aula nova cancelada: vaga abonada', pg_temp.semana('t10', '2027-03-08'), '1/1/100.00');

  -- 11. avulsa qua → qui aprovada; depois a qua é cancelada; foi à qui e à sex
  perform pg_temp.caso('t11');
  perform pg_temp.troca('t11', 't11-qua', 't11-qui', 'approved');
  perform pg_temp.cancela('t11-qua');
  perform pg_temp.presenca('t11-qui', 't11');
  perform pg_temp.presenca('t11-sex', 't11');
  perform pg_temp.confere('T11 original cancelada: sem abono', pg_temp.semana('t11', '2027-03-08'), '2/2/100.00');

  -- 12. reposição pendente qua → sáb (faltou na qua); o sáb é cancelado; foi
  -- à sex. A qua já passou: aprovada pelo sistema e abonada (T50).
  perform pg_temp.caso('t12');
  perform pg_temp.presenca('t12-qua', 't12', 'absent');
  perform pg_temp.troca('t12', 't12-qua', 't12-sab', 'approved');
  update public.class_swaps set decided_via = 'system' where user_id = pg_temp.id('t12');
  perform pg_temp.cancela('t12-sab');
  perform pg_temp.presenca('t12-sex', 't12');
  perform pg_temp.confere('T12 reposição pendente e sáb cancelado (T50)', pg_temp.semana('t12', '2027-03-08'), '1/1/100.00');

  -- 13. reposição aprovada qua → sáb; o sáb é cancelado antes da aula; foi à sex (D57)
  perform pg_temp.caso('t13');
  perform pg_temp.presenca('t13-qua', 't13', 'absent');
  perform pg_temp.troca('t13', 't13-qua', 't13-sab', 'approved');
  perform pg_temp.cancela('t13-sab');
  perform pg_temp.presenca('t13-sex', 't13');
  perform pg_temp.confere('T13 reposição aprovada e sáb cancelado (D57)', pg_temp.semana('t13', '2027-03-08'), '1/1/100.00');

  -- 14. avulsa pendente qua → sáb; o sáb é cancelado na terça: a troca é
  -- cancelada e vale a qua (T50); foi à qua e à sex
  perform pg_temp.caso('t14');
  perform pg_temp.troca('t14', 't14-qua', 't14-sab', 'cancelled');
  perform pg_temp.cancela('t14-sab');
  perform pg_temp.presenca('t14-qua', 't14');
  perform pg_temp.presenca('t14-sex', 't14');
  perform pg_temp.confere('T14 destino cancelado antes da original', pg_temp.semana('t14', '2027-03-08'), '2/2/100.00');

  -- 15. avulsa pendente qua → sáb; não foi à qua; o sáb é cancelado na sexta:
  -- aprovada pelo sistema e abonada (T50); foi à sex
  perform pg_temp.caso('t15');
  perform pg_temp.troca('t15', 't15-qua', 't15-sab', 'approved');
  update public.class_swaps set decided_via = 'system' where user_id = pg_temp.id('t15');
  perform pg_temp.cancela('t15-sab');
  perform pg_temp.presenca('t15-sex', 't15');
  perform pg_temp.confere('T15 destino cancelado depois da original', pg_temp.semana('t15', '2027-03-08'), '1/1/100.00');

  -- 16. reposição aprovada qua → sáb; o sáb é cancelado e reativado; foi à
  -- sex e não foi ao sáb: reativar desfaz o abono (T36)
  perform pg_temp.caso('t16');
  perform pg_temp.presenca('t16-qua', 't16', 'absent');
  perform pg_temp.troca('t16', 't16-qua', 't16-sab', 'approved');
  perform pg_temp.cancela('t16-sab');
  update public.classes set cancelled_at = null where id = pg_temp.id('t16-sab');
  perform pg_temp.presenca('t16-sex', 't16');
  perform pg_temp.presenca('t16-sab', 't16', 'absent');
  perform pg_temp.confere('T16 reativada: a falta é no sáb', pg_temp.semana('t16', '2027-03-08'), '2/1/50.00');

  -- 17. reposição pendente qua → sáb; cancelado e reativado (volta a
  -- pendente); foi à sex e ao sáb, e a chamada do sáb a aprovou (D48)
  perform pg_temp.caso('t17');
  perform pg_temp.presenca('t17-qua', 't17', 'absent');
  perform pg_temp.troca('t17', 't17-qua', 't17-sab', 'approved');
  update public.class_swaps set decided_via = 'roll_call' where user_id = pg_temp.id('t17');
  perform pg_temp.presenca('t17-sex', 't17');
  perform pg_temp.presenca('t17-sab', 't17');
  perform pg_temp.confere('T17 a chamada aprovou a troca', pg_temp.semana('t17', '2027-03-08'), '2/2/100.00');

  -- 18. a mesma, mas foi só à sex: a chamada do sáb expira a troca
  perform pg_temp.caso('t18');
  perform pg_temp.presenca('t18-qua', 't18', 'absent');
  perform pg_temp.troca('t18', 't18-qua', 't18-sab', 'expired');
  perform pg_temp.presenca('t18-sex', 't18');
  perform pg_temp.confere('T18 a chamada expirou a troca: vale a original', pg_temp.semana('t18', '2027-03-08'), '2/1/50.00');

  -- 19. extra numa aula "só livres" da terça; foi às três (D56)
  perform pg_temp.caso('t19');
  perform pg_temp.aula('t19-livres', null, '2027-03-09 07:00-03', 'free');
  perform pg_temp.presenca('t19-livres', 't19');
  perform pg_temp.presenca('t19-qua', 't19');
  perform pg_temp.presenca('t19-sex', 't19');
  perform pg_temp.confere('T19 extra em aula só livres', pg_temp.semana('t19', '2027-03-08'), '2/3/150.00');

  -- 20. aula nova antes da original: avulsa sex → qui aprovada pela chamada;
  -- foi à qua
  perform pg_temp.caso('t20');
  perform pg_temp.troca('t20', 't20-sex', 't20-qui', 'approved');
  perform pg_temp.presenca('t20-qui', 't20');
  perform pg_temp.presenca('t20-qua', 't20');
  perform pg_temp.confere('T20 aula nova antes da original', pg_temp.semana('t20', '2027-03-08'), '2/2/100.00');

  -- 21. avulsa qua → qui expirada; faltou na qua; foi à sex; a retificação
  -- marca presença na qui e a troca volta a aprovada (T35)
  perform pg_temp.caso('t21');
  perform pg_temp.troca('t21', 't21-qua', 't21-qui', 'approved');
  perform pg_temp.presenca('t21-qua', 't21', 'absent');
  perform pg_temp.presenca('t21-qui', 't21');
  perform pg_temp.presenca('t21-sex', 't21');
  perform pg_temp.confere('T21 retificação devolve a troca a aprovada', pg_temp.semana('t21', '2027-03-08'), '2/2/100.00');

  -- 22. a mesma, mas antes ele fez a reposição qua → sáb (aprovada): a
  -- qua → qui continua expirada, e a presença na qui conta a mais (T35)
  perform pg_temp.caso('t22');
  perform pg_temp.troca('t22', 't22-qua', 't22-qui', 'expired');
  perform pg_temp.presenca('t22-qua', 't22', 'absent');
  perform pg_temp.troca('t22', 't22-qua', 't22-sab', 'approved');
  perform pg_temp.presenca('t22-qui', 't22');
  perform pg_temp.presenca('t22-sex', 't22');
  perform pg_temp.presenca('t22-sab', 't22');
  perform pg_temp.confere('T22 presença na qui conta a mais', pg_temp.semana('t22', '2027-03-08'), '2/3/150.00');

  -- 23. avulsa qua → qui aprovada pela chamada; a retificação tira a presença
  -- da qui e a troca volta a expirada; faltou na qua; foi à sex
  perform pg_temp.caso('t23');
  perform pg_temp.troca('t23', 't23-qua', 't23-qui', 'expired');
  perform pg_temp.presenca('t23-qui', 't23', 'absent');
  perform pg_temp.presenca('t23-qua', 't23', 'absent');
  perform pg_temp.presenca('t23-sex', 't23');
  perform pg_temp.confere('T23 retificação devolve a troca a expirada', pg_temp.semana('t23', '2027-03-08'), '2/1/50.00');

  -- 24. extra na terça, que é cancelada; foi à qua e à sex
  perform pg_temp.caso('t24');
  perform pg_temp.declara('t24-ter', 't24', '2027-03-01 10:00-03');
  perform pg_temp.cancela('t24-ter');
  perform pg_temp.presenca('t24-qua', 't24');
  perform pg_temp.presenca('t24-sex', 't24');
  perform pg_temp.confere('T24 extra cancelada não muda nada', pg_temp.semana('t24', '2027-03-08'), '2/2/100.00');

  -- T30 com oferta parcial: livre 2x numa semana com uma só aula que aceita
  -- livres (a "só livres" do T19), e ele foi a ela.
  perform pg_temp.aluno('oferta');
  perform pg_temp.no_plano('oferta', 'livre2', '2027-01-01 00:00-03');
  perform pg_temp.presenca('t19-livres', 'oferta');
  perform pg_temp.confere('FC5 T30 oferta parcial', pg_temp.semana('oferta', '2027-03-08'), '1/1/100.00');
end $$;

-- 25. Semana Extra de 2026 (seg 28/09 a dom 04/10): avulsa qua 30/09 → qui
-- 01/10 aprovada; foi à qui e à sex. Cada aula fica no mês da sua data.
do $$
declare v text;
begin
  perform pg_temp.grupo('f5-t25');
  perform pg_temp.aluno('t25');
  perform pg_temp.na_turma('t25', 'f5-t25', '2026-01-01 10:00-03');
  perform pg_temp.aula('t25-qua', 'f5-t25', '2026-09-30 19:00-03');
  perform pg_temp.aula('t25-sex', 'f5-t25', '2026-10-02 19:00-03');
  perform pg_temp.aula('t25-qui', 'f5-outra', '2026-10-01 19:00-03');
  perform pg_temp.troca('t25', 't25-qua', 't25-qui', 'approved');
  perform pg_temp.presenca('t25-qui', 't25');
  perform pg_temp.presenca('t25-sex', 't25');
  perform pg_temp.confere('T25 setembro', pg_temp.parte('t25', '2026-09-01', '2026-09-28'), '0/0');
  perform pg_temp.confere('T25 outubro', pg_temp.parte('t25', '2026-10-01', '2026-09-28'), '2/2');
  perform pg_temp.confere('T25 setembro sem esperado dá "—"', pg_temp.mes('t25', '2026-09-01'), '0/0/—');
  perform pg_temp.confere('T25 outubro', pg_temp.mes('t25', '2026-10-01'), '2/2/100.00');

  select string_agg(s.label, ',' order by s.week_start) into v
    from public.semanas_do_mes(pg_temp.id('t25'), '2026-10-01', '2026-10-10 12:00-03') s;
  perform pg_temp.confere('T25 rótulos de outubro/2026', v, 'Semana extra,S1,S2,S3,S4');
  select string_agg(s.label, ',' order by s.week_start) into v
    from public.semanas_do_mes(pg_temp.id('t25'), '2026-09-01', '2026-10-10 12:00-03') s;
  perform pg_temp.confere('T25 rótulos de setembro/2026', v, 'Semana extra,S1,S2,S3,Semana extra');
  perform pg_temp.confere('T25 setembro só fecha depois de 04/10',
    (select f.closes_on || ' ' || f.is_closed from public.frequencia_do_mes(array[pg_temp.id('t25')], '2026-09-01', '2026-10-04 23:00-03') f),
    '2026-10-04 false');
end $$;

-- =====================================================================
-- FJ — justificativa semanal em semanas_do_mes (só o livre)
-- =====================================================================
do $$
declare v record;
begin
  select * into v from public.semanas_do_mes(pg_temp.id('cumpriu'), '2027-02-01', '2027-02-17 12:00-03') s
   where s.week_start = '2027-02-15';
  perform pg_temp.confere('FJ1 livre na semana em curso pode justificar',
    v.can_justify || ' ' || v.justifications_left || ' ' || (v.justify_until at time zone 'America/Sao_Paulo'),
    'true 2 2027-02-28 00:00:00');

  select * into v from public.semanas_do_mes(pg_temp.id('cumpriu'), '2027-02-01', '2027-02-17 12:00-03') s
   where s.week_start = '2027-02-01';
  perform pg_temp.confere('FJ2 prazo vencido e justificativa aprovada na lista',
    v.can_justify || ' ' || v.justifications_left || ' ' || jsonb_array_length(v.justificativas)
      || ' ' || (v.justificativas -> 0 ->> 'status'), 'false 1 1 approved');

  select * into v from public.semanas_do_mes(pg_temp.id('h1'), '2027-02-01', '2027-02-17 12:00-03') s
   where s.week_start = '2027-02-15';
  perform pg_temp.confere('FJ3 fixo não justifica semana',
    v.can_justify || ' ' || coalesce(v.justifications_left::text, 'nulo'), 'false nulo');
end $$;

-- =====================================================================
-- FF — fechamento (§ 11.6) e recálculo do mês fechado (T31)
-- =====================================================================
do $$
declare
  v record;
  v_erro text;
begin
  begin
    perform public.fechar_frequencia_do_mes('2027-02-01', '2027-02-28 12:00-03');
    raise exception 'FALHOU FF1: fechou fevereiro antes do fim do closes_on';
  exception when sqlstate '22023' then
    raise notice 'OK FF1: o mês só fecha no dia seguinte ao closes_on';
  end;

  perform public.fechar_frequencia_do_mes('2027-02-01', '2027-03-01 00:20-03');
  select * into v from public.attendance_monthly where user_id = pg_temp.id('h1') and reference_month = '2027-02-01';
  perform pg_temp.confere('FF2 linha nova e colunas antigas preenchidas',
    v.group_id || ' ' || v.schedule_mode || ' ' || v.expected || '/' || v.attended || '/' || v.excused || '/' || v.cancelled
      || ' ' || v.total_classes || '/' || v.counted_classes || '/' || v.justified || ' ' || v.frequency_percent,
    'f5-manha fixed 8/8/0/0 8/8/0 100.00');

  select * into v from public.attendance_monthly where user_id = pg_temp.id('h5') and reference_month = '2027-02-01';
  perform pg_temp.confere('FF3 group_id = a turma em que terminou o mês (sem turma: a última)', v.group_id, 'f5-noite');

  select * into v from public.attendance_monthly where user_id = pg_temp.id('dono') and reference_month = '2027-02-01';
  perform pg_temp.confere('FF4 o livre é gravado com a modalidade dele', v.frequency_percent::text || ' ' || v.schedule_mode, '100.00 free');

  -- Sem esperado, sem linha.
  if exists (select 1 from public.attendance_monthly where user_id = pg_temp.id('t25') and reference_month = '2027-02-01') then
    raise exception 'FALHOU FF5: aluno sem esperado no mês ganhou linha';
  end if;
  raise notice 'OK FF5: só quem tem esperado é gravado';
end $$;

-- T31: chamada feita depois do fechamento. Março/2026 já fechou (hoje).
select pg_temp.grupo('f5-t31');
select pg_temp.aluno('t31');
select pg_temp.na_turma('t31', 'f5-t31', '2026-01-01 10:00-03');
select pg_temp.aula('t31-a', 'f5-t31', '2026-03-04 19:00-03');
select pg_temp.aula('t31-b', 'f5-t31', '2026-03-11 19:00-03', 'fixed', false);
select pg_temp.presenca('t31-a', 't31');

do $$
declare v record;
begin
  perform public.fechar_frequencia_do_mes('2026-03-01');
  select * into v from public.attendance_monthly where user_id = pg_temp.id('t31') and reference_month = '2026-03-01';
  perform pg_temp.confere('FF6 fechado com a aula sem chamada no esperado',
    v.expected || '/' || v.attended || ' ' || v.frequency_percent, '2/1 50.00');

  -- A chamada atrasada da segunda aula.
  update public.classes set attendance_taken_at = '2026-03-11 20:00-03' where id = pg_temp.id('t31-b');
  perform pg_temp.presenca('t31-b', 't31');
  if not exists (select 1 from public.attendance_recalc_queue where reference_month = '2026-03-01') then
    raise exception 'FALHOU FF7: a mudança no mês fechado não entrou na fila';
  end if;

  perform public.fechar_frequencia_do_mes();
  select * into v from public.attendance_monthly where user_id = pg_temp.id('t31') and reference_month = '2026-03-01';
  perform pg_temp.confere('FF7 T31 recalcula o mês fechado', v.expected || '/' || v.attended || ' ' || v.frequency_percent, '2/2 100.00');
  if exists (select 1 from public.attendance_recalc_queue where reference_month = '2026-03-01') then
    raise exception 'FALHOU FF7: a fila não foi esvaziada';
  end if;

  -- Mês que ainda não fechou não entra na fila (a conta viva já o mostra).
  perform pg_temp.presenca('t25-qui', 't25', 'absent');
  if exists (select 1 from public.attendance_recalc_queue where reference_month >= '2026-09-01') then
    raise exception 'FALHOU FF8: mês aberto entrou na fila';
  end if;
  perform pg_temp.presenca('t25-qui', 't25');
  raise notice 'OK FF8: só mês fechado entra na fila';

  perform pg_temp.confere('FF9 sem nada a fechar devolve 0', public.fechar_frequencia_do_mes()::text, '0');
  perform pg_temp.confere('FF10 o cron é diário',
    (select schedule from cron.job where jobname = 'close-monthly-attendance'), '20 3 * * *');
end $$;

-- =====================================================================
-- FP — Painel (D55, T10, D35)
-- =====================================================================
select pg_temp.aluno('admin', '2026-01-01 10:00-03', 'admin');
select pg_temp.aluno('p150');
select pg_temp.aluno('p50');
select pg_temp.aluno('pvontade');
select pg_temp.no_plano('pvontade', 'avontade', '2027-01-01 00:00-03');

insert into public.attendance_monthly
  (user_id, reference_month, group_id, schedule_mode, expected, attended, excused, cancelled,
   frequency_percent, total_classes, counted_classes, justified)
values
  (pg_temp.id('p150'), '2031-02-01', null, 'free', 8, 12, 0, 0, 150.00, 8, 8, 0),
  (pg_temp.id('p50'), '2031-02-01', null, 'free', 8, 4, 0, 0, 50.00, 8, 8, 0),
  (pg_temp.id('pvontade'), '2031-02-01', null, 'unlimited', 4, 0, 0, 0, 0.00, 4, 4, 0);

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', pg_temp.id('admin'), 'role', 'authenticated')::text, true);

do $$
declare v record;
begin
  select * into v from public.painel_admin_resumo('2031-03-10 12:00-03');
  perform pg_temp.confere('FP1 média sem teto (D55): 150% e 50% dão 100,00%; à vontade fora',
    v.ultimo_mes_fechado || ' ' || v.frequencia_media_ultimo_mes || ' ' || v.alunos_com_aula_ultimo_mes,
    '2031-02-01 100.00 2');

  -- Risco pelo ritmo (T10) em 26/02/2027: H2 tem 4 de 8; o à vontade sem
  -- nenhuma presença fica fora (D35).
  if not exists (select 1 from public.painel_alunos_em_risco(70, 4, '2027-02-26 12:00-03') r where r.user_id = pg_temp.id('h2')) then
    raise exception 'FALHOU FP2: aluno com ritmo de 50%% fora do risco';
  end if;
  if exists (select 1 from public.painel_alunos_em_risco(70, 4, '2027-02-26 12:00-03') r where r.user_id = pg_temp.id('pvontade')) then
    raise exception 'FALHOU FP2: à vontade apareceu no risco';
  end if;
  if exists (select 1 from public.painel_alunos_em_risco(70, 4, '2027-02-26 12:00-03') r where r.user_id = pg_temp.id('dono')) then
    raise exception 'FALHOU FP2: livre em dia apareceu no risco';
  end if;
  raise notice 'OK FP2: risco pelo ritmo, sem o à vontade';
end $$;

-- =====================================================================
-- FS — quem vê (§ 11.6, § 0.1 regra 8)
-- =====================================================================
select set_config('request.jwt.claims', json_build_object('sub', pg_temp.id('dono'), 'role', 'authenticated')::text, true);

do $$
begin
  perform pg_temp.confere('FS1 o próprio aluno vê o mês', pg_temp.mes('dono', '2027-02-01'), '8/8/100.00');
  begin
    perform * from public.frequencia_do_mes(array[pg_temp.id('dono'), pg_temp.id('h1')], '2027-02-01');
    raise exception 'FALHOU FS2: aluno viu a frequência de outro';
  exception when insufficient_privilege then
    raise notice 'OK FS2: aluno não vê a frequência de outro';
  end;
  begin
    perform * from public.semanas_do_mes(pg_temp.id('h1'), '2027-02-01');
    raise exception 'FALHOU FS3: aluno viu as semanas de outro';
  exception when insufficient_privilege then
    raise notice 'OK FS3: aluno não vê as semanas de outro';
  end;
  -- O legado descarta em silêncio, como sempre fez.
  perform pg_temp.confere('FS4 legado descarta o id de outro',
    (select count(*)::text from public.frequencia_mensal(array[pg_temp.id('dono'), pg_temp.id('h1')], '2027-02-15 10:00-03')), '1');
end $$;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$
begin
  begin
    perform * from public.frequencia_semanal(array[gen_random_uuid()], '2027-02-01', '2027-02-07');
    raise exception 'FALHOU FS5: anônimo chamou frequencia_semanal';
  exception when insufficient_privilege then
    raise notice 'OK FS5: anônimo recebe 42501';
  end;
end $$;

reset role;

rollback;
