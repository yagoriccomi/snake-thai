@echo off
rem ============================================================================
rem  db-push-prod.bat - aplica as migrations pendentes no banco de PRODUCAO
rem
rem  E o UNICO caminho para mudar o esquema de producao. A migration ja deve ter
rem  passado no banco local (scripts\db-dev test e reset) e estar na main.
rem
rem  Etapas, cada uma so depois da anterior:
rem    1. mostra o projeto vinculado e pede para digitar PRODUCAO
rem    2. backup (esquema e dados) FORA do repositorio - contem dados pessoais
rem    3. simulacao (db push --dry-run): lista o que seria aplicado
rem    4. pede para digitar APLICAR
rem    5. aplica e confere a lista de migrations
rem
rem  Exige SUPABASE_ACCESS_TOKEN no ambiente e pede a senha do banco (ou use
rem  SUPABASE_DB_PASSWORD). Nenhum dos dois fica gravado aqui.
rem ============================================================================
setlocal EnableExtensions
cd /d "%~dp0\.."

set "PASTA_BACKUP=%USERPROFILE%\snake-thai-backups"
set "REF="
if exist "supabase\.temp\project-ref" set /p REF=<"supabase\.temp\project-ref"
if not defined REF (
  echo [ERRO] Nenhum projeto vinculado. Rode: npx supabase link --project-ref ^<ref^>
  exit /b 1
)

echo.
echo  ATENCAO: isto altera o banco de PRODUCAO.
echo  Projeto vinculado: %REF%
echo.
set "CONFIRMA="
set /p "CONFIRMA=Digite PRODUCAO para continuar: "
if not "%CONFIRMA%"=="PRODUCAO" (
  echo Cancelado. Nada foi feito.
  exit /b 1
)

for /f "usebackq delims=" %%t in (`powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"`) do set "CARIMBO=%%t"
if not exist "%PASTA_BACKUP%" mkdir "%PASTA_BACKUP%"
echo.
echo == 1/4 Backup em %PASTA_BACKUP%
call npx --no-install supabase db dump --linked -f "%PASTA_BACKUP%\snake-prod-esquema-%CARIMBO%.sql"
if errorlevel 1 ( echo [ERRO] backup do esquema falhou - nada foi aplicado. & exit /b 1 )
call npx --no-install supabase db dump --linked --data-only -f "%PASTA_BACKUP%\snake-prod-dados-%CARIMBO%.sql"
if errorlevel 1 ( echo [ERRO] backup dos dados falhou - nada foi aplicado. & exit /b 1 )

echo.
echo == 2/4 Simulacao: o que seria aplicado
call npx --no-install supabase db push --linked --dry-run
if errorlevel 1 ( echo [ERRO] a simulacao falhou - nada foi aplicado. & exit /b 1 )

echo.
set "CONFIRMA="
set /p "CONFIRMA=Confira a lista acima. Digite APLICAR para aplicar em producao: "
if not "%CONFIRMA%"=="APLICAR" (
  echo Cancelado. Backup feito, nada aplicado.
  exit /b 1
)

echo.
echo == 3/4 Aplicando
call npx --no-install supabase db push --linked
if errorlevel 1 (
  echo [ERRO] o push falhou. O backup esta em %PASTA_BACKUP%\*-%CARIMBO%.sql
  exit /b 1
)

echo.
echo == 4/4 Migrations em producao
call npx --no-install supabase migration list --linked
echo.
echo Pronto. Se a mudanca envolveu Edge Function: npx supabase functions deploy ^<nome^>
exit /b 0
