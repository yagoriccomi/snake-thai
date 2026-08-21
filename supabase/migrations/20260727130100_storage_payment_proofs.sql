-- ============================================================================
-- Snake Thai — Storage: bucket de comprovantes de pagamento (PIX)
-- ----------------------------------------------------------------------------
-- Provisiona um bucket PRIVADO e políticas de RLS baseadas no caminho do
-- arquivo. Convenção de caminho: "<auth.uid()>/<arquivo>", de modo que cada
-- aluno só acessa a própria pasta. Admins acessam tudo.
--
-- LGPD: comprovantes contêm dados financeiros pessoais → bucket privado, sem
-- URL pública, acesso mediado por RLS e URLs assinadas de curta duração [#63].
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Bucket privado
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('payment_proofs', 'payment_proofs', false)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 2. Políticas de RLS sobre storage.objects
--    storage.foldername(name)[1] = primeira pasta do caminho = auth.uid().
-- ----------------------------------------------------------------------------

-- SELECT: aluno lê apenas os arquivos da própria pasta; admin lê todos.
create policy "payment_proofs_select_own_or_admin"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'payment_proofs'
    and (
      (select auth.uid())::text = (storage.foldername(name))[1]
      or public.is_admin()
    )
  );

-- INSERT (upload): aluno só envia para a própria pasta.
create policy "payment_proofs_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'payment_proofs'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

-- UPDATE (reenvio/substituição do comprovante): aluno só na própria pasta; admin em tudo.
create policy "payment_proofs_update_own_or_admin"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'payment_proofs'
    and (
      (select auth.uid())::text = (storage.foldername(name))[1]
      or public.is_admin()
    )
  )
  with check (
    bucket_id = 'payment_proofs'
    and (
      (select auth.uid())::text = (storage.foldername(name))[1]
      or public.is_admin()
    )
  );

-- DELETE: apenas admin (retenção/auditoria dos comprovantes).
create policy "payment_proofs_delete_admin"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'payment_proofs'
    and public.is_admin()
  );
