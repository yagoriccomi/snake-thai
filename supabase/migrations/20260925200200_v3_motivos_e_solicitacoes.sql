-- ============================================================================
-- Contrato v3 — motivos, solicitações e auditoria (bloco 4.1, fatia 3)
--
-- Só as tabelas, as travas de integridade e o que só o admin lê. As RPCs
-- (criar_motivo, anexar_ao_motivo, salvar_chamada_v2, abrir_solicitacao...)
-- são dos blocos 4.6 a 4.9a. A leitura dos motivos por quem não é admin
-- passa por `pode_ler_motivo`, que nasce na fatia 6 junto das políticas.
--
-- Padrão de toda tabela nova (§ 0.1, regra 3): RLS ligada, nada para anon e
-- authenticated, e só então o que o contrato libera.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Motivos (§ 8): o texto que justifica retificação, cancelamento,
--    reativação, solicitação e troca permanente
-- ----------------------------------------------------------------------------
create table public.action_reasons (
  id uuid primary key default gen_random_uuid(),
  kind public.action_reason_kind not null,
  -- A justificativa da troca pertence à troca, não a uma aula: não pode
  -- sumir quando uma aula futura é apagada.
  class_id uuid null references public.classes (id) on delete cascade,
  author_id uuid null references public.profiles (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  used_at timestamptz null,
  audited_at timestamptz null,
  audited_by uuid null references public.profiles (id) on delete set null,
  constraint action_reasons_aula_coerente check ((kind = 'class_swap_evidence') = (class_id is null)),
  constraint action_reasons_texto_valido check (char_length(btrim(body)) between 1 and 500)
);

comment on table public.action_reasons is
  'Motivos de uso único (§ 8): texto obrigatório e anexos opcionais. Escrita só pelas RPCs; leitura por pode_ler_motivo.';

create index action_reasons_por_aula on public.action_reasons (class_id) where class_id is not null;
-- O cron apaga os não usados há mais de 24 h (§ 8).
create index action_reasons_nao_usados on public.action_reasons (created_at) where used_at is null;

-- ----------------------------------------------------------------------------
-- 2. Anexos dos motivos
-- ----------------------------------------------------------------------------
create table public.action_reason_attachments (
  -- Gerado pelo cliente: é o `anexoId` que o servidor assina (§ 8).
  id uuid primary key,
  reason_id uuid not null references public.action_reasons (id) on delete cascade,
  uploaded_by uuid not null references public.profiles (id),
  provider public.media_provider not null,
  public_id text not null,
  created_at timestamptz not null default now(),
  -- O caminho é derivado de quem enviou e do id: o cliente não escolhe a pasta.
  constraint action_reason_attachments_caminho
    check (public_id = 'motivos/' || uploaded_by::text || '/' || id::text)
);

create index action_reason_attachments_por_motivo on public.action_reason_attachments (reason_id);

-- No máximo 5 anexos por motivo (T25). O `for update` no motivo serializa
-- dois envios simultâneos: sem ele, os dois contariam 4 e passariam.
create function public.limitar_anexos_do_motivo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total int;
begin
  perform 1 from public.action_reasons where id = new.reason_id for update;
  select count(*) into v_total from public.action_reason_attachments where reason_id = new.reason_id;
  if v_total >= 5 then
    raise exception 'Cada motivo aceita no máximo 5 anexos.' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke execute on function public.limitar_anexos_do_motivo() from public, anon, authenticated;

create trigger trg_action_reason_attachments_limite
  before insert on public.action_reason_attachments
  for each row execute function public.limitar_anexos_do_motivo();

-- Anexo apagado vai para a fila do worker, com o caminho DERIVADO (nunca o
-- valor gravado) e sem referência à linha, que já não existe (§ 8).
create function public.enfileirar_exclusao_de_anexo_de_motivo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.media_deletion_queue (provider, asset_ref, motivo)
  values (
    old.provider,
    'motivos/' || old.uploaded_by::text || '/' || old.id::text,
    case when current_setting('snake.anexo_expirado', true) = 'on'
         then 'anexo_expirado'::public.media_deletion_reason
         else 'anexo_de_motivo_removido'::public.media_deletion_reason
    end
  );
  return old;
end;
$$;

revoke execute on function public.enfileirar_exclusao_de_anexo_de_motivo() from public, anon, authenticated;

create trigger enfileirar_exclusao_de_anexo_de_motivo
  after delete on public.action_reason_attachments
  for each row execute function public.enfileirar_exclusao_de_anexo_de_motivo();

-- O anexo da justificativa que vence os 180 dias (T45) vai para a fila com o
-- motivo próprio: o cron liga `snake.anexo_expirado` e só anula a coluna, e
-- este gatilho enfileira uma vez só.
create or replace function public.enfileirar_exclusao_de_anexo_justificativa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.proof_public_id is null then
    return coalesce(new, old);
  end if;
  -- Em UPDATE, só interessa quando o anexo foi TROCADO ou REMOVIDO.
  if tg_op = 'UPDATE' and new.proof_public_id is not distinct from old.proof_public_id then
    return new;
  end if;

  insert into public.media_deletion_queue (provider, asset_ref, justification_id, motivo)
  values (
    old.proof_provider,
    old.proof_public_id,
    -- Em DELETE a linha já não existe: referenciá-la violaria a FK.
    case when tg_op = 'DELETE' then null else old.id end,
    case when current_setting('snake.anexo_expirado', true) = 'on'
         then 'anexo_expirado'::public.media_deletion_reason
         else 'justificativa_removida'::public.media_deletion_reason
    end
  );

  return coalesce(new, old);
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. Solicitações (§ 9.3): "eu estava na aula" e os pedidos de professor
-- ----------------------------------------------------------------------------
create table public.roll_call_requests (
  id uuid primary key default gen_random_uuid(),
  kind public.roll_call_request_kind not null,
  class_id uuid not null references public.classes (id) on delete cascade,
  requester_id uuid null references public.profiles (id) on delete set null,
  subject_id uuid not null references public.profiles (id) on delete cascade,
  motivo_id uuid not null references public.action_reasons (id) on delete restrict,
  status public.justification_status not null default 'pending',
  reviewed_by uuid null references public.profiles (id) on delete set null,
  reviewed_at timestamptz null,
  review_note text null,
  created_at timestamptz not null default now(),
  -- Sem reenvio (T19): uma por tipo, aula e pessoa, em qualquer estado.
  constraint roll_call_requests_uma_por_pessoa unique (kind, class_id, subject_id)
);

create index roll_call_requests_pendentes on public.roll_call_requests (created_at) where status = 'pending';
create index roll_call_requests_por_motivo on public.roll_call_requests (motivo_id);

comment on table public.roll_call_requests is
  'Solicitações da § 9.3. Sem grant nem política para authenticated: tudo pelas RPCs; reviewed_by e review_note nunca saem para quem pediu (D16).';

-- ----------------------------------------------------------------------------
-- 4. Auditoria da chamada e da aula (§ 6, § 7.1): só o admin lê
-- ----------------------------------------------------------------------------
create table public.attendance_audit (
  attendance_id uuid primary key references public.attendance (id) on delete cascade,
  taken_by uuid null references public.profiles (id) on delete set null,
  added_by uuid null references public.profiles (id) on delete set null,
  previous_status public.attendance_status null,
  edited_by uuid null references public.profiles (id) on delete set null,
  edited_at timestamptz null,
  edit_reason_id uuid null references public.action_reasons (id) on delete restrict
);

create table public.class_teacher_presence (
  class_id uuid not null,
  teacher_id uuid not null,
  present boolean not null,
  added_in_roll_call boolean not null default false,
  set_by uuid null references public.profiles (id) on delete set null,
  previous boolean null,
  edited_by uuid null references public.profiles (id) on delete set null,
  edited_at timestamptz null,
  edit_reason_id uuid null references public.action_reasons (id) on delete restrict,
  primary key (class_id, teacher_id),
  foreign key (class_id, teacher_id) references public.class_teachers (class_id, teacher_id) on delete cascade
);

create table public.class_audit (
  class_id uuid primary key references public.classes (id) on delete cascade,
  attendance_taken_by uuid null references public.profiles (id) on delete set null,
  attendance_edited_by uuid null references public.profiles (id) on delete set null,
  attendance_edited_at timestamptz null,
  cancelled_by uuid null references public.profiles (id) on delete set null,
  cancel_reason_id uuid null references public.action_reasons (id) on delete restrict
);

-- ----------------------------------------------------------------------------
-- 5. Decisão e 1ª tentativa das justificativas (§ 9.1, D15, D16, D42)
-- ----------------------------------------------------------------------------
create table public.absence_justification_reviews (
  justification_id uuid primary key references public.absence_justifications (id) on delete cascade,
  reviewer_id uuid null references public.profiles (id) on delete set null,
  review_note text not null,
  decided_at timestamptz not null,
  constraint absence_justification_reviews_nota_valida check (char_length(btrim(review_note)) between 1 and 500)
);

create table public.absence_justification_attempts (
  justification_id uuid primary key references public.absence_justifications (id) on delete cascade,
  message text null,
  proof_provider public.media_provider null,
  proof_public_id text null,
  reviewer_id uuid null references public.profiles (id) on delete set null,
  reviewed_at timestamptz null,
  review_note text null
);

comment on table public.absence_justification_reviews is
  'Quem decidiu e a nota (D15). A nota nunca fica na tabela principal: o aluno não vê quem negou nem por quê (D16).';
comment on table public.absence_justification_attempts is
  'A 1ª tentativa negada, guardada quando o aluno reenvia (D42, T16). Só o admin lê.';

-- ----------------------------------------------------------------------------
-- 6. RLS e grants (§ 0.1, regra 3)
-- ----------------------------------------------------------------------------
do $$
declare
  v_tabela text;
begin
  foreach v_tabela in array array[
    'action_reasons', 'action_reason_attachments', 'roll_call_requests', 'attendance_audit',
    'class_teacher_presence', 'class_audit', 'absence_justification_reviews', 'absence_justification_attempts'
  ] loop
    execute format('alter table public.%I enable row level security', v_tabela);
    execute format('revoke all on public.%I from anon, authenticated', v_tabela);
    execute format('grant all on public.%I to service_role', v_tabela);
  end loop;

  -- Só o admin lê, direto (§ 6, § 7.1, § 9.1). A equipe da aula usa as RPCs.
  foreach v_tabela in array array[
    'attendance_audit', 'class_teacher_presence', 'class_audit',
    'absence_justification_reviews', 'absence_justification_attempts'
  ] loop
    execute format('grant select on public.%I to authenticated', v_tabela);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select public.is_admin()))',
      v_tabela || '_select_admin', v_tabela
    );
  end loop;
end $$;
