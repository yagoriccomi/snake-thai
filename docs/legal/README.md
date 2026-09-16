# Documentos legais

> ⚠️ **Rascunhos, não publicados.** Os textos abaixo descrevem o app como ele é hoje,
> mas não passaram por aprovação da academia nem por assessoria jurídica. O que só a
> academia sabe está marcado com `[PREENCHER: …]`. O banco **recusa** publicar texto
> com essa marca.

| Documento | Arquivo | Campos em aberto |
|---|---|---|
| Política de Privacidade | [`POLITICA-DE-PRIVACIDADE.md`](POLITICA-DE-PRIVACIDADE.md) | Controlador, CNPJ, endereço, canal e encarregado, região da Cloudinary, base legal do dado de saúde, mecanismo de transferência internacional, prazos (mensalidades, comprovantes, auditoria, backups), menores de idade |
| Termos de Uso | [`TERMOS-DE-USO.md`](TERMOS-DE-USO.md) | Razão social, CNPJ, contrato de matrícula, contato, foro |

## Como o app usa estes textos

- **Primeiro acesso:** o onboarding mostra os links para ler e registra o aceite de
  cada documento vigente, com a versão, em `consents`.
- **Versão nova:** quem ainda não aceitou vê a tela "Termos atualizados" ao abrir o
  app e só continua depois de aceitar (ou sai da conta). Se a checagem falhar por
  falta de rede, o app abre e pergunta de novo na próxima vez.
- **Consulta:** Perfil → "Termos e privacidade" mostra o texto vigente e a data do
  seu aceite.
- **Enquanto nada for publicado,** o app se comporta como antes: só a caixa de
  concordância no primeiro acesso, sem registro.

### Formato do texto

O app entende só isto:

| Linha | Vira |
|---|---|
| `# Título` | Título do documento |
| `## Seção` | Título de seção |
| `- item` | Item de lista |
| linha em branco | Separa parágrafos |

Negrito, links e tabelas aparecem como texto puro.

## Como publicar (depois da aprovação)

1. **Preencher** todos os `[PREENCHER: …]` e validar o texto com a assessoria
   jurídica.
2. **Gerar a migration a partir do arquivo aprovado:**

   ```
   npm run legal:publicar -- politica 1.0
   npm run legal:publicar -- termos 1.0
   ```

   O script recusa texto com campo em aberto e cria
   `supabase/migrations/<data>_publicar_<tipo>_<versão>.sql`.
3. **Testar e revisar:** `scripts\db-dev test`, abrir o app DEV e conferir a tela de
   aceite. Depois, PR e merge.
4. **Publicar em produção** junto das demais migrations
   (`scripts\db-push-prod.bat`). A migration da L4 (`documentos_legais_aceite`)
   precisa ir antes.

Todos os usuários serão chamados a aceitar na próxima abertura do app.

## Como corrigir um texto já publicado

Documento publicado **não muda**: o aceite de cada pessoa aponta para o texto que ela
leu. Para corrigir, edite o arquivo e publique **outra versão** (por exemplo, `1.1`).
Todos aceitam de novo.

## Consultas úteis

Quem ainda não aceitou a versão vigente:

```sql
select p.name, p.role, d.kind, d.version
  from public.profiles p
 cross join public.legal_documents d
 where d.is_current
   and p.anonymized_at is null
   and not exists (select 1 from public.consents c where c.user_id = p.id and c.document_id = d.id)
 order by d.kind, p.name;
```

Aceites de uma pessoa (prova de consentimento, LGPD art. 8º):

```sql
select d.kind, d.version, d.published_at, c.accepted_at
  from public.consents c
  join public.legal_documents d on d.id = c.document_id
 where c.user_id = '<id da conta>'
 order by c.accepted_at;
```
