@echo off
setlocal enableextensions
title Snake Thai - Painel de Automacao
color 0A
rem Ancora o script na propria pasta (raiz do projeto).
cd /d "%~dp0"

rem --- Resolve o adb: PATH -> ANDROID_HOME -> ANDROID_SDK_ROOT -> LocalAppData.
set "ADB="
where adb >nul 2>&1 && set "ADB=adb"
if not defined ADB if exist "%ANDROID_HOME%\platform-tools\adb.exe" set "ADB=%ANDROID_HOME%\platform-tools\adb.exe"
if not defined ADB if exist "%ANDROID_SDK_ROOT%\platform-tools\adb.exe" set "ADB=%ANDROID_SDK_ROOT%\platform-tools\adb.exe"
if not defined ADB if exist "%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"

rem --- Resolve o JDK do Android Studio (JBR): mais estavel p/ builds nativos.
set "JBR="
if exist "%ProgramFiles%\Android\Android Studio\jbr\bin\java.exe" set "JBR=%ProgramFiles%\Android\Android Studio\jbr"
if not defined JBR if exist "%LOCALAPPDATA%\Programs\Android Studio\jbr\bin\java.exe" set "JBR=%LOCALAPPDATA%\Programs\Android Studio\jbr"

rem --- Porta do Metro. Fonte unica da verdade para TODO o fluxo: servidor,
rem     resource embutido no APK e deep link do aparelho. A 8081 (padrao do
rem     React Native) conflita com qualquer outro projeto RN aberto na maquina.
set "METRO_PORT=6969"

rem --- Variante do app: "dev" (DEV Snake Thai, banco LOCAL) ou "prod" (o app das
rem     pessoas, banco de PRODUCAO). O menu abre em DEV: e o app de trabalho do
rem     dia a dia; gerar o de producao e escolha consciente, pela opcao [V].
rem     Cada variante e outro pacote Android, entao a pasta android/ guarda em
rem     android\.variante para qual delas foi gerada.
set "VARIANTE=dev"
call :APLICA_VARIANTE

rem --- Alvo ADB unico da sessao. Toda ferramenta Android (adb, expo, gradle)
rem     respeita ANDROID_SERIAL, entao "more than one device" nao acontece.
set "ANDROID_SERIAL="
set "DEV_COUNT=0"

rem --- Modo diagnostico nao-interativo:  menu.bat --device
rem     Imprime qual aparelho seria eleito, sem abrir o menu.
if /i "%~1"=="--device" goto DIAG_DEVICE
if /i "%~1"=="--build" goto DIAG_BUILD
if /i "%~1"=="--variant" goto DIAG_VARIANT

:MENU
cls
echo ===================================================
echo           S N A K E   T H A I   -   PAINEL
echo ===================================================
echo   Variante: %VARIANTE_ROTULO%
echo   Metro: porta %METRO_PORT%
if defined ANDROID_SERIAL echo   Alvo ADB: %ANDROID_SERIAL%
echo.
echo    [V] Alternar variante DEV / PROD
echo.
echo   -- DESENVOLVIMENTO --
echo    [1] Iniciar Expo (Dev Client + cache limpo)
echo    [3] Rodar Testes
echo    [4] Checar Tipagem (TypeScript)
echo.
echo   -- DISPOSITIVO (ADB Wi-Fi) --
echo    [2] Conectar (mDNS automatico)
echo    [7] Emparelhar 1a vez (Pair)
echo    [D] Desconectar conexoes de rede duplicadas
echo.
echo   -- BUILD / INSTALACAO --
echo    [P] Preparar projeto nativo (prebuild)  ^<- rode se faltar a pasta android
echo    [8] Gerar APK  Debug/Dev
echo    [5] Gerar APK  Release
echo    [9] Instalar APK no aparelho
echo.
echo   -- BANCO LOCAL (Supabase em Docker, so para o DEV) --
echo    [B] Subir banco local          [S] Parar banco local
echo    [R] Recriar com dados de demo  [T] Testes SQL
echo.
echo   -- MANUTENCAO --
echo    [6] Limpeza Profunda (cache + build)
echo.
echo    [0] Sair
echo ===================================================
set "OPT="
set /p "OPT=Escolha uma opcao: "

if /i "%OPT%"=="V" goto TROCA_VARIANTE
if /i "%OPT%"=="B" goto DB_START
if /i "%OPT%"=="S" goto DB_STOP
if /i "%OPT%"=="R" goto DB_RESET
if /i "%OPT%"=="T" goto DB_TEST
if /i "%OPT%"=="P" goto PREBUILD
if /i "%OPT%"=="D" goto DISCONNECT
if "%OPT%"=="1" goto EXPO
if "%OPT%"=="2" goto ADB
if "%OPT%"=="3" goto TESTS
if "%OPT%"=="4" goto TSC
if "%OPT%"=="5" goto APK_RELEASE
if "%OPT%"=="6" goto CLEAN
if "%OPT%"=="7" goto PAIR
if "%OPT%"=="8" goto APK_DEBUG
if "%OPT%"=="9" goto INSTALL
if "%OPT%"=="0" goto END

