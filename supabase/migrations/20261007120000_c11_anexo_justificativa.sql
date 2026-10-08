-- ============================================================================
-- C11 (item 4.8; contrato v6, § 9.1 e § 15) — o anexo da justificativa sai da
-- escrita direta do aluno e passa pela anexar_a_justificativa.
--
-- (1) Na escrita direta do dono (INSERT e UPDATE fora das RPCs), o anexo não
--     entra, não muda e não some: só a RPC o grava, com o caminho que ela
--     deriva no banco ('<id>' ou '<id>-2'). D42 revista (coordenação, 08/10):
--     o caminho legado por aula, que o upsert do APK 1.8/1.9 e da web atual
--     gravavam, é desligado já na 2.0.0, sem carência. O texto do upsert
--     legado segue aceito (§ 15); o anexo legado já gravado fica como está.
-- (2) A constraint do caminho amarra o sufixo à tentativa: '<id>' só na 1ª,
--     '<id>-2' só na 2ª (REVIEW-FASE4, risco médio). O view-url do servidor
--     segue sem pedir attempt até o G4 (D27): ele aceita os três caminhos
--     derivados, e esta trava só estreita o que o banco guarda.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. A trava: anexo da forma nova só pela RPC
-- ----------------------------------------------------------------------------
create or replace function public.enforce_absence_justification_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  colunas_do_dono constant text[] := array['message', 'updated_at'];
  v_uid uuid := (select auth.uid());
  v_sistema boolean := (select auth.uid()) is null and coalesce(auth.role(), '') <> 'anon';
  -- § 0.1 regra 4 (v4): as RPCs de justificativa ligam a variável em volta
  -- da própria escrita; sem coalesce, a sessão nova daria nulo e liberaria.
  v_pela_rpc boolean := coalesce(current_setting('snake.justificativa_rpc', true), '') = 'on';
  v_aula record;
  v_dias smallint[];
  v_ultimo_dia date;
  v_cota smallint;
  coluna text;
