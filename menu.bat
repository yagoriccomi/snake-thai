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

rem --- Alvo ADB unico da sessao. Toda ferramenta Android (adb, expo, gradle)
rem     respeita ANDROID_SERIAL, entao "more than one device" nao acontece.
set "ANDROID_SERIAL="
set "DEV_COUNT=0"

rem --- Modo diagnostico nao-interativo:  menu.bat --device
rem     Imprime qual aparelho seria eleito, sem abrir o menu.
if /i "%~1"=="--device" goto DIAG_DEVICE
if /i "%~1"=="--build" goto DIAG_BUILD

:MENU
cls
echo ===================================================
echo             S N A K E   T H A I   -   DEV
echo ===================================================
echo   Metro: porta %METRO_PORT%
if defined ANDROID_SERIAL echo   Alvo ADB: %ANDROID_SERIAL%
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
echo   -- MANUTENCAO --
echo    [6] Limpeza Profunda (cache + build)
echo.
echo    [0] Sair
echo ===================================================
set "OPT="
set /p "OPT=Escolha uma opcao: "

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
call :FREE_PORT
call :ADB_REVERSE
echo  [i] Metro na porta %METRO_PORT%.
echo.
call npx expo start --dev-client -c --port %METRO_PORT%
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
echo [P] Preparando o projeto nativo (expo prebuild)...
echo     Gera a pasta 'android' exigida pelos builds via Gradle ([8] e [5]).
echo.
call :SET_JDK
echo  [i] JAVA_HOME: %JAVA_HOME%
echo.
if exist "android\gradlew.bat" (
    echo  [i] A pasta 'android' ja existe.
    echo      Para regenerar do zero:  npx expo prebuild -p android --clean
    echo.
)
call npx expo prebuild --platform android
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
echo [5] Gerando APK de RELEASE via Gradle...
echo.
call :CHECK_ENV
call :GRADLE_BUILD assembleRelease release
pause
goto MENU

rem ---------------------------------------------------------------------------
:APK_DEBUG
cls
echo [8] Gerando APK de DEVELOPMENT/DEBUG via Gradle...
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
if exist "%DEBUG_APK%" set "APK=%DEBUG_APK%"
if not defined APK if exist "%RELEASE_APK%" set "APK=%RELEASE_APK%"
if not defined APK (
    echo  [!] Nenhum APK encontrado em android\app\build\outputs\apk.
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
    echo  [OK] APK instalado. Abra o app "Snake Thai" no aparelho.
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
rem  SUB-ROTINA: avisa se o .env estiver faltando.
rem  As variaveis EXPO_PUBLIC_* sao embutidas no bundle em tempo de build; sem
rem  elas o app instala, mas quebra no boot (fail-fast de src/config/env.ts).
rem ===========================================================================
:CHECK_ENV
if not exist ".env" (
    echo.
    echo  [!] Arquivo .env AUSENTE na raiz do projeto.
    echo      O app instala, mas quebra ao abrir: faltam
    echo      EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY.
    echo      Rode:  copy .env.example .env    e preencha os valores.
    echo.
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
if not exist "android\gradlew.bat" (
    echo  [!] A pasta nativa 'android' nao existe ainda.
    echo      Rode a opcao [P] Preparar projeto nativo antes de gerar o APK.
    goto :eof
)
call :SET_JDK
call :ENSURE_PORT_PROP
echo  [i] JAVA_HOME: %JAVA_HOME%
set "PROOT=%CD%"
echo  [^>] Compilando (tarefa: %1)... na 1a vez isso demora varios minutos.
echo.
pushd android
rem -P garante a porta mesmo se o gradle.properties for regenerado.
call .\gradlew.bat %1 -PreactNativeDevServerPort=%METRO_PORT%
set "BUILD_RESULT=%ERRORLEVEL%"
popd

echo.
if "%BUILD_RESULT%"=="0" (
    echo  [OK] APK gerado em:
    echo       %PROOT%\android\app\build\outputs\apk\%2\app-%2.apk
) else (
    echo  [!] A compilacao falhou. Codigo de saida: %BUILD_RESULT%
    echo      Confira o log acima - JDK/JAVA_HOME, SDK/NDK, etc.
)
goto :eof
