@echo off
rem ============================================================================
rem  db-dev.bat - banco LOCAL de desenvolvimento (Supabase CLI em Docker)
rem  Uso:  scripts\db-dev.bat [start^|stop^|status^|reset^|test^|types^|env^|funcoes]
rem
rem    start   sobe o Supabase local (portas 553xx)
rem    stop    para o Supabase local
rem    status  mostra URLs e chaves LOCAIS
rem    reset   recria o banco: migrations + base local + dados de demonstracao
rem    test    recria o banco LIMPO e roda todos os testes SQL de supabase\tests
rem    types   gera src\types\database.types.ts a partir do banco local
rem    env     gera o .env.dev do app apontando para o banco local
rem    funcoes serve as Edge Functions locais e FICA RODANDO (Ctrl+C encerra)
rem
rem  O `supabase start` NAO sobe as Edge Functions. Sem `funcoes` rodando,
rem  cadastrar aluno, cadastrar equipe, trocar e-mail e excluir conta falham
rem  no app DEV com "nao foi possivel", porque a funcao nao existe localmente.
rem
rem  Tudo aqui e --local. A CLI esta vinculada ao projeto de PRODUCAO, e um
rem  comando digitado sem --local poderia acertar o banco real. Producao so
rem  pelo scripts\db-push-prod.bat, com backup e dupla confirmacao.
rem ============================================================================
setlocal EnableExtensions
cd /d "%~dp0\.."

set "DB_CONTAINER=supabase_db_snake-thai"
set "ACAO=%~1"

if /i "%ACAO%"=="start"  goto start
if /i "%ACAO%"=="stop"   goto stop
if /i "%ACAO%"=="status" goto status
if /i "%ACAO%"=="reset"  goto reset
if /i "%ACAO%"=="test"   goto test
if /i "%ACAO%"=="types"  goto types
if /i "%ACAO%"=="env"    goto env
if /i "%ACAO%"=="funcoes" goto funcoes
echo Uso: scripts\db-dev.bat [start^|stop^|status^|reset^|test^|types^|env^|funcoes]
exit /b 1

:start
call npx --no-install supabase start
echo.
echo  [i] As Edge Functions NAO sobem com o banco. Para cadastrar aluno ou
echo      equipe no app DEV, abra outro terminal e rode: scripts\db-dev funcoes
exit /b %errorlevel%

:funcoes
rem Fica em primeiro plano de proposito: o log de cada chamada aparece aqui,
rem e e onde o erro da funcao aparece quando o cadastro falha.
call npx --no-install supabase functions serve
exit /b %errorlevel%

:stop
call npx --no-install supabase stop
exit /b %errorlevel%

:status
call npx --no-install supabase status
exit /b %errorlevel%

:reset
call npx --no-install supabase db reset --local
if errorlevel 1 exit /b 1
for %%f in (supabase\seed\local_base.sql supabase\seed\demo_seed.sql supabase\seed\demo_seed_historico.sql) do (
  echo.
  echo == %%f
  docker exec -i %DB_CONTAINER% psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < "%%f"
  if errorlevel 1 ( echo [ERRO] %%f falhou & exit /b 1 )
)
echo.
echo Banco local pronto com dados de demonstracao.
exit /b 0

:test
rem Banco LIMPO de proposito: alguns testes contam linhas do banco inteiro.
call npx --no-install supabase db reset --local
if errorlevel 1 exit /b 1
for %%f in (supabase\tests\*.sql) do (
  echo.
  echo == %%f
  docker exec -i %DB_CONTAINER% psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < "%%f"
  if errorlevel 1 ( echo [FALHOU] %%f & exit /b 1 )
)
echo.
echo Todos os testes SQL passaram.
exit /b 0

:types
rem Gera num arquivo temporario: se a CLI falhar, o arquivo versionado fica intacto.
call npx --no-install supabase gen types typescript --local > "%TEMP%\snake-db.types.ts"
if errorlevel 1 ( echo [ERRO] geracao de tipos falhou & exit /b 1 )
move /y "%TEMP%\snake-db.types.ts" "src\types\database.types.ts" >nul
echo Tipos gerados em src\types\database.types.ts
exit /b 0

:env
node scripts\gerar-env-dev.js
exit /b %errorlevel%