echo.
echo  [!] Opcao invalida. Tente novamente.
timeout /t 2 >nul
goto MENU

rem ---------------------------------------------------------------------------
:EXPO
cls
echo [1] Iniciando o servidor Expo em modo Dev Client (cache limpo)...
echo     (encerre com Ctrl+C para voltar ao menu)
echo.
call :PICK_DEVICE
if defined ANDROID_SERIAL (
    echo  [i] Alvo ADB fixado: %ANDROID_SERIAL%
) else (
    echo  [i] Nenhum aparelho no adb - o Expo vai servir apenas pelo QR Code.
)
call :CHECK_ENV
call :CHECK_DB
call :FREE_PORT
call :ADB_REVERSE
echo  [i] Metro na porta %METRO_PORT%, variante %VARIANTE_ROTULO%.
echo.
call node scripts\with-variant.js %VARIANTE% -- npx expo start --dev-client -c --port %METRO_PORT%
pause
goto MENU

rem ---------------------------------------------------------------------------
:ADB
cls
echo [2] Conectando ao aparelho via ADB over Wi-Fi (mDNS)...
echo.
if not defined ADB (
    echo  [!] 'adb' nao encontrado - nem no PATH, nem no SDK do Android.
    echo      Verifique ANDROID_HOME ou instale o Android Platform-Tools.
    echo.
    pause
    goto MENU
)
echo  [i] Usando adb: %ADB%
echo.

rem Se ja ha aparelho online, NAO abrir uma segunda conexao para o mesmo
rem celular - era exatamente isso que produzia o "more than one device".
call :PICK_DEVICE
if defined ANDROID_SERIAL (
    echo  [OK] Aparelho ja conectado: %ANDROID_SERIAL%
    echo       Nenhuma conexao nova aberta - evita duplicidade.
    echo.
    echo === adb devices ===
    "%ADB%" devices
    echo.
    pause
    goto MENU
)

set "MDNS=%TEMP%\snk_mdns.txt"
"%ADB%" mdns services > "%MDNS%" 2>&1

rem Pega o IP:PORTA do primeiro servico "_adb-tls-connect" anunciado na rede.
rem Nada de IP fixo no codigo: o aparelho troca de porta a cada reinicio.
set "TARGET="
for /f "usebackq tokens=1,2,3" %%a in ("%MDNS%") do (
    if not defined TARGET (
        echo %%b| findstr /c:"_adb-tls-connect" >nul && set "TARGET=%%c"
    )
)

if defined TARGET (
    echo  [^>] Servico encontrado: %TARGET%
    echo.
    "%ADB%" connect %TARGET%
) else (
    echo  [!] Nenhum servico "_adb-tls-connect" anunciado via mDNS.
    echo      Saida crua de "adb mdns services":
    echo  ---------------------------------------------------------
    type "%MDNS%"
    echo  ---------------------------------------------------------
    echo      Aparelho na MESMA rede Wi-Fi + "Depuracao por Wi-Fi" ATIVADA.
    echo      Na 1a vez, pareie pela opcao [7] deste menu.
)
echo.
call :PICK_DEVICE
echo === adb devices ===
"%ADB%" devices
echo.
pause
goto MENU

rem ---------------------------------------------------------------------------
:DISCONNECT
cls
echo [D] Encerrando as conexoes de rede do ADB...
echo.
if not defined ADB (
    echo  [!] 'adb' nao encontrado.
    echo.
    pause
    goto MENU
)
"%ADB%" disconnect
set "ANDROID_SERIAL="
echo  [OK] Conexoes de rede encerradas (o cabo USB continua ativo).
echo       Use a opcao [2] para reconectar por Wi-Fi.
echo.
echo === adb devices ===
"%ADB%" devices
echo.
pause
goto MENU

rem ---------------------------------------------------------------------------
:TESTS
cls
echo [3] Rodando a suite de testes...
echo.
call npm run test
pause
goto MENU

rem ---------------------------------------------------------------------------
:TSC
cls
echo [4] Checando a tipagem (TypeScript, sem emitir arquivos)...
echo.
call npx tsc --noEmit
if errorlevel 1 (
    echo.
    echo  [!] Foram encontrados erros de tipagem.
) else (
    echo.
    echo  [OK] Nenhum erro de tipagem.
)
pause
goto MENU

