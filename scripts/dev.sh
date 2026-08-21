#!/usr/bin/env bash
# ============================================================================
#  dev.sh — controle do ambiente local do Snake Thai (Linux/Mac)
#  Uso:  ./scripts/dev.sh [start|stop|restart|status]
#
#  App:          Expo (roda NATIVO no host — exige Android Studio/JDK ou Xcode).
#  Backend local: Supabase CLI, que gerencia o próprio stack Docker.
#  Por isso NÃO há docker-compose.yml próprio: a Supabase CLI já orquestra
#  Postgres, Auth, Storage, etc., e um compose paralelo causaria conflito.
#  Torne executável uma vez:  chmod +x scripts/dev.sh
# ============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."

ACAO="${1:-start}"

has_supabase() { command -v supabase >/dev/null 2>&1; }

case "$ACAO" in
  start)
    if has_supabase; then supabase start; else
      echo "[aviso] Supabase CLI não encontrado — subindo apenas o app Expo."
    fi
    npx expo start
    ;;
  stop)
    if has_supabase; then supabase stop; fi
    ;;
  restart)
    if has_supabase; then supabase stop && supabase start; fi
    npx expo start
    ;;
  status)
    if has_supabase; then supabase status; else echo "Supabase CLI não instalado."; fi
    ;;
  *)
    echo "Uso: ./scripts/dev.sh [start|stop|restart|status]"
    exit 1
    ;;
esac
