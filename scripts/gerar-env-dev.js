#!/usr/bin/env node
/**
 * Gera o .env.dev do app a partir do Supabase LOCAL em execução
 * (`npx supabase status`). Não imprime a chave: ela vai direto para o arquivo,
 * que o .gitignore bloqueia.
 *
 * Também escreve as contas de teste do seed local (EXPO_PUBLIC_DEV_CONTAS e
 * EXPO_PUBLIC_DEV_SENHA), que alimentam o atalho de login do app DEV: elas
 * saem do próprio seed e ficam só neste arquivo, bloqueado pelo .gitignore.
 *
 * Preserva o que é escolhido à mão num .env.dev existente: EXPO_PUBLIC_API_URL
 * (o snake-server local só é usado com a Cloudinary de dev configurada),
 * EXPO_PUBLIC_SENTRY_DSN (monitoramento de erros, opcional) e EAS_PROJECT_ID
 * (sem ele o app DEV volta a dizer que notificação é indisponível, e descobrir
 * isso leva um build de vários minutos).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { lerEnv } = require('./with-variant');

const ARQUIVO = path.join(__dirname, '..', '.env.dev');
const SEED = path.join(__dirname, '..', 'supabase', 'seed', 'local_base.sql');

/** Papel de cada conta do seed, na ordem em que o atalho as mostra. */
const CONTAS_DO_SEED = [
  { papel: 'admin', email: 'adm@snake.com' },
  { papel: 'professor', email: 'professor@snake.com' },
  { papel: 'aluno', email: 'aluno@snake.com' },
];

/**
 * Contas de teste para o atalho de login do app DEV.
 *
 * A senha sai do próprio seed: nunca é digitada aqui e continua valendo depois
 * de qualquer `db-dev reset`. Se o seed mudar de formato, o atalho simplesmente
 * não aparece — nada quebra.
 *
 * @returns {{ contas: string, senha: string }}
 */
function lerContasDoSeed() {
  if (!fs.existsSync(SEED)) {
    return { contas: '', senha: '' };
  }
  const sql = fs.readFileSync(SEED, 'utf8');
  const senha = /crypt\('([^']+)'/.exec(sql)?.[1] ?? '';
  if (senha === '') {
    return { contas: '', senha: '' };
  }
  const presentes = CONTAS_DO_SEED.filter((conta) => sql.includes(conta.email));
  return {
    contas: presentes.map((conta) => `${conta.papel}:${conta.email}`).join('|'),
    senha,
  };
}

function lerStatus() {
  const saida = execSync('npx --no-install supabase status -o json', {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  // A CLI pode escrever avisos antes do JSON.
  const inicio = saida.indexOf('{');
  const status = JSON.parse(saida.slice(inicio));
  const url = status.API_URL;
  const chave = status.ANON_KEY;
  if (!url || !chave) {
    throw new Error('supabase status não trouxe API_URL e ANON_KEY. O banco local está no ar? (scripts\\db-dev start)');
  }
  return { url, chave };
}

/**
 * Monta o conteúdo do .env.dev preservando as escolhas manuais do arquivo atual.
 *
 * @param {{ url: string, chave: string, anterior?: Record<string, string> }} dados
 * @returns {string}
 */
function montarConteudo({ url, chave, anterior = {} }) {
  const apiUrl = anterior.EXPO_PUBLIC_API_URL ?? '';
  const sentryDsn = anterior.EXPO_PUBLIC_SENTRY_DSN ?? '';
  const easProjectId = anterior.EAS_PROJECT_ID ?? '';
  const { contas, senha } = lerContasDoSeed();

  return [
    '# Gerado por scripts/gerar-env-dev.js — app "DEV Snake Thai" contra o banco LOCAL.',
    '# Nunca coloque aqui endereço de produção: o build e o app recusam.',
    `EXPO_PUBLIC_SUPABASE_URL=${url}`,
    `EXPO_PUBLIC_SUPABASE_ANON_KEY=${chave}`,
    '# snake-server local (ex.: http://127.0.0.1:3000). Vazio: comprovante vai para o Storage local',
    '# e o anexo de justificativa fica indisponível.',
    `EXPO_PUBLIC_API_URL=${apiUrl}`,
    '# Monitoramento de erros (Sentry). Vazio: desligado. Ver docs/RUNBOOK.md.',
    `EXPO_PUBLIC_SENTRY_DSN=${sentryDsn}`,
    '# Projeto Expo (push). Vazio: o app diz que notificação é indisponível.',
    '# Ver docs/NOTIFICACOES.md.',
    `EAS_PROJECT_ID=${easProjectId}`,
    '# Atalho de login do app DEV: contas do seed local. Só existe aqui, nunca no Git,',
    '# e o app de produção ignora mesmo que a variável apareça.',
    `EXPO_PUBLIC_DEV_CONTAS=${contas}`,
    `EXPO_PUBLIC_DEV_SENHA=${senha}`,
    '',
  ].join('\n');
}

function principal() {
  const { url, chave } = lerStatus();
  const anterior = fs.existsSync(ARQUIVO) ? lerEnv(fs.readFileSync(ARQUIVO, 'utf8')) : {};

  fs.writeFileSync(ARQUIVO, montarConteudo({ url, chave, anterior }));
  console.log(`.env.dev gerado para ${url}`);
}

if (require.main === module) {
  try {
    principal();
  } catch (erro) {
    console.error(`[gerar-env-dev] ${erro.message}`);
    process.exit(1);
  }
}

module.exports = { montarConteudo };