rem ---------------------------------------------------------------------------
:PREBUILD
cls
echo [P] Preparando o projeto nativo (expo prebuild) - %VARIANTE_ROTULO%...
echo     Gera a pasta 'android' exigida pelos builds via Gradle ([8] e [5]).
echo.
call :CHECK_ENV
call :SET_JDK
echo  [i] JAVA_HOME: %JAVA_HOME%
echo.
call :LE_VARIANTE_ANDROID
set "LIMPAR="
if exist "android\gradlew.bat" if /i not "%VARIANTE_ANDROID%"=="%VARIANTE%" set "LIMPAR=--clean"
if defined LIMPAR (
    echo  [i] A pasta 'android' e da variante "%VARIANTE_ANDROID%"; vou regenerar do zero
    echo      para "%VARIANTE%" - muda o pacote, o nome, o icone e o manifesto.
    echo.
) else if exist "android\gradlew.bat" (
    echo  [i] A pasta 'android' ja e desta variante.
    echo.
)
rem android/ nao e versionada: o aviso de "alteracoes nao commitadas" do
rem --clean nao protege nada aqui e so travaria o menu numa pergunta.
set "EXPO_NO_GIT_STATUS=1"
call node scripts\with-variant.js %VARIANTE% -- npx expo prebuild --platform android %LIMPAR%
set "EXPO_NO_GIT_STATUS="
if exist "android\gradlew.bat" >"android\.variante" echo %VARIANTE%
echo.
rem O prebuild regenera android/ do zero e apaga a porta customizada.
call :ENSURE_PORT_PROP
if exist "android\gradlew.bat" (
    echo  [OK] Projeto nativo pronto! Agora use [8] Debug, depois [9] Instalar.
) else (
    echo  [!] O prebuild nao gerou a pasta 'android'. Veja o log acima.
)
pause
goto MENU

rem ---------------------------------------------------------------------------
:APK_RELEASE
cls
echo [5] Gerando APK de RELEASE via Gradle - %VARIANTE_ROTULO%...
echo.
call :CHECK_ENV
rem A pasta android/ guarda versionCode e versionName do ultimo prebuild.
rem Conferir antes evita 15 minutos de build com a versao errada.
call node scripts\version.js check --android --variant %VARIANTE%
if errorlevel 1 (
    echo.
    echo  [!] Versao inconsistente - nada foi compilado. Veja a mensagem acima.
    pause
    goto MENU
)
call :GRADLE_BUILD assembleRelease release
if "%BUILD_RESULT%"=="0" call :VERIFY_SIGNATURE
pause
goto MENU

rem ---------------------------------------------------------------------------
:APK_DEBUG
cls
echo [8] Gerando APK de DEVELOPMENT/DEBUG via Gradle - %VARIANTE_ROTULO%...
echo.
call :CHECK_ENV
call :GRADLE_BUILD assembleDebug debug
pause
goto MENU

rem ---------------------------------------------------------------------------
:INSTALL
cls
echo [9] Instalando o APK no aparelho...
echo.
if not defined ADB (
    echo  [!] 'adb' nao encontrado. Verifique ANDROID_HOME ou o Platform-Tools.
    echo.
    pause
    goto MENU
)
set "DEBUG_APK=%CD%\android\app\build\outputs\apk\debug\app-debug.apk"
set "RELEASE_APK=%CD%\android\app\build\outputs\apk\release\app-release.apk"
set "APK="
rem So o que foi compilado PARA esta variante: instalar o APK da outra
rem colocaria o app no pacote errado, falando com o banco errado.
call :LE_VARIANTE_ANDROID
if /i "%VARIANTE_ANDROID%"=="%VARIANTE%" if exist "%DEBUG_APK%" set "APK=%DEBUG_APK%"
if /i "%VARIANTE_ANDROID%"=="%VARIANTE%" if not defined APK if exist "%RELEASE_APK%" set "APK=%RELEASE_APK%"
rem Senao, o release mais recente desta variante ("snake-thai-v*" nao pega
rem "snake-thai-dev-v*": o -v vem logo depois do prefixo).
if not defined APK for /f "delims=" %%a in ('dir /b /o-d "%CD%\release\%PREFIXO_APK%-v*.apk" 2^>nul') do if not defined APK set "APK=%CD%\release\%%a"
if not defined APK (
    echo  [!] Nenhum APK da variante %VARIANTE_ROTULO% encontrado.
    echo      Gere primeiro pela opcao [8] Debug ou [5] Release.
    echo.
    pause
    goto MENU
)
echo  [i] APK selecionado: %APK%
echo.

call :PICK_DEVICE
if not defined ANDROID_SERIAL (
    echo  [!] Nenhum aparelho ONLINE no adb.
    echo      Conecte pela opcao [2] ou pelo cabo USB e tente de novo.
    echo      Se aparecer "unauthorized", aceite o aviso na tela do celular.
    echo.
    "%ADB%" devices
    echo.
    pause
    goto MENU
)

