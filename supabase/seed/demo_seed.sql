-- ============================================================================
-- Snake Thai — Semeadura de DEMONSTRAÇÃO
-- ----------------------------------------------------------------------------
-- Popula a base para apresentação ao cliente: 50 alunos, 5 professores e o
-- administrador de demonstração, com turmas, planos, mensalidades em vários
-- estados e professores vinculados às aulas (para as cores aparecerem).
--
-- ATENÇÃO — isto são DADOS FICTÍCIOS. Todas as contas criadas aqui usam a
-- senha padrão `Snake@123`, e os e-mails ficam no domínio `@demo.snakethai.com`
-- justamente para serem localizáveis e removíveis depois: use
-- `supabase/seed/demo_seed_limpar.sql` antes de operar de verdade.
--
-- É IDEMPOTENTE: rodar duas vezes não duplica ninguém.
--
-- O que NÃO é tocado aqui: contas reais (fora do domínio de demo), incluindo
-- o administrador do dono do sistema. A seed só acrescenta.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Benefício do plano — é o que o aluno vê em "Meu plano"
-- ----------------------------------------------------------------------------
update public.plans
   set description = 'Aulas de luta 3x por semana, com acesso livre ao espaço de musculação e uma avaliação física por trimestre.'
 where description is null or btrim(description) = '';

-- ----------------------------------------------------------------------------
-- 2. Professores (4 novos; o professor@snake.com já existe e completa os 5)
--
--    Cores bem separadas no círculo cromático: é o que faz a borda dividida
--    da aula ser legível quando dois professores dividem a mesma turma.
-- ----------------------------------------------------------------------------
with novos as (
  select * from (values
    ('Ricardo Almeida',  '#2E86DE', '90000000001'),
    ('Juliana Costa',    '#8E44AD', '90000000002'),
    ('Marcos Vinícius',  '#16A085', '90000000003'),
    ('Patrícia Nunes',   '#E67E22', '90000000004')
  ) as t(nome, cor, cpf)
),
usuarios as (
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    -- Estas colunas de token NÃO podem ficar nulas: o GoTrue as lê como texto
    -- e devolve "Database error querying schema" no login, sem dizer por quê.
    -- A API de admin grava string vazia; inserindo por SQL, é por nossa conta.
    confirmation_token, recovery_token, email_change,
    email_change_token_new, email_change_token_current,
    phone_change, phone_change_token, reauthentication_token
  )
  select
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    lower(translate(split_part(n.nome, ' ', 1), 'áéíóúâêôãõç', 'aeiouaeoaoc')) || '.prof@demo.snakethai.com',
    crypt('Snake@123', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    '', '', '', '', '', '', '', ''
  from novos n
  where not exists (
    select 1 from auth.users u
    where u.email = lower(translate(split_part(n.nome, ' ', 1), 'áéíóúâêôãõç', 'aeiouaeoaoc')) || '.prof@demo.snakethai.com'
  )
  returning id, email
)
insert into public.profiles (id, role, name, cpf, color, is_first_login, status)
select
  u.id,
  'professor',
  n.nome,
  n.cpf,
  n.cor,
  false,   -- demo: já pronto para uso, sem passar pelo onboarding
  'active'
from usuarios u
join novos n
  on lower(translate(split_part(n.nome, ' ', 1), 'áéíóúâêôãõç', 'aeiouaeoaoc')) || '.prof@demo.snakethai.com' = u.email;

-- O professor de teste que já existia entra na contagem dos 5.
update public.profiles
   set name = coalesce(nullif(btrim(name), ''), 'Professor Teste'),
       color = coalesce(color, '#FF6B35')
 where id in (select id from auth.users where email = 'professor@snake.com');

