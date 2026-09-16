-- ============================================================================
-- Chamada em lote e comprovante obrigatório para o aluno
-- ----------------------------------------------------------------------------
-- 1. `salvar_chamada`: a tela de chamada deixa de gravar aluno por aluno. As
--    marcações ficam no aparelho e vão ao banco de uma vez, quando o
--    professor toca em "Concluir chamada" — gravação e conclusão na MESMA
--    transação. Antes, cada toque gravava e recarregava a lista, que voltava
--    ao topo; e uma falha no meio deixava a chamada pela metade.
--
--    `concluir_chamada` continua existindo: APKs 1.4.x e 1.5.x ainda a usam.
--
-- 2. `enforce_payment_update_rules`: o aluno só manda a mensalidade para
--    análise COM comprovante anexado. Até aqui só a tela garantia isso; uma
--    chamada direta à API punha a mensalidade "em análise" sem arquivo. O
--    admin segue livre para marcar como paga sem anexo (dinheiro, acerto).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Chamada em lote
-- ----------------------------------------------------------------------------
create or replace function public.salvar_chamada(
  p_class_id  uuid,
  p_presentes uuid[],
  p_ausentes  uuid[]
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $funcao$
declare
  v_uid       uuid := (select auth.uid());
  v_presentes uuid[] := coalesce(p_presentes, '{}');
  v_ausentes  uuid[] := coalesce(p_ausentes, '{}');
  v_inicio    timestamptz;
  v_concluida timestamptz;
begin
  if not (
    public.is_admin()
    or exists (
      select 1 from public.class_teachers ct
       where ct.class_id = p_class_id and ct.teacher_id = v_uid
    )
  ) then
    raise exception 'Operação negada: só o professor da aula ou o admin faz a chamada.'
      using errcode = '42501';
  end if;

  select date_time, attendance_taken_at into v_inicio, v_concluida
    from public.classes where id = p_class_id
     for update;

  if not found then
    raise exception 'Aula não encontrada.' using errcode = 'P0002';
  end if;

  if v_inicio > now() then
    raise exception 'A chamada só pode ser feita depois que a aula começa.'
      using errcode = '23514';
  end if;

  if v_presentes && v_ausentes then
    raise exception 'Um aluno não pode estar presente e ausente na mesma chamada.'
      using errcode = '22023';
  end if;

  -- A função é SECURITY DEFINER: sem esta checagem, qualquer uuid viraria
  -- linha de presença, inclusive de professor e admin.
  if exists (
    select 1
      from unnest(v_presentes || v_ausentes) as marcado(id)
     where not exists (
       select 1 from public.profiles p where p.id = marcado.id and p.role = 'user'
     )
  ) then
    raise exception 'A chamada só aceita alunos.' using errcode = '22023';
  end if;

  -- DISTINCT: o mesmo aluno duas vezes no array faria o ON CONFLICT atualizar
  -- a mesma linha duas vezes, e o Postgres recusa o comando inteiro.
  insert into public.attendance (class_id, user_id, status)
  select p_class_id, marcado.id, 'present'::public.attendance_status
    from (select distinct unnest(v_presentes) as id) as marcado
  union all
  select p_class_id, marcado.id, 'absent'::public.attendance_status
    from (select distinct unnest(v_ausentes) as id) as marcado
  on conflict (class_id, user_id) do update
     set status = excluded.status;

  -- Quem ficou fora das duas listas volta a "sem chamada". Só a chamada é
  -- zerada: a declaração do aluno não é de quem faz a chamada.
  update public.attendance a
     set status = null
   where a.class_id = p_class_id
     and a.status is not null
     and a.user_id <> all (v_presentes || v_ausentes);

  -- Salvar de novo corrige a chamada, mas não reescreve quando ela foi concluída.
  if v_concluida is null then
    update public.classes set attendance_taken_at = now() where id = p_class_id;
    v_concluida := now();
  end if;

  return v_concluida;
end;
$funcao$;

comment on function public.salvar_chamada(uuid, uuid[], uuid[]) is
  'Grava a chamada inteira da aula e a conclui, numa transação (professor da '
  'aula ou admin). Aluno fora das duas listas volta a sem chamada; a declaração '
  'do aluno é preservada. Salvar de novo não altera o momento da conclusão.';

revoke execute on function public.salvar_chamada(uuid, uuid[], uuid[]) from public, anon;
grant execute on function public.salvar_chamada(uuid, uuid[], uuid[]) to authenticated;

-- ----------------------------------------------------------------------------
-- 2. Comprovante obrigatório para o aluno
-- ----------------------------------------------------------------------------
create or replace function public.enforce_payment_update_rules()
returns trigger
language plpgsql
set search_path = ''
as $funcao$
declare
  /*
   * O que o fluxo do aluno legitimamente altera:
   *   · status              — só para 'pending_approval' (checado abaixo)
   *   · proof_*             — o envio do comprovante, nos dois provedores
   *   · updated_at          — escrito pelo gatilho de timestamp, não por ele
   */
  colunas_do_aluno constant text[] := array[
    'status',
    'proof_provider',
    'proof_public_id',
    'proof_storage_path',
    'proof_url',
    'updated_at'
  ];
  linha_antes  jsonb := to_jsonb(old);
  linha_depois jsonb := to_jsonb(new);
  coluna       text;
begin
  -- Admin e contexto de sistema (uid nulo — cron, service_role) seguem livres.
  if public.is_admin() or (select auth.uid()) is null then
    return new;
  end if;

  for coluna in select jsonb_object_keys(linha_depois) loop
    if (linha_antes -> coluna) is distinct from (linha_depois -> coluna)
       and not (coluna = any (colunas_do_aluno)) then
      raise exception
        'Operação negada: aluno não pode alterar a coluna "%" do pagamento.', coluna
        using errcode = '42501';
    end if;
  end loop;

  if new.status is distinct from old.status and new.status <> 'pending_approval' then
    raise exception 'Operação negada: aluno só pode definir o status como pending_approval.'
      using errcode = '42501';
  end if;

  -- O app grava status e anexo no MESMO update (submitProof), então a linha
  -- nova já chega com o arquivo. Sem ele, não há o que analisar.
  if new.status = 'pending_approval'
     and old.status is distinct from 'pending_approval'
     and new.proof_public_id is null
     and new.proof_storage_path is null then
    raise exception 'Anexe o comprovante: a mensalidade só vai para análise com o arquivo.'
      using errcode = '23514';
  end if;

  return new;
end;
$funcao$;