echo  [^>] Instalando em: %ANDROID_SERIAL%
echo.
"%ADB%" -s "%ANDROID_SERIAL%" install -r "%APK%"
set "INSTALL_RESULT=%ERRORLEVEL%"
echo.
if "%INSTALL_RESULT%"=="0" (
    echo  [OK] APK instalado. Abra o app "%NOME_DO_APP%" no aparelho.
    call :ADB_REVERSE
) else (
    echo  [!] A instalacao falhou. Codigo de saida: %INSTALL_RESULT%
    echo      Causas comuns:
    echo      - INSTALL_FAILED_UPDATE_INCOMPATIBLE: desinstale a versao antiga antes.
    echo      - INSTALL_FAILED_INSUFFICIENT_STORAGE: libere espaco no aparelho.
    echo      - unauthorized: aceite o aviso de depuracao na tela do celular.
)
call :CHECK_ENV
pause
goto MENU

rem ---------------------------------------------------------------------------
:PAIR
cls
echo [7] Emparelhar ADB - Wi-Fi Pairing (necessario na 1a vez)...
echo.
if not defined ADB (
    echo  [!] 'adb' nao encontrado. Verifique ANDROID_HOME ou o Platform-Tools.
    echo.
    pause
    goto MENU
)
echo  No aparelho: Depuracao por Wi-Fi ^> Parear com codigo.
echo  Ali aparecem o IP:PORTA de PAREAMENTO e um codigo de 6 digitos.
echo  ATENCAO: a porta de pareamento e DIFERENTE da porta de conexao.
echo.
set "PAIR_ADDR="
set /p "PAIR_ADDR=IP:Porta de pareamento (ex 192.168.15.120:37123): "
set "PAIR_CODE="
set /p "PAIR_CODE=Codigo de 6 digitos: "
echo.
if "%PAIR_ADDR%"=="" (
    echo  [!] Endereco vazio. Operacao cancelada.
    echo.
    pause
    goto MENU
)
echo  [^>] Executando: adb pair %PAIR_ADDR% %PAIR_CODE%
echo.
"%ADB%" pair %PAIR_ADDR% %PAIR_CODE%
echo.
echo === adb devices ===
"%ADB%" devices
echo.
pause
goto MENU

rem ---------------------------------------------------------------------------
:CLEAN
cls
echo [6] Limpeza Profunda - cache do Metro/Expo + build nativo...
echo.
echo  [^>] Limpando cache do Metro/Expo...
if exist ".expo" rmdir /s /q ".expo"
if exist "node_modules\.cache" rmdir /s /q "node_modules\.cache"
if exist "%TEMP%\metro-cache" rmdir /s /q "%TEMP%\metro-cache"
del /q "%TEMP%\haste-map-*" >nul 2>&1
del /q "%TEMP%\metro-*" >nul 2>&1
echo  [OK] Cache do Metro/Expo limpo.
echo.
if exist "android\gradlew.bat" (
    echo  [^>] Limpando build nativo - gradlew clean...
    call :SET_JDK
    pushd android
    call .\gradlew.bat clean
    popd
) else (
    echo  [i] Pasta 'android' nao existe - pulei o gradlew clean.
)
echo.
echo  [OK] Limpeza profunda concluida.
pause
goto MENU

rem ---------------------------------------------------------------------------
rem  Modo nao-interativo "menu.bat --build": gera o APK debug e sai. Mesmo
rem  caminho da opcao [8], util para scripts e para conferir o menu sem digitar.
:DIAG_BUILD
call :CHECK_ENV
call :GRADLE_BUILD assembleDebug debug
endlocal
exit /b 0

rem ---------------------------------------------------------------------------
rem  Modo diagnostico "menu.bat --device": mostra o alvo eleito e sai.
:DIAG_DEVICE
call :PICK_DEVICE
echo CONEXOES=%DEV_COUNT%
echo ALVO=%ANDROID_SERIAL%
echo PORTA_METRO=%METRO_PORT%
endlocal
exit /b 0

rem ---------------------------------------------------------------------------
rem  Modo diagnostico "menu.bat --variant": mostra a variante e o que ela usa.
:DIAG_VARIANT
call :LE_VARIANTE_ANDROID
echo VARIANTE=%VARIANTE%
echo APP=%NOME_DO_APP%
if exist "%ARQUIVO_ENV%" (echo ENV=%ARQUIVO_ENV% presente) else (echo ENV=%ARQUIVO_ENV% AUSENTE)
echo ANDROID=%VARIANTE_ANDROID%
endlocal
exit /b 0