-- ----------------------------------------------------------------------------
-- 3. Alunos — completa a base até 50
--
--    A quantidade é calculada, não fixa: a base já tinha alunos de rodadas
--    anteriores, e um número fixo aqui criaria 37 hoje e 87 amanhã.
-- ----------------------------------------------------------------------------
with alvo as (
  -- Conta só quem é apresentável: um aluno anonimizado por LGPD continua na
  -- tabela (o histórico financeiro dele não pode sumir), mas não aparece em
  -- lista nenhuma — se entrasse na conta, a demo teria 49 alunos visíveis.
  select greatest(0, 50 - (
    select count(*) from public.profiles
     where role = 'user' and anonymized_at is null
  )) as faltam
),
nomes as (
  select nome, row_number() over () as posicao
  from unnest(array[
    'Ana Beatriz Souza','Bruno Carvalho','Camila Ferreira','Daniel Moreira','Eduarda Lima',
    'Fábio Ramos','Gabriela Pinto','Henrique Barros','Isabela Cardoso','João Pedro Martins',
    'Karina Duarte','Lucas Figueiredo','Mariana Teixeira','Nicolas Freitas','Olívia Ribeiro',
    'Paulo Henrique Dias','Queila Santana','Rafael Monteiro','Sabrina Correia','Thiago Braga',
    'Ursula Prado','Vinícius Lopes','Wesley Amaral','Yasmin Cavalcante','Zeca Fonseca',
    'Amanda Vieira','Bernardo Gomes','Cristina Machado','Douglas Peixoto','Elaine Castro',
    'Fernando Sales','GiovanaRezende','Hugo Bittencourt','Ingrid Nascimento','Jonas Siqueira',
    'Larissa Aguiar','Murilo Bastos','Natália Queiroz','Otávio Campos','Priscila Rangel',
    'Renato Vasques','Simone Padilha','Tatiane Belmonte','Ulisses Andrade','Valentina Cruz',
    'William Portela','Xênia Bonfim','Yuri Antunes','Zilda Marques','Alberto Cunha'
  ]) as nome
),
-- Filtra os nomes AINDA NÃO usados antes de limitar pela quantidade que
-- falta. Cortar por `posicao <= faltam` direto no array parecia equivalente,
-- mas não é: numa segunda execução as primeiras posições já existem, e o
-- script tentaria recriar justamente essas — completando zero.
disponiveis as (
  select n.nome, n.posicao
  from nomes n
  where not exists (
    select 1 from auth.users u
    where u.email = 'aluno' || lpad(n.posicao::text, 2, '0') || '@demo.snakethai.com'
  )
),
escolhidos as (
  select d.nome, d.posicao
  from disponiveis d
  order by d.posicao
  limit (select faltam from alvo)
),
usuarios as (
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    -- Estas colunas de token NÃO podem ficar nulas: o GoTrue as lê como texto
    -- e devolve "Database error querying schema" no login, sem dizer por quê.
    -- A API de admin grava string vazia; inserindo por SQL, é por nossa conta.
    confirmation_token, recovery_token, email_change,
    email_change_token_new, email_change_token_current,
    phone_change, phone_change_token, reauthentication_token
  )
  select
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'aluno' || lpad(e.posicao::text, 2, '0') || '@demo.snakethai.com',
    crypt('Snake@123', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    '', '', '', '', '', '', '', ''
  from escolhidos e
  where not exists (
    select 1 from auth.users u
    where u.email = 'aluno' || lpad(e.posicao::text, 2, '0') || '@demo.snakethai.com'
  )
  returning id, email
)
insert into public.profiles (id, role, name, cpf, phone, is_first_login, status, group_id, plan_id)
select
  u.id,
  'user',
  e.nome,
  '800' || lpad(e.posicao::text, 8, '0'),
  '119' || lpad(e.posicao::text, 8, '0'),
  false,
  'active',
  -- Distribui entre as turmas existentes, em rodízio.
  (select id from public.groups order by name offset (e.posicao % greatest(1, (select count(*) from public.groups))) limit 1),
  (select id from public.plans where is_active order by created_at limit 1)
from usuarios u
join escolhidos e
  on 'aluno' || lpad(e.posicao::text, 2, '0') || '@demo.snakethai.com' = u.email;

-- ----------------------------------------------------------------------------
-- 4. Alunos que já existiam entram no faturamento
--
--    Sem plano vinculado, a recorrência mensal simplesmente não os enxerga —
--    e a tela de financeiro apareceria vazia na demonstração.
-- ----------------------------------------------------------------------------
update public.profiles
   set plan_id = (select id from public.plans where is_active order by created_at limit 1)
 where role = 'user'
   and plan_id is null
   and anonymized_at is null;

-- Quem estava sem turma entra no rodízio também.
update public.profiles p
   set group_id = g.id
  from (
    select id, row_number() over (order by name) as posicao
    from public.groups
  ) g
 where p.role = 'user'
   and p.group_id is null
   and g.posicao = 1 + (abs(hashtext(p.id::text)) % greatest(1, (select count(*) from public.groups)));

-- ----------------------------------------------------------------------------
-- 5. Mensalidade do mês corrente para todo mundo
--
--    Os alunos criados no passo 3 já ganharam a fatura PROPORCIONAL pelo
--    trigger de entrada; esta chamada cobre os que já existiam. O
--    `on conflict` interno impede duplicar quem já tem.
-- ----------------------------------------------------------------------------
select public.gerar_mensalidades_do_mes();

