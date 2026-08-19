@echo off
rem ============================================================================
rem  dev.bat - controle do ambiente local do Snake Thai (Windows)
rem  Uso:  scripts\dev.bat [start^|stop^|restart^|status]
rem
rem  App:           Expo (roda NATIVO no host - exige Android Studio/JDK).
rem  Backend local: Supabase CLI, que gerencia o proprio stack Docker.
rem  Por isso NAO ha docker-compose.yml proprio: a Supabase CLI ja orquestra
rem  Postgres, Auth, Storage, etc., e um compose paralelo causaria conflito.
rem ============================================================================
setlocal
cd /d "%~dp0\.."

set "ACAO=%~1"
if "%ACAO%"=="" set "ACAO=start"

where supabase >nul 2>nul
if %errorlevel%==0 ( set "HAS_SUPABASE=1" ) else ( set "HAS_SUPABASE=0" )

if /i "%ACAO%"=="start"   goto start
if /i "%ACAO%"=="stop"    goto stop
if /i "%ACAO%"=="restart" goto restart
if /i "%ACAO%"=="status"  goto status

echo Uso: scripts\dev.bat [start^|stop^|restart^|status]
exit /b 1

:start
if "%HAS_SUPABASE%"=="1" ( supabase start ) else ( echo [aviso] Supabase CLI nao encontrado - subindo apenas o app Expo. )
call npm start
goto fim

:stop
if "%HAS_SUPABASE%"=="1" ( supabase stop )
goto fim

:restart
if "%HAS_SUPABASE%"=="1" ( supabase stop ^& supabase start )
call npm start
goto fim

:status
if "%HAS_SUPABASE%"=="1" ( supabase status ) else ( echo Supabase CLI nao instalado. )
goto fim

:fim
endlocal