rem ---------------------------------------------------------------------------
:TROCA_VARIANTE
if /i "%VARIANTE%"=="dev" (set "VARIANTE=prod") else (set "VARIANTE=dev")
call :APLICA_VARIANTE
cls
echo  [i] Variante agora: %VARIANTE_ROTULO%
if /i "%VARIANTE%"=="prod" (
    echo.
    echo  [!] ATENCAO: o app gerado nesta variante grava no banco de PRODUCAO.
)
echo.
call :LE_VARIANTE_ANDROID
if exist "android\gradlew.bat" if /i not "%VARIANTE_ANDROID%"=="%VARIANTE%" (
    echo  [i] A pasta 'android' e de outra variante: rode [P] antes de gerar APK.
    echo.
)
pause
goto MENU

rem ---------------------------------------------------------------------------
rem  BANCO LOCAL: atalhos para scripts\db-dev.bat. Tudo --local; producao nunca.
:DB_START
cls
echo [B] Subindo o Supabase local (portas 553xx)...
echo.
call scripts\db-dev.bat start
if not errorlevel 1 if not exist ".env.dev" (
    echo.
    echo  [i] Gerando o .env.dev do app a partir do banco local...
    call scripts\db-dev.bat env
)
pause
goto MENU

:DB_STOP
cls
echo [S] Parando o Supabase local...
echo.
call scripts\db-dev.bat stop
pause
goto MENU

:DB_RESET
cls
echo [R] Recriar o banco LOCAL com dados de demonstracao.
echo     Apaga TUDO o que estiver no banco local (producao nao e afetada).
echo.
set "CONFIRMA="
set /p "CONFIRMA=Digite S para continuar: "
if /i not "%CONFIRMA%"=="S" goto MENU
call scripts\db-dev.bat reset
pause
goto MENU

:DB_TEST
cls
echo [T] Testes SQL no banco LOCAL.
echo     Recria o banco local LIMPO antes (os dados de demo somem; use [R] depois).
echo.
set "CONFIRMA="
set /p "CONFIRMA=Digite S para continuar: "
if /i not "%CONFIRMA%"=="S" goto MENU
call scripts\db-dev.bat test
if errorlevel 1 (
    echo.
    echo  [!] Algum teste SQL falhou. Veja o log acima.
) else (
    echo.
    echo  [OK] Testes SQL verdes.
)
pause
goto MENU

rem ---------------------------------------------------------------------------
:END
cls
echo Ate a proxima. Bons treinos e bons commits!
timeout /t 2 >nul
endlocal
exit /b 0

rem ===========================================================================
rem  SUB-ROTINA: elege UM aparelho alvo e o exporta em ANDROID_SERIAL.
rem
rem  Por que existe: quando o mesmo celular aparece duas vezes no adb (cabo USB
rem  + Wi-Fi, ou duas conexoes de rede), qualquer comando adb sem "-s" aborta
rem  com "more than one device/emulator". Fixando ANDROID_SERIAL, TODO o
rem  ferramental Android (adb, expo, gradle) mira um alvo unico - o erro deixa
rem  de ser possivel.
rem
rem  Regra de decisao:
rem    0 conexoes -> ANDROID_SERIAL vazio (quem chama trata).
rem    1 conexao  -> usa ela.
rem    N conexoes -> compara o serial de hardware (ro.serialno) de cada uma:
rem                  mesmo aparelho -> decide sozinho (USB tem prioridade).
rem                  aparelhos dif. -> pergunta ao usuario, sem adivinhar.
rem  Um alvo ja eleito e mantido enquanto continuar online.
rem
rem  Saida: ANDROID_SERIAL, DEV_COUNT.
rem ===========================================================================
:PICK_DEVICE
setlocal enabledelayedexpansion
set "PICKED=%ANDROID_SERIAL%"
set "N=0"
set "USB_PICK="
set "HW_REF="
set "SAME_DEVICE=1"
if not defined ADB (
    set "PICKED="
    goto :PD_DONE
)
"%ADB%" start-server >nul 2>&1
set "DEVLIST=%TEMP%\snk_devices.txt"
"%ADB%" devices > "%DEVLIST%" 2>&1

rem Coleta so as conexoes ONLINE (estado exatamente "device"); ignora "offline",
rem "unauthorized" e "authorizing", que nao servem para instalar.
for /f "usebackq skip=1 tokens=1,2" %%a in ("%DEVLIST%") do (
    if "%%b"=="device" (
        set /a N+=1
        set "DEV_!N!=%%a"
    )
)

if !N! EQU 0 (
    set "PICKED="
    goto :PD_DONE
)

rem Mantem o alvo anterior enquanto ele estiver online (nao troca de aparelho
rem no meio de um ciclo build -> instala -> roda).
if defined PICKED (
    for /l %%i in (1,1,!N!) do if "!DEV_%%i!"=="!PICKED!" goto :PD_DONE
)

if !N! EQU 1 (
    set "PICKED=!DEV_1!"
    goto :PD_DONE
)

rem Mais de uma conexao: e o mesmo hardware falando por dois canais?
for /l %%i in (1,1,!N!) do call :DEV_PROBE %%i

