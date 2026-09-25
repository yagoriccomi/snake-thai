-- ============================================================================
-- Contrato v3 — troca de aula (bloco 4.1, fatia 4; § 9.4, D44–D50, T33–T39)
--
-- As três tabelas e o gatilho que fecha a troca quando uma das aulas é
-- apagada. Pedir, decidir, desistir e as listas são do bloco 4.9b; a grade
-- efetiva (`grade_efetiva_do_fixo`) nasce na fatia 6.
--
-- RLS ligada e NENHUM grant nem política para authenticated nas três (§ 9.4):
-- o APK 1.8 não conhece nenhuma delas, e tudo passa pelas RPCs.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. O pedido de troca
-- ----------------------------------------------------------------------------
create table public.class_swaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.class_swap_kind not null,
  from_class_id uuid null references public.classes (id) on delete set null,
  to_class_id uuid null references public.classes (id) on delete set null,
  -- Só na permanente: a aula escolhida é só um ponteiro para o horário (T37).
  from_schedule_id uuid null references public.class_schedules (id) on delete set null,
  to_schedule_id uuid null references public.class_schedules (id) on delete set null,
  motivo_id uuid null references public.action_reasons (id) on delete restrict,
  status public.class_swap_status not null default 'pending',
  decided_via text null,
  decided_by uuid null references public.profiles (id) on delete set null,
  decided_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint class_swaps_tipo_coerente check (
    (kind = 'once' and motivo_id is null and from_schedule_id is null and to_schedule_id is null)
    or (kind = 'permanent' and motivo_id is not null)
  ),
  constraint class_swaps_fim_coerente check (
    (status = 'pending') = (decided_at is null) and (status = 'pending') = (decided_via is null)
  ),
  constraint class_swaps_via_valida check (decided_via in ('review', 'roll_call', 'student', 'system')),
  -- Na negada, quem negou fica só em class_swap_reviews (D16).
  constraint class_swaps_aprovador_coerente check (status = 'approved' or decided_by is null)
);

comment on table public.class_swaps is
  'Troca de uma aula por outra (§ 9.4): só nesta semana (once) ou permanente. Escrita só pelas RPCs e pelos gatilhos da T39 e da T53.';

-- Uma troca avulsa ativa por aula, de cada lado (evita duas trocas saindo
-- da mesma aula e o abono em dobro).
create unique index class_swaps_uma_ativa_por_origem
  on public.class_swaps (user_id, from_class_id)
  where kind = 'once' and status in ('pending', 'approved');
create unique index class_swaps_uma_ativa_por_destino
  on public.class_swaps (user_id, to_class_id)
  where kind = 'once' and status in ('pending', 'approved');
create unique index class_swaps_uma_permanente_pendente
  on public.class_swaps (user_id, from_schedule_id)
  where kind = 'permanent' and status = 'pending';
create index class_swaps_pendentes_por_destino
  on public.class_swaps (to_class_id)
  where status = 'pending';
create index class_swaps_por_aluno on public.class_swaps (user_id, created_at);
create index class_swaps_por_origem on public.class_swaps (from_class_id) where from_class_id is not null;
create index class_swaps_por_motivo on public.class_swaps (motivo_id) where motivo_id is not null;

-- ----------------------------------------------------------------------------
-- 2. A última decisão (aprovação ou negativa) e a nota
-- ----------------------------------------------------------------------------
create table public.class_swap_reviews (
  swap_id uuid primary key references public.class_swaps (id) on delete cascade,
  reviewer_id uuid null references public.profiles (id) on delete set null,
  review_note text null,
  decided_via text not null,
  decided_at timestamptz not null,
  constraint class_swap_reviews_nota_valida
    check (review_note is null or char_length(btrim(review_note)) between 1 and 500),
  constraint class_swap_reviews_via_valida check (decided_via in ('review', 'roll_call'))
);

