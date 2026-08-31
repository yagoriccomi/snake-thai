-- Regressão do achado C-3: o aluno não pode alterar o valor da própria mensalidade.
-- Roda como o papel `authenticated`, com o claim do JWT setado — ou seja, o
-- mesmo caminho que o PostgREST usa quando o app chama.
\set ON_ERROR_STOP on

begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values ('aaaaaaaa-1111-1111-1111-111111111111',
        '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'aluno@teste.invalid', 'x', now(), now(), now());

insert into public.profiles (id, role, name)
values ('aaaaaaaa-1111-1111-1111-111111111111', 'user', 'Aluno de Teste');

insert into public.payments (id, user_id, status, due_date, amount_cents)
values ('bbbbbbbb-2222-2222-2222-222222222222',
        'aaaaaaaa-1111-1111-1111-111111111111', 'open', current_date, 12990);

-- A partir daqui, somos o aluno.
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-1111-1111-1111-111111111111","role":"authenticated"}';

-- ---------------------------------------------------------------------------
-- TESTE 1 — o ataque do C-3: baixar o valor da própria mensalidade
-- ---------------------------------------------------------------------------
do $$
begin
  begin
    update public.payments set amount_cents = 1
     where id = 'bbbbbbbb-2222-2222-2222-222222222222';
    raise exception 'FALHOU T1: o aluno alterou amount_cents (achado C-3 nao corrigido)';
  exception when insufficient_privilege then
    raise notice 'OK T1: alteracao de amount_cents negada';
  end;
end $$;

-- ---------------------------------------------------------------------------
-- TESTE 2 — marcar o próprio pagamento como pago, direto pela coluna
-- ---------------------------------------------------------------------------
do $$
begin
  begin
    update public.payments set paid_at = now()
     where id = 'bbbbbbbb-2222-2222-2222-222222222222';
    raise exception 'FALHOU T2: o aluno alterou paid_at';
  exception when insufficient_privilege or check_violation then
    raise notice 'OK T2: alteracao de paid_at negada';
  end;
end $$;

-- ---------------------------------------------------------------------------
-- TESTE 3 — o fluxo LEGÍTIMO continua funcionando (o aluno envia comprovante)
-- ---------------------------------------------------------------------------
update public.payments
   set status = 'pending_approval',
       proof_provider = 'cloudinary',
       proof_public_id = 'comprovantes/aaaa/bbbb'
 where id = 'bbbbbbbb-2222-2222-2222-222222222222';

do $$
declare v_status public.payment_status;
begin
  select status into v_status from public.payments
   where id = 'bbbbbbbb-2222-2222-2222-222222222222';
  if v_status <> 'pending_approval' then
    raise exception 'FALHOU T3: o envio de comprovante foi bloqueado (status=%)', v_status;
  end if;
  raise notice 'OK T3: envio de comprovante continua permitido';
end $$;

-- ---------------------------------------------------------------------------
-- TESTE 4 — o aluno não se aprova sozinho
-- ---------------------------------------------------------------------------
do $$
begin
  begin
    update public.payments set status = 'paid'
     where id = 'bbbbbbbb-2222-2222-2222-222222222222';
    raise exception 'FALHOU T4: o aluno aprovou o proprio pagamento';
  exception when insufficient_privilege or check_violation then
    raise notice 'OK T4: auto-aprovacao negada';
  end;
end $$;

-- ---------------------------------------------------------------------------
-- TESTE 5 — a proteção vale para coluna que o trigger nunca ouviu falar
--           (é isto que a whitelist compra: o futuro já nasce fechado)
-- ---------------------------------------------------------------------------
do $$
begin
  begin
    update public.payments set due_date = current_date + 365
     where id = 'bbbbbbbb-2222-2222-2222-222222222222';
    raise exception 'FALHOU T5: o aluno adiou o proprio vencimento';
  exception when insufficient_privilege then
    raise notice 'OK T5: colunas fora da lista permanecem negadas';
  end;
end $$;

rollback;
