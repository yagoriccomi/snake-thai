-- ============================================================================
-- Segurança da Fase 4 (bloco 4.12, seguranca-projeto): limite de envios
--
-- O PostgREST não tem limite por usuário [#58]. Dois caminhos do aluno geram
-- aviso no celular da equipe a cada chamada e não têm teto natural:
-- - pedir e desistir de uma troca em sequência cria uma troca nova a cada vez,
--   e cada uma avisa os professores da aula nova (troca_pendente:<id>);
-- - criar_motivo aceita motivos sem fim (o cron só apaga os não usados em 24 h).
-- Os limites são largos para o uso real e só valem para quem está logado: o
-- sistema (migrations, crons, service_role) passa.
-- ============================================================================

-- Quantos pedidos de troca uma pessoa faz por hora.
create function public.limitar_pedidos_de_troca()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  if (
    select count(*) from public.class_swaps s
     where s.user_id = new.user_id and s.created_at > now() - interval '1 hour'
  ) >= 10 then
    raise exception 'Muitos pedidos de troca em pouco tempo. Tente de novo mais tarde.' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke execute on function public.limitar_pedidos_de_troca() from public, anon, authenticated;

create trigger limitar_pedidos_de_troca
  before insert on public.class_swaps
  for each row execute function public.limitar_pedidos_de_troca();

-- Só os motivos que o aluno ou o professor escrevem para pedir algo; o motivo
-- de retificação e de cancelamento é da equipe, que decide em lote.
create function public.limitar_motivos_de_pedido()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or new.kind not in ('request_evidence', 'class_swap_evidence') then
    return new;
  end if;
  if (
    select count(*) from public.action_reasons r
     where r.author_id = new.author_id
       and r.kind in ('request_evidence', 'class_swap_evidence')
       and r.created_at > now() - interval '1 hour'
  ) >= 20 then
    raise exception 'Muitos envios em pouco tempo. Tente de novo mais tarde.' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke execute on function public.limitar_motivos_de_pedido() from public, anon, authenticated;

create trigger limitar_motivos_de_pedido
  before insert on public.action_reasons
  for each row execute function public.limitar_motivos_de_pedido();

create index if not exists class_swaps_por_pessoa_e_data on public.class_swaps (user_id, created_at);
create index if not exists action_reasons_por_autor_e_data on public.action_reasons (author_id, created_at);
