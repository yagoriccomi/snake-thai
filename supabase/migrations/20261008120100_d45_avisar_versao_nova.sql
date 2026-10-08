-- ============================================================================
-- D45 (coordenação, 08/10; contrato v7, § 10) — push de versão nova
--
-- O admin (ou o dono, no SQL Editor) avisa todos que têm aparelho cadastrado
-- que saiu um APK novo. O banco não sabe a versão instalada em cada aparelho
-- (opção A da D38): o texto diz "se já atualizou, ignore".
--
-- A versão vai em `data` como três números, não como texto: a fila só guarda
-- números pequenos (notification_outbox.data) e a send-push monta o "X.Y.Z".
-- A chave `versao_nova:X.Y.Z` faz a segunda chamada com a mesma versão não
-- repetir o aviso a quem já o recebeu.
-- ============================================================================

create or replace function public.avisar_versao_nova(p_versao text)
returns integer
language plpgsql
security definer
set search_path = ''
as $funcao$
declare
  -- SQL Editor e service_role: sem usuário, mas não anônimo (§ 0.1).
  v_sistema boolean := (select auth.uid()) is null and coalesce(auth.role(), '') <> 'anon';
  v_partes text[];
  v_data jsonb;
  v_destinatario uuid;
  v_avisados integer := 0;
begin
  if not v_sistema and not public.is_admin() then
    raise exception 'Operação negada: só o admin avisa sobre versão nova do aplicativo.' using errcode = '42501';
  end if;

  -- Só X.Y.Z, como a tag vX.Y.Z do release (§ 12.3), sem o "v" nem sufixo.
  v_partes := regexp_match(coalesce(p_versao, ''), '^(\d{1,4})\.(\d{1,4})\.(\d{1,4})$');
  if v_partes is null then
    raise exception 'Versão inválida: use o formato 2.0.0, sem "v" e sem sufixo.' using errcode = '22023';
  end if;
  v_data := jsonb_build_object(
    'major', v_partes[1]::integer,
    'minor', v_partes[2]::integer,
    'patch', v_partes[3]::integer
  );

  for v_destinatario in
    select distinct d.user_id
      from public.push_devices d
      join public.profiles p on p.id = d.user_id
     where p.status = 'active' and p.anonymized_at is null
  loop
    if public.enfileirar_notificacao(
         v_destinatario, 'versao_nova',
         'versao_nova:' || (v_data ->> 'major') || '.' || (v_data ->> 'minor') || '.' || (v_data ->> 'patch'),
         v_data) then
      v_avisados := v_avisados + 1;
    end if;
  end loop;

  return v_avisados;
end;
$funcao$;

comment on function public.avisar_versao_nova(text) is
  'D45 (contrato v7, § 10): enfileira o push versao_nova para todos os perfis ativos com aparelho. Só admin ou sistema. Devolve quantos foram enfileirados agora (a repetição da mesma versão devolve 0).';

revoke execute on function public.avisar_versao_nova(text) from public, anon;
grant execute on function public.avisar_versao_nova(text) to authenticated, service_role;