-- ----------------------------------------------------------------------------
-- 3. O histórico da grade permanente (T37)
-- ----------------------------------------------------------------------------
create table public.class_swap_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  swap_id uuid null references public.class_swaps (id) on delete set null,
  -- Um horário só é apagado se nunca começou (§ 6): o período vai junto.
  from_schedule_id uuid not null references public.class_schedules (id) on delete cascade,
  to_schedule_id uuid not null references public.class_schedules (id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz null,
  end_reason text null,
  constraint class_swap_periods_fim_coerente check (
    (ended_at is null) = (end_reason is null) and (ended_at is null or ended_at >= started_at)
  ),
  constraint class_swap_periods_motivo_valido
    check (end_reason in ('replaced', 'reverted', 'group_changed', 'plan_changed', 'schedule_ended')),
  constraint class_swap_periods_horarios_diferentes check (from_schedule_id <> to_schedule_id)
);

comment on table public.class_swap_periods is
  'Grade permanente do fixo por horário (T37). Vigente no instante t: started_at <= t e (ended_at nulo ou > t). O fim nunca vai para o passado. Nunca é apagado (exceto na conta excluída).';

-- Os índices só enxergam `ended_at` nulo; um período com fim no FUTURO ainda
-- é vigente, e essa parte da regra é conferida por quem escreve (for update).
create unique index class_swap_periods_uma_aberta_por_origem
  on public.class_swap_periods (user_id, from_schedule_id)
  where ended_at is null;
create unique index class_swap_periods_uma_aberta_por_destino
  on public.class_swap_periods (user_id, to_schedule_id)
  where ended_at is null;
create index class_swap_periods_por_destino on public.class_swap_periods (to_schedule_id);

-- ----------------------------------------------------------------------------
-- 4. Aula apagada com troca pendente (T39, T50)
--
-- A FK anula `from_class_id` ou `to_class_id`; este gatilho decide o que
-- acontece com a troca pendente naquele mesmo UPDATE:
--   * avulsa cuja aula NOVA sumiu, com a ORIGINAL já começada: aprovada pelo
--     sistema (ele deixou de ir à original contando com a troca; a vaga fica
--     abonada, D57/T50);
--   * qualquer outro caso pendente: cancelada.
-- A aprovada segue. É a única escrita em class_swaps fora das RPCs, dos
-- gatilhos da T39/T53 e do cron da § 8.
-- ----------------------------------------------------------------------------
create function public.cancelar_troca_de_aula_apagada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aula_sumiu boolean;
  v_original_ja_comecou boolean;
begin
  if old.status <> 'pending' then
    return new;
  end if;

  v_aula_sumiu := (old.from_class_id is not null and new.from_class_id is null)
               or (old.to_class_id is not null and new.to_class_id is null);
  if not v_aula_sumiu then
    return new;
  end if;

  select c.date_time <= now() into v_original_ja_comecou
    from public.classes c
   where c.id = new.from_class_id;

  if new.kind = 'once'
     and old.to_class_id is not null and new.to_class_id is null
     and coalesce(v_original_ja_comecou, false) then
    new.status := 'approved';
  else
    new.status := 'cancelled';
  end if;
  new.decided_via := 'system';
  new.decided_by := null;
  new.decided_at := now();
  return new;
end;
$$;

revoke execute on function public.cancelar_troca_de_aula_apagada() from public, anon, authenticated;

create trigger cancelar_troca_de_aula_apagada
  before update of from_class_id, to_class_id on public.class_swaps
  for each row execute function public.cancelar_troca_de_aula_apagada();

-- ----------------------------------------------------------------------------
-- 5. RLS e grants (§ 0.1, regra 3; § 9.4: nada para authenticated)
-- ----------------------------------------------------------------------------
do $$
declare
  v_tabela text;
begin
  foreach v_tabela in array array['class_swaps', 'class_swap_reviews', 'class_swap_periods'] loop
    execute format('alter table public.%I enable row level security', v_tabela);
    execute format('revoke all on public.%I from anon, authenticated', v_tabela);
    execute format('grant all on public.%I to service_role', v_tabela);
  end loop;
end $$;
