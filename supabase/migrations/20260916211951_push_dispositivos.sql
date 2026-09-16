-- ============================================================================
-- Aparelhos que recebem notificação push — T9
--
-- Um token Expo por aparelho, ligado a quem está logado nele. O token é dado
-- pessoal (identifica o aparelho): só o próprio titular lê ou apaga o seu, e
-- a gravação passa por uma função que também troca o dono quando outra
-- pessoa entra no mesmo aparelho (a RLS não deixaria fazer isso por UPDATE).
-- Excluir a conta (LGPD) apaga os aparelhos na hora.
-- ============================================================================

create type public.push_platform as enum ('android', 'ios');

-- Mesmo contrato da variante do app (T1): o despachante de produção só manda
-- para aparelhos 'production'.
create type public.app_variant as enum ('production', 'development');

create table public.push_devices (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  expo_token   text not null unique
               constraint push_devices_token_expo check (expo_token ~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$'),
  platform     public.push_platform not null,
  app_variant  public.app_variant not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

comment on table public.push_devices is
  'T9: token Expo de cada aparelho com notificações ativadas. Gravação só por registrar_dispositivo_push(); apagado ao sair da conta, ao excluir a conta e quando a Expo diz DeviceNotRegistered.';

create index idx_push_devices_user on public.push_devices (user_id);

create trigger trg_push_devices_set_updated_at
  before update on public.push_devices
  for each row execute function public.handle_updated_at();

alter table public.push_devices enable row level security;

create policy "push_devices_select_own" on public.push_devices
  for select to authenticated using (user_id = (select auth.uid()));
create policy "push_devices_delete_own" on public.push_devices
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.push_devices from anon, authenticated;
grant select, delete on public.push_devices to authenticated;
grant all on public.push_devices to service_role;

-- ----------------------------------------------------------------------------
-- Registrar o aparelho de quem está logado
-- ----------------------------------------------------------------------------
create or replace function public.registrar_dispositivo_push(
  p_token text,
  p_plataforma public.push_platform,
  p_variante public.app_variant
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $funcao$
declare
  -- Aparelhos por pessoa: acima disso sai o que não abre o app há mais tempo.
  c_maximo_de_aparelhos constant integer := 5;
  v_uid uuid := (select auth.uid());
  v_id  uuid;
begin
  if v_uid is null then
    raise exception 'Operação negada: entre na conta para ativar notificações.' using errcode = '42501';
  end if;

  if exists (select 1 from public.profiles p where p.id = v_uid and p.anonymized_at is not null) then
    raise exception 'Operação negada: conta excluída.' using errcode = '42501';
  end if;

  insert into public.push_devices (user_id, expo_token, platform, app_variant, last_seen_at)
  values (v_uid, p_token, p_plataforma, p_variante, clock_timestamp())
  on conflict (expo_token) do update
     set user_id      = excluded.user_id,
         platform     = excluded.platform,
         app_variant  = excluded.app_variant,
         -- clock_timestamp, não now(): a ordem "mais antigo" precisa valer até dentro da mesma transação.
         last_seen_at = clock_timestamp()
  returning id into v_id;

  delete from public.push_devices d
   where d.user_id = v_uid
     and d.id in (
       select antigos.id from public.push_devices antigos
        where antigos.user_id = v_uid
        order by antigos.last_seen_at desc
        offset c_maximo_de_aparelhos
     );

  return v_id;
end;
$funcao$;

comment on function public.registrar_dispositivo_push(text, public.push_platform, public.app_variant) is
  'T9: grava (ou reatribui a quem está logado) o token Expo do aparelho e mantém no máximo 5 aparelhos por pessoa.';

revoke execute on function public.registrar_dispositivo_push(text, public.push_platform, public.app_variant) from public, anon;
grant execute on function public.registrar_dispositivo_push(text, public.push_platform, public.app_variant) to authenticated;

-- ----------------------------------------------------------------------------
-- Conta excluída (LGPD) perde os aparelhos
--
--    Qualquer caminho que preencha anonymized_at (anonimizar_titular, hoje)
--    dispara isto: nenhuma notificação chega a um aparelho de conta excluída.
-- ----------------------------------------------------------------------------
create or replace function public.apagar_aparelhos_da_conta_excluida()
returns trigger
language plpgsql
security definer
set search_path = ''
as $funcao$
begin
  if old.anonymized_at is null and new.anonymized_at is not null then
    delete from public.push_devices where user_id = new.id;
  end if;
  return new;
end;
$funcao$;

revoke execute on function public.apagar_aparelhos_da_conta_excluida() from public, anon, authenticated;

create trigger trg_profiles_apagar_aparelhos_da_conta_excluida
  after update of anonymized_at on public.profiles
  for each row execute function public.apagar_aparelhos_da_conta_excluida();
