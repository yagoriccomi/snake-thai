# Documentos legais

> ⚠️ **Texto aprovado, ainda não publicado.** O conteúdo foi aprovado pelo dono da
> academia em 2026-09-18. O que a academia precisa dizer de si (razão social, CNPJ,
> prazos, foro) **não vive mais neste arquivo**: são marcadores `{{chave}}`,
> preenchidos pelo admin no app, em **Dados → Dados dos termos e da política**. O
> banco monta o texto ao publicar e **recusa** publicar com marcador sobrando.

| Documento | Arquivo | Marcadores |
|---|---|---|
| Política de Privacidade | [`POLITICA-DE-PRIVACIDADE.md`](POLITICA-DE-PRIVACIDADE.md) | 13 |
| Termos de Uso | [`TERMOS-DE-USO.md`](TERMOS-DE-USO.md) | 5 |

São 15 chaves distintas (razão social, CNPJ e canal de contato aparecem nos dois).
A tela do app lista todas com ajuda em português, e um teste garante que nenhum
marcador do texto fica sem campo na tela — nem o contrário.

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

## Como publicar

O texto vive no repositório; os dados da academia vivem no banco de cada
instalação. Por isso a publicação tem três etapas.

**1. O esquema e o modelo vão para produção.** Se o texto mudou, gere a migration
do modelo e abra PR — é o diff do texto que se revisa:

```
npm run legal:modelo -- politica
npm run legal:modelo -- termos
```

Publique junto das demais migrations e instale o APK com a tela "Dados dos termos".

**2. A academia preenche e confere.** No app, em *Dados → Dados dos termos e da
política*, o admin preenche os 15 campos e usa "Ver Política de Privacidade" e
"Ver Termos de Uso" para ler o texto exatamente como ficará. O que faltar aparece
entre chaves duplas.

**3. Publicar a versão.** A migration de publicação tem uma linha só; o texto é
montado no banco de destino, com os valores daquela academia:

```
npm run legal:publicar -- politica 1.0
npm run legal:publicar -- termos 1.0
```

Depois: `scripts\db-dev test`, PR, merge e `scripts\db-push-prod.bat`.

Se faltar qualquer campo, a publicação falha em voz alta e nada é gravado.
Publicou: **todos** aceitam de novo na próxima abertura do app.

## Como corrigir um texto já publicado

Documento publicado **não muda**: o aceite de cada pessoa aponta para o texto que ela
leu — e isso vale também para os dados da academia: trocar o CNPJ na tela **não**
reescreve o documento já aceito. Para corrigir, publique **outra versão** (por exemplo,
`1.1`). Todos aceitam de novo.

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