begin
  -- (i) DELETE: só o dono, com a linha pendente. Decidida fica (D15).
  if tg_op = 'DELETE' then
    if v_sistema
       or not exists (select 1 from public.profiles p where p.id = old.user_id)
       or (old.class_id is not null and not exists (select 1 from public.classes c where c.id = old.class_id)) then
      return old;
    end if;
    if old.user_id <> v_uid or old.status <> 'pending' then
      raise exception 'Operação negada: só o aluno apaga a própria justificativa, enquanto ela está em análise.'
        using errcode = '42501';
    end if;
    return old;
  end if;

  -- A semana da justificativa de aula é a da aula, qualquer que seja o valor
  -- enviado: é o que mantém o upsert do APK 1.8 e da web atual funcionando.
  if tg_op = 'INSERT' and new.scope = 'class' then
    select c.type, c.date_time, c.cancelled_at into v_aula from public.classes c where c.id = new.class_id;
    new.week_start := date_trunc('week', v_aula.date_time at time zone 'America/Sao_Paulo')::date;
  end if;

  if v_sistema then
    return new;
  end if;

  -- reenviar, anexar e decidir (§ 9.1): o que (f) a (h) recusam no UPDATE direto.
  if tg_op = 'UPDATE' and v_pela_rpc then
    return new;
  end if;

  -- INSERT ------------------------------------------------------------------
  if tg_op = 'INSERT' then
    -- (e) só a própria, e sempre pendente, tentativa 1.
    if new.user_id is distinct from v_uid then
      raise exception 'Operação negada: cada aluno envia só a própria justificativa.' using errcode = '42501';
    end if;
    if new.status <> 'pending' or new.attempt <> 1 or new.reviewed_by is not null or new.reviewed_at is not null then
      raise exception 'Operação negada: justificativa nasce pendente de revisão.' using errcode = '42501';
    end if;
    -- (j) D42 revista: o anexo nasce só na anexar_a_justificativa, nunca no
    -- INSERT direto (nem o caminho legado do APK 1.8/1.9 e da web atual).
    if new.proof_provider is not null or new.proof_public_id is not null then
      raise exception 'Atualize o aplicativo para anexar arquivo à justificativa.' using errcode = '22023';
    end if;

    if new.scope = 'class' then
      -- (c) aula de rotina, não cancelada, da grade efetiva do fixo.
      if v_aula.type is distinct from 'routine' then
        raise exception 'Só aula de rotina tem justificativa.' using errcode = '23514';
      end if;
      if v_aula.cancelled_at is not null then
        raise exception 'Aula cancelada.' using errcode = '23514';
      end if;
      -- T38: a original de uma troca pendente ou aprovada não se justifica.
      if exists (
        select 1 from public.class_swaps s
         where s.user_id = new.user_id and s.kind = 'once'
           and s.from_class_id = new.class_id and s.status in ('pending', 'approved')
      ) then
        raise exception 'Esta aula foi trocada. Se faltar à aula nova, justifique a aula nova.'
          using errcode = '23514';
      end if;
      if not exists (
        select 1 from public.grade_efetiva_do_fixo(array[new.user_id], v_aula.date_time, v_aula.date_time + interval '1 microsecond') g
         where g.class_id = new.class_id
      ) then
        raise exception 'Só dá para justificar uma aula da sua grade.' using errcode = '23514';
      end if;
      -- (b) D13: até 23:59 (SP) do 7º dia depois da aula.
      if now() >= ((v_aula.date_time at time zone 'America/Sao_Paulo')::date + 8)::timestamp at time zone 'America/Sao_Paulo' then
        raise exception 'O prazo para justificar esta aula terminou.' using errcode = '23514';
      end if;
      return new;
    end if;

    -- (d) semana: só o livre (o à vontade não justifica, D39).
    if new.week_start is null
       or extract(isodow from new.week_start) <> 1
       or new.week_start > (now() at time zone 'America/Sao_Paulo')::date then
      raise exception 'Informe a segunda-feira de uma semana que já começou.' using errcode = '22023';
    end if;
    if public.modalidade_da_semana(new.user_id, new.week_start) <> 'free' then
      raise exception 'Justificativa por semana é só para alunos de horário livre.' using errcode = '23514';
    end if;
    -- (b) D13: até 23:59 (SP) do 7º dia depois do último dia de aula da semana.
    select class_weekdays into v_dias from public.academy_settings limit 1;
    select new.week_start + max(((d + 6) % 7))::int into v_ultimo_dia
      from unnest(coalesce(v_dias, '{1,2,3,4,5,6}'::smallint[])) as d;
    if now() >= ((v_ultimo_dia + 8)::timestamp at time zone 'America/Sao_Paulo') then
      raise exception 'O prazo para justificar esta semana terminou.' using errcode = '23514';
    end if;
    -- T17: no máximo cota_W por semana, contando as negadas.
    v_cota := coalesce(public.cota_da_semana(new.user_id, new.week_start), 0);
    if (select count(*) from public.absence_justifications j
         where j.user_id = new.user_id and j.scope = 'week' and j.week_start = new.week_start) >= v_cota then
      raise exception 'Você já enviou as justificativas que cabem nesta semana.' using errcode = '23514';
    end if;
    return new;
  end if;

  -- UPDATE ------------------------------------------------------------------
  -- (h) decisão por update direto (APK 1.8): o caminho é decidir_justificativa (4.8).
  if new.status is distinct from old.status then
    raise exception 'Atualize o aplicativo para decidir justificativas.' using errcode = '22023';
  end if;

  -- (g) decidida não muda por update direto, nem para o admin.
  if old.status <> 'pending' then
    raise exception 'Operação negada: justificativa já decidida não pode ser alterada.' using errcode = '42501';
  end if;

  -- (f) pendente: só o dono, e só o texto.
  if old.user_id is distinct from v_uid then
    raise exception 'Operação negada: só o aluno altera a própria justificativa.' using errcode = '42501';
  end if;

  -- (j) D42 revista: o anexo não muda por UPDATE direto. O que já existe fica
  -- como foi gravado; o novo entra só pela anexar_a_justificativa.
  if (new.proof_provider, new.proof_public_id) is distinct from (old.proof_provider, old.proof_public_id) then
    if old.proof_public_id is not null then
      raise exception 'Operação negada: o anexo desta justificativa não pode ser trocado nem removido.' using errcode = '42501';
    end if;
    raise exception 'Atualize o aplicativo para anexar arquivo à justificativa.' using errcode = '22023';
  end if;

  for coluna in select jsonb_object_keys(to_jsonb(new)) loop
    if (to_jsonb(old) -> coluna) is distinct from (to_jsonb(new) -> coluna)
       and not (coluna = any (colunas_do_dono)) then
      raise exception 'Operação negada: na justificativa, o aluno só altera o texto (coluna "%").', coluna
        using errcode = '42501';
    end if;
  end loop;

  return new;
end;
$function$;

-- ----------------------------------------------------------------------------
-- 2. O sufixo segue a tentativa (§ 9.1)
-- ----------------------------------------------------------------------------
alter table public.absence_justifications drop constraint absence_justifications_caminho_do_anexo;
alter table public.absence_justifications
  add constraint absence_justifications_caminho_do_anexo check (
    proof_public_id is null
    or (attempt = 1 and proof_public_id = 'justificativas/' || user_id::text || '/' || id::text)
    or (attempt = 2 and proof_public_id = 'justificativas/' || user_id::text || '/' || id::text || '-2')
    or (class_id is not null and proof_public_id = 'justificativas/' || user_id::text || '/' || class_id::text)
  ) not valid;

-- A mesma conferência da v3: dado fora da regra para a publicação com a
-- contagem, sem PII, antes do VALIDATE.
do $$
declare
  v_fora int;
begin
  select count(*) into v_fora
    from public.absence_justifications
   where not (
     proof_public_id is null
     or (attempt = 1 and proof_public_id = 'justificativas/' || user_id::text || '/' || id::text)
     or (attempt = 2 and proof_public_id = 'justificativas/' || user_id::text || '/' || id::text || '-2')
     or (class_id is not null and proof_public_id = 'justificativas/' || user_id::text || '/' || class_id::text)
   );
  if v_fora > 0 then
    raise exception 'Dados fora das regras novas: % justificativa(s) com o sufixo do anexo diferente da tentativa. Corrija os dados antes de publicar.', v_fora;
  end if;
end $$;

alter table public.absence_justifications validate constraint absence_justifications_caminho_do_anexo;