if "!SAME_DEVICE!"=="1" (
    if defined USB_PICK (
        set "PICKED=!USB_PICK!"
    ) else (
        set "PICKED=!DEV_1!"
    )
    echo  [i] !N! conexoes do MESMO aparelho - usando !PICKED!.
    echo      ^(a opcao [D] do menu encerra as conexoes de rede duplicadas^)
    goto :PD_DONE
)

echo  [x] Ha !N! aparelhos DIFERENTES conectados:
for /l %%i in (1,1,!N!) do echo      [%%i] !DEV_%%i!
echo.
set "DEV_CHOICE="
set /p "DEV_CHOICE=Escolha o alvo (1-!N!, Enter = 1): "
if not defined DEV_CHOICE set "DEV_CHOICE=1"
call set "PICKED=%%DEV_!DEV_CHOICE!%%"
if not defined PICKED set "PICKED=!DEV_1!"
echo  [i] Alvo: !PICKED!

:PD_DONE
endlocal & set "ANDROID_SERIAL=%PICKED%" & set "DEV_COUNT=%N%"
goto :eof

rem ===========================================================================
rem  SUB-ROTINA: inspeciona a conexao de indice %1 (auxiliar de :PICK_DEVICE).
rem  Le o serial de hardware (para deduplicar) e classifica o canal (USB x rede).
rem  Roda dentro do escopo de :PICK_DEVICE - exige expansao atrasada ativa.
rem ===========================================================================
:DEV_PROBE
call set "PROBE_S=%%DEV_%1%%"
set "HWFILE=%TEMP%\snk_hw.txt"
"%ADB%" -s "!PROBE_S!" shell getprop ro.serialno > "%HWFILE%" 2>nul
set "PROBE_HW="
set /p "PROBE_HW=" < "%HWFILE%"

rem Serial terminado em ":porta" ou contendo "_adb-tls" = conexao de rede;
rem o resto e cabo USB, que tem prioridade por ser mais rapido e estavel.
echo !PROBE_S!| findstr /r /c:":[0-9][0-9]*$" /c:"_adb-tls" >nul
if errorlevel 1 if not defined USB_PICK set "USB_PICK=!PROBE_S!"

if not defined PROBE_HW (
    rem Sem resposta do getprop: nao da para provar que e o mesmo aparelho.
    set "SAME_DEVICE=0"
    goto :eof
)
if not defined HW_REF (
    set "HW_REF=!PROBE_HW!"
) else (
    if /i not "!PROBE_HW!"=="!HW_REF!" set "SAME_DEVICE=0"
)
goto :eof

rem ===========================================================================
rem  SUB-ROTINA: deriva nome do app, arquivo de ambiente e prefixo do APK da
rem  variante escolhida.
rem ===========================================================================
:APLICA_VARIANTE
if /i "%VARIANTE%"=="prod" (
    set "VARIANTE_ROTULO=PROD - banco de PRODUCAO"
    set "NOME_DO_APP=Snake Thai"
    set "ARQUIVO_ENV=.env.prod"
    set "PREFIXO_APK=snake-thai"
    color 0A
) else (
    set "VARIANTE_ROTULO=DEV - banco local"
    set "NOME_DO_APP=DEV Snake Thai"
    set "ARQUIVO_ENV=.env.dev"
    set "PREFIXO_APK=snake-thai-dev"
    color 0E
)
goto :eof

rem ===========================================================================
rem  SUB-ROTINA: le para qual variante a pasta android/ foi gerada.
rem  Saida: VARIANTE_ANDROID ("ausente" sem pasta; "desconhecida" sem marcador,
rem  caso de uma pasta gerada antes das variantes - tratada como diferente).
rem ===========================================================================
:LE_VARIANTE_ANDROID
set "VARIANTE_ANDROID=ausente"
if not exist "android\gradlew.bat" goto :eof
set "VARIANTE_ANDROID=desconhecida"
if exist "android\.variante" set /p VARIANTE_ANDROID=<"android\.variante"
goto :eof

rem ===========================================================================
rem  SUB-ROTINA: avisa se o arquivo de ambiente da variante estiver faltando.
rem  As variaveis EXPO_PUBLIC_* sao embutidas no bundle em tempo de build; sem
rem  elas o comando para (scripts\with-variant.js) antes de gerar um app quebrado.
rem ===========================================================================
:CHECK_ENV
if exist ".env" if not exist ".env.prod" (
    echo.
    echo  [!] Existe um .env antigo, que NAO e mais lido.
    echo      Se ele for o de producao, renomeie:  move .env .env.prod
)
if not exist "%ARQUIVO_ENV%" (
    echo.
    echo  [!] Arquivo %ARQUIVO_ENV% AUSENTE na raiz do projeto.
    if /i "%VARIANTE%"=="dev" (
        echo      Suba o banco local pela opcao [B]: ela gera o .env.dev.
    ) else (
        echo      Rode:  copy .env.example .env.prod    e preencha com os valores
        echo      do painel da Supabase de PRODUCAO.
    )
    echo.
)
goto :eof

