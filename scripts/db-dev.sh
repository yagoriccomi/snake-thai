#!/usr/bin/env bash
# ============================================================================
#  db-dev.sh — banco LOCAL de desenvolvimento (Supabase CLI em Docker)
#  Uso:  ./scripts/db-dev.sh [start|stop|status|reset|test|types|env]
#
#  Mesmos subcomandos do db-dev.bat. Tudo aqui é --local: a CLI está vinculada
#  ao projeto de PRODUÇÃO, e um comando sem --local poderia acertar o banco
#  real. Produção só pelo script de push com dupla confirmação.
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

DB_CONTAINER="supabase_db_snake-thai"
supabase() { npx --no-install supabase "$@"; }

rodar_sql() {
  echo
  echo "== $1"
  docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < "$1"
}

case "${1:-}" in
  start)  supabase start ;;
  stop)   supabase stop ;;
  status) supabase status ;;
  reset)
    supabase db reset --local
    for arquivo in supabase/seed/local_base.sql supabase/seed/demo_seed.sql supabase/seed/demo_seed_historico.sql; do
      rodar_sql "$arquivo"
    done
    echo "Banco local pronto com dados de demonstração."
    ;;
  test)
    # Banco LIMPO de propósito: alguns testes contam linhas do banco inteiro.
    supabase db reset --local
    for arquivo in supabase/tests/*.sql; do
      rodar_sql "$arquivo"
    done
    echo "Todos os testes SQL passaram."
    ;;
  types)
    temporario="$(mktemp)"
    supabase gen types typescript --local > "$temporario"
    mv "$temporario" src/types/database.types.ts
    echo "Tipos gerados em src/types/database.types.ts"
    ;;
  env) node scripts/gerar-env-dev.js ;;
  *)
    echo "Uso: ./scripts/db-dev.sh [start|stop|status|reset|test|types|env]"
    exit 1
    ;;
esac
