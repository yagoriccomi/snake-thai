# Documentação — Snake Thai

Ponto de entrada da documentação técnica e operacional do projeto.

## Para quem administra a academia

- **[MANUAL-DO-ADMINISTRADOR.md](MANUAL-DO-ADMINISTRADOR.md)** — como operar o
  sistema pelo celular, passo a passo. Não exige conhecimento técnico.

## Para desenvolvedores

- **[ARQUITETURA.md](ARQUITETURA.md)** — as três camadas, RLS, Edge Functions e
  as decisões que surpreendem (comece por aqui se acabou de chegar).
- **[EDGE-FUNCTIONS.md](EDGE-FUNCTIONS.md)** — contrato de entrada/saída e
  autorização das funções server-side.
- **[RUNBOOK.md](RUNBOOK.md)** — operações: migrations, tipos, Metro, APK, chaves.
- **[VERSIONAMENTO.md](VERSIONAMENTO.md)** — quando a versão muda, versionCode e como publicar um APK.
- **[PUBLICACAO-1.7.0.md](PUBLICACAO-1.7.0.md)** — roteiro único para levar a 1.7.0 à produção (banco, funções, APK, reinstalação).
- **[PAINEL.md](PAINEL.md)** — regras dos números do Painel do admin e do relatório de inadimplência.
- **[NOTIFICACOES.md](NOTIFICACOES.md)** — notificações push: quem recebe o quê, publicação e monitoramento.
- **[BACKEND.md](BACKEND.md)** — spec do backend próprio do app (Render): arquitetura híbrida com o Supabase, estrutura extensível por módulos, cold start e o módulo de comprovantes (Cloudinary).
- **[../README.md](../README.md)** — instalar, configurar `.env.dev`/`.env.prod` e rodar.
- **[../CHANGELOG.md](../CHANGELOG.md)** — o que mudou em cada versão publicada.

## Auditorias e conformidade

- **[../REVIEW.md](../REVIEW.md)** — auditoria de código, segurança e LGPD.
- **[../SECURITY.md](../SECURITY.md)** — pentest com exploração real.
- **[../LICENSE_AUDIT.md](../LICENSE_AUDIT.md)** — risco jurídico das licenças.
- **[A11Y.md](A11Y.md)** — acessibilidade e contraste (WCAG).

## Planejamento

- **[FUNCIONALIDADES.md](FUNCIONALIDADES.md)** — checklist do que existe, do que
  falta e da prioridade de cada função.