rem ===========================================================================
rem  SUB-ROTINA: no DEV, avisa se o Supabase local nao estiver no ar - sem ele o
rem  app abre, mas toda tela da erro de rede.
rem ===========================================================================
:CHECK_DB
if /i not "%VARIANTE%"=="dev" goto :eof
docker ps --format "{{.Names}}" 2>nul | findstr /x /c:"supabase_kong_snake-thai" >nul 2>&1
if errorlevel 1 (
    echo  [!] O banco local nao esta no ar. Suba pela opcao [B] em outra janela.
)
goto :eof

rem ===========================================================================
rem  SUB-ROTINA: encaminha a porta do Metro para o aparelho (adb reverse).
rem  Ao abrir pelo icone, o app procura o dev server em localhost:<porta> - e
rem  "localhost", do lado do celular, e o proprio celular. O reverse faz esse
rem  localhost cair no PC. Funciona tanto por cabo quanto por ADB Wi-Fi.
rem ===========================================================================
:ADB_REVERSE
if not defined ADB goto :eof
if not defined ANDROID_SERIAL goto :eof
"%ADB%" -s "%ANDROID_SERIAL%" reverse tcp:%METRO_PORT% tcp:%METRO_PORT% >nul 2>&1
if errorlevel 1 (
    echo  [i] Nao consegui criar o adb reverse - abra o app pelo QR Code.
) else (
    echo  [i] adb reverse ativo: localhost:%METRO_PORT% do aparelho aponta para este PC.
)
rem O DEV fala com 127.0.0.1 (Supabase local 55321, snake-server local 3000).
rem Sem o reverse, esse endereco no celular e o proprio celular.
if /i not "%VARIANTE%"=="dev" goto :eof
"%ADB%" -s "%ANDROID_SERIAL%" reverse tcp:55321 tcp:55321 >nul 2>&1
if errorlevel 1 (
    echo  [!] Nao consegui criar o adb reverse do banco local - o app DEV fica sem dados.
    goto :eof
)
"%ADB%" -s "%ANDROID_SERIAL%" reverse tcp:3000 tcp:3000 >nul 2>&1
echo  [i] adb reverse do banco local ativo: portas 55321 e 3000.
goto :eof

rem ===========================================================================
rem  SUB-ROTINA: libera a porta do Metro antes de subir o servidor.
rem  Um Metro orfao de outra sessao segura a porta e o Expo, em modo nao
rem  interativo, simplesmente desiste ("Skipping dev server").
rem ===========================================================================
:FREE_PORT
set "PORT_PID="
for /f "tokens=5" %%p in ('netstat -ano -p TCP ^| findstr /c:"LISTENING" ^| findstr /c:":%METRO_PORT% "') do set "PORT_PID=%%p"
if defined PORT_PID (
    echo  [i] Porta %METRO_PORT% ocupada pelo PID %PORT_PID% - encerrando.
    taskkill /PID %PORT_PID% /F >nul 2>&1
)
goto :eof

rem ===========================================================================
rem  SUB-ROTINA: garante a porta do Metro no gradle.properties.
rem  A pasta android/ NAO e versionada (fluxo prebuild), entao um
rem  "expo prebuild --clean" apaga a configuracao. Aqui ela e reaplicada.
rem ===========================================================================
:ENSURE_PORT_PROP
if not exist "android\gradle.properties" goto :eof
findstr /c:"reactNativeDevServerPort" "android\gradle.properties" >nul 2>&1
if errorlevel 1 (
    echo.>> "android\gradle.properties"
    echo # Porta do Metro embutida no APK - reaplicada pelo menu.bat.>> "android\gradle.properties"
    echo reactNativeDevServerPort=%METRO_PORT%>> "android\gradle.properties"
    echo  [i] gradle.properties: reactNativeDevServerPort=%METRO_PORT% reaplicado.
)
goto :eof

rem ===========================================================================
rem  SUB-ROTINA: seleciona o JDK do Android Studio (JBR) para os builds.
rem ===========================================================================
:SET_JDK
if exist "%JBR%\bin\java.exe" set "JAVA_HOME=%JBR%"
goto :eof