-- ----------------------------------------------------------------------------
-- 6. Histórico dos 5 meses anteriores — dá corpo à tela de financeiro
-- ----------------------------------------------------------------------------
insert into public.payments (user_id, plan_id, amount_cents, due_date, reference_month, status, paid_at)
select
  p.id,
  p.plan_id,
  pl.price_cents,
  make_date(
    extract(year from mes)::integer,
    extract(month from mes)::integer,
    pl.due_day
  ),
  mes::date,
  'paid',
  (mes + interval '9 days')::timestamptz
from public.profiles p
join public.plans pl on pl.id = p.plan_id
cross join generate_series(
  date_trunc('month', current_date) - interval '5 months',
  date_trunc('month', current_date) - interval '1 month',
  interval '1 month'
) as mes
where p.role = 'user'
  and p.status = 'active'
  and p.anonymized_at is null
on conflict (user_id, reference_month) do nothing;

-- ----------------------------------------------------------------------------
-- 7. Variedade de situações no mês corrente
--
--    Uma tela com tudo "em aberto" não demonstra nada. Distribui de forma
--    determinística (pelo hash do id) para a demo ser sempre a mesma.
-- ----------------------------------------------------------------------------
with alvo as (
  select
    pay.id,
    abs(hashtext(pay.user_id::text)) % 10 as balde
  from public.payments pay
  where pay.reference_month = date_trunc('month', current_date)::date
)
update public.payments pay
   set status = case
         when a.balde < 4 then 'paid'::public.payment_status              -- 40% em dia
         when a.balde < 6 then 'pending_approval'::public.payment_status  -- 20% aguardando o admin
         when a.balde < 8 then 'overdue'::public.payment_status           -- 20% em atraso
         else 'open'::public.payment_status                               -- 20% em aberto
       end,
       paid_at = case
         when a.balde < 4 then now() - (a.balde || ' days')::interval
         else null
       end
  from alvo a
 where pay.id = a.id;

-- ----------------------------------------------------------------------------
-- 8. Agenda FUTURA
--
--    A tela do aluno lista apenas aulas a partir de agora. Uma base cujas
--    aulas ficaram todas no passado mostra "Nenhuma aula por aqui" para ele —
--    o que aconteceu de fato, com aulas paradas em setembro. Aqui as próximas
--    4 semanas são preenchidas, em dias alternados, no horário de cada turma.
-- ----------------------------------------------------------------------------
insert into public.classes (title, type, date_time, group_id)
select
  'Muay Thai — ' || g.name,
  'routine',
  -- O horário é LOCAL: sem o AT TIME ZONE, uma aula "das 19h" viraria 19h UTC,
  -- ou seja, 16h em São Paulo.
  ((dia::date + (case
      when g.name ilike '%manh%' then time '07:00'
      when g.name ilike '%tarde%' then time '15:00'
      else time '19:00'
    end)) at time zone 'America/Sao_Paulo'),
  g.id
from public.groups g
cross join generate_series(current_date + 1, current_date + 28, interval '1 day') as dia
where extract(dow from dia) in (1, 3, 5)   -- segunda, quarta e sexta
  and not exists (
    select 1 from public.classes c
    where c.group_id = g.id
      and c.date_time = ((dia::date + (case
            when g.name ilike '%manh%' then time '07:00'
            when g.name ilike '%tarde%' then time '15:00'
            else time '19:00'
          end)) at time zone 'America/Sao_Paulo')
  );

-- ----------------------------------------------------------------------------
-- 9. Professores nas aulas — é o que faz a cor aparecer na agenda
--
--    Uma parte das aulas recebe DOIS professores de propósito: é o caso que
--    exercita a borda dividida em faixas.
-- ----------------------------------------------------------------------------
with professores as (
  select id, row_number() over (order by name) as posicao,
         count(*) over () as total
  from public.profiles where role = 'professor'
),
aulas as (
  select id, row_number() over (order by date_time) as posicao
  from public.classes
)
insert into public.class_teachers (class_id, teacher_id)
select a.id, pr.id
from aulas a
join professores pr on pr.posicao = 1 + (a.posicao % pr.total)
on conflict do nothing;

-- Toda terceira aula ganha um segundo professor (co-docência).
with professores as (
  select id, row_number() over (order by name desc) as posicao,
         count(*) over () as total
  from public.profiles where role = 'professor'
),
aulas as (
  select id, row_number() over (order by date_time) as posicao
  from public.classes
)
insert into public.class_teachers (class_id, teacher_id)
select a.id, pr.id
from aulas a
join professores pr on pr.posicao = 1 + (a.posicao % pr.total)
where a.posicao % 3 = 0
on conflict do nothing;

commit;