rem ===========================================================================
rem  SUB-ROTINA: build de APK via Gradle (diretorio padrao do projeto).
rem  Uso:  call :GRADLE_BUILD <tarefa_gradle> <variante>
rem  Ex.:  call :GRADLE_BUILD assembleDebug debug
rem ===========================================================================
:GRADLE_BUILD
set "BUILD_RESULT="
if not exist "android\gradlew.bat" (
    echo  [!] A pasta nativa 'android' nao existe ainda.
    echo      Rode a opcao [P] Preparar projeto nativo antes de gerar o APK.
    goto :eof
)
rem Pasta de uma variante com o JS da outra = app de producao falando com o
rem banco local, ou o DEV com o de producao. Nao compila.
call :LE_VARIANTE_ANDROID
if /i not "%VARIANTE_ANDROID%"=="%VARIANTE%" (
    echo  [!] A pasta 'android' foi gerada para "%VARIANTE_ANDROID%", e a variante
    echo      escolhida e "%VARIANTE%". Rode a opcao [P] antes de gerar o APK.
    goto :eof
)
call :SET_JDK
call :ENSURE_PORT_PROP
echo  [i] JAVA_HOME: %JAVA_HOME%
set "PROOT=%CD%"
echo  [^>] Compilando %VARIANTE_ROTULO% (tarefa: %1)... na 1a vez demora varios minutos.
echo.
pushd android
rem -P garante a porta mesmo se o gradle.properties for regenerado. O
rem with-variant carrega o .env da variante: o bundle JS e montado aqui.
call node "%PROOT%\scripts\with-variant.js" %VARIANTE% -- .\gradlew.bat %1 -PreactNativeDevServerPort=%METRO_PORT%
set "BUILD_RESULT=%ERRORLEVEL%"
popd

echo.
if "%BUILD_RESULT%"=="0" (
    echo  [OK] APK gerado em:
    echo       %PROOT%\android\app\build\outputs\apk\%2\app-%2.apk
    if /i "%2"=="release" call :COPIA_RELEASE
) else (
    echo  [!] A compilacao falhou. Codigo de saida: %BUILD_RESULT%
    echo      Confira o log acima - JDK/JAVA_HOME, SDK/NDK, etc.
)
goto :eof

rem ===========================================================================
rem  SUB-ROTINA: mostra quem assinou o APK de release.
rem  No PROD, chave de debug e erro grave (e publica); no DEV, e o esperado.
rem  Ver docs\RELEASE-SIGNING.md.
rem ===========================================================================
:VERIFY_SIGNATURE
set "SDK_ANDROID=%ANDROID_HOME%"
if not defined SDK_ANDROID set "SDK_ANDROID=%LOCALAPPDATA%\Android\Sdk"
set "BUILD_TOOLS="
for /f "delims=" %%d in ('dir /b /ad /o-n "%SDK_ANDROID%\build-tools" 2^>nul') do if not defined BUILD_TOOLS set "BUILD_TOOLS=%%d"
set "APKSIGNER=%SDK_ANDROID%\build-tools\%BUILD_TOOLS%\apksigner.bat"
if not exist "%APKSIGNER%" (
    echo  [i] apksigner nao encontrado - confira a assinatura pelo docs\RELEASE-SIGNING.md.
    goto :eof
)
set "CERTIFICADO=%TEMP%\snk_certificado.txt"
call "%APKSIGNER%" verify --print-certs "%PROOT%\android\app\build\outputs\apk\release\app-release.apk" > "%CERTIFICADO%" 2>&1
echo.
findstr /c:"certificate DN" /c:"SHA-256 digest" "%CERTIFICADO%"
findstr /c:"CN=Android Debug" "%CERTIFICADO%" >nul
if errorlevel 1 goto :eof
if /i "%VARIANTE%"=="prod" (
    echo.
    echo  ###################################################################
    echo  [!] ASSINADO COM CHAVE DE DEBUG. NAO PUBLIQUE ESTE APK.
    echo  ###################################################################
) else (
    echo  [i] App DEV assinado com a chave de debug, como esperado.
)
goto :eof

rem ===========================================================================
rem  SUB-ROTINA: copia o APK de release para release\<prefixo>-v<nome do build>.apk.
rem  O nome do build vem de scripts\version.js: 1.7.0 so num build exatamente na
rem  tag; fora dela, 1.7.0+12.abc1234 (ou +dev. no app DEV, que nunca vai para
rem  o GitHub). Ver docs\VERSIONAMENTO.md.
rem ===========================================================================
:COPIA_RELEASE
set "NOME_DO_BUILD="
for /f "usebackq delims=" %%v in (`node "%PROOT%\scripts\version.js" build-name --variant %VARIANTE%`) do set "NOME_DO_BUILD=%%v"
if not defined NOME_DO_BUILD goto :eof
if not exist "%PROOT%\release" mkdir "%PROOT%\release"
copy /y "%PROOT%\android\app\build\outputs\apk\release\app-release.apk" "%PROOT%\release\%PREFIXO_APK%-v%NOME_DO_BUILD%.apk" >nul
echo       copia: release\%PREFIXO_APK%-v%NOME_DO_BUILD%.apk
goto :eof
