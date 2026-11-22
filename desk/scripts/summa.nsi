; Instalador por usuário da Summa no Windows (#119, ADR 0006). Sem administrador:
; tudo fica em %LOCALAPPDATA%\Programs\Summa, no menu Iniciar do usuário e em HKCU.
; Os dados do aluno moram em %APPDATA%\Mesa de Estudos e nunca são tocados aqui.
;
; A versão nova é extraída ao lado e entra por troca de pastas. Se a Summa ainda
; estiver aberta, ou a troca falhar, a versão anterior continua inteira.
Unicode true
SetCompressor /SOLID lzma
RequestExecutionLevel user
AllowSkipFiles off
ShowInstDetails nevershow
ShowUninstDetails nevershow

!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "LogicLib.nsh"

!define APP_NAME "Summa"
!define APP_EXE "electron.exe"
!define UNINSTALLER "Uninstall Summa.exe"
!define UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\Summa"
!define PUBLISHER "Lucas Faria"
; 240 tentativas de 500 ms: o tutor e o MCP podem levar um tempo para soltar os arquivos.
!define SWAP_ATTEMPTS 240

Name "${APP_NAME}"
OutFile "${OUT_FILE}"
InstallDir "$LOCALAPPDATA\Programs\Summa"
BrandingText "${APP_NAME} ${VERSION}"

!define MUI_ICON "${ICON_FILE}"
!define MUI_UNICON "${ICON_FILE}"
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APP_EXE}"
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "PortugueseBR"
!insertmacro MUI_LANGUAGE "English"

LangString AppOpen ${LANG_PORTUGUESEBR} "Feche a Summa para continuar. Se ela já estiver fechada, aguarde alguns segundos e tente de novo."
LangString AppOpen ${LANG_ENGLISH} "Close Summa to continue. If it is already closed, wait a few seconds and try again."
LangString SwapFailed ${LANG_PORTUGUESEBR} "Não foi possível concluir a instalação. A versão anterior da Summa continua no lugar."
LangString SwapFailed ${LANG_ENGLISH} "Setup could not finish. The previous version of Summa is still in place."
LangString UninstallRefused ${LANG_PORTUGUESEBR} "Este desinstalador não está na pasta da Summa. Nada foi removido."
LangString UninstallRefused ${LANG_ENGLISH} "This uninstaller is not in the Summa folder. Nothing was removed."
LangString SetupBusy ${LANG_PORTUGUESEBR} "Outro instalador da Summa já está aberto. Feche-o e tente de novo."
LangString SetupBusy ${LANG_ENGLISH} "Another Summa installer is already open. Close it and try again."

VIProductVersion "${VERSION}.0"
VIFileVersion "${VERSION}.0"
VIAddVersionKey /LANG=${LANG_ENGLISH} "ProductName" "${APP_NAME}"
VIAddVersionKey /LANG=${LANG_ENGLISH} "ProductVersion" "${VERSION}"
VIAddVersionKey /LANG=${LANG_ENGLISH} "SummaCommit" "${COMMIT}"
VIAddVersionKey /LANG=${LANG_ENGLISH} "FileVersion" "${VERSION}"
VIAddVersionKey /LANG=${LANG_ENGLISH} "FileDescription" "${APP_NAME} Setup"
VIAddVersionKey /LANG=${LANG_ENGLISH} "CompanyName" "${PUBLISHER}"
VIAddVersionKey /LANG=${LANG_ENGLISH} "LegalCopyright" "${PUBLISHER}"

Var IsUpdate
Var Reopened
Var InstallerMutex

Function .onInit
  UserInfo::GetName
  Pop $R0
  System::Call 'kernel32::CreateMutexW(p 0, i 0, w "Local\SummaInstaller.$R0") p .R1 ?e'
  Pop $R2
  StrCpy $InstallerMutex $R1
  ${If} $R1 == 0
  ${OrIf} $R2 == 183
    SetErrorLevel 3
    MessageBox MB_ICONSTOP "$(SetupBusy)" /SD IDOK
    Quit
  ${EndIf}
  SetShellVarContext current
  ; A pasta é contrato do app e do updater: /D= não muda o destino.
  StrCpy $INSTDIR "$LOCALAPPDATA\Programs\Summa"
  StrCpy $IsUpdate "0"
  StrCpy $Reopened "0"
  ${GetParameters} $R0
  ClearErrors
  ${GetOptions} $R0 "/UPDATE" $R1
  ${IfNot} ${Errors}
    StrCpy $IsUpdate "1"
  ${EndIf}
FunctionEnd

; Numa atualização, a pessoa nunca fica sem a Summa: reabre a versão que estiver no lugar.
Function ReopenAfterUpdate
  ${If} $IsUpdate == "1"
  ${AndIf} $Reopened == "0"
  ${AndIf} ${FileExists} "$INSTDIR\${APP_EXE}"
    StrCpy $Reopened "1"
    SetOutPath "$INSTDIR"
    Exec '"$INSTDIR\${APP_EXE}"'
    ; A pasta de trabalho não pode prender a instalação enquanto a antiga é apagada.
    SetOutPath "$TEMP"
  ${EndIf}
FunctionEnd

Function .onInstFailed
  SetOutPath "$TEMP"
  Delete "$INSTDIR.ready"
  RMDir /r "$INSTDIR.new"
  Call ReopenAfterUpdate
FunctionEnd

Function FailInstall
  SetOutPath "$TEMP"
  Delete "$INSTDIR.ready"
  RMDir /r "$INSTDIR.new"
  Call ReopenAfterUpdate
  SetErrorLevel 2
  MessageBox MB_ICONSTOP "$(SwapFailed)" /SD IDOK
  Quit
FunctionEnd

; Uma troca interrompida (queda de energia) deixa a versão anterior em Summa.old.
Function RecoverInterruptedSwap
  ${If} ${FileExists} "$INSTDIR\${APP_EXE}"
    RMDir /r "$INSTDIR.old"
  ${ElseIf} ${FileExists} "$INSTDIR.old\${APP_EXE}"
    RMDir /r "$INSTDIR"
    Rename "$INSTDIR.old" "$INSTDIR"
  ${EndIf}
FunctionEnd

; Renomear a pasta só funciona quando nenhum processo da Summa segura arquivos nela.
!macro MoveCurrentAside prefix suffix failure
Function ${prefix}MoveCurrentAside
  ${IfNot} ${FileExists} "$INSTDIR\*.*"
    Return
  ${EndIf}
  StrCpy $R0 0
  retry:
    ; #119: quem abriu o instalador pode responder logo, sem esperar o app fechar sozinho.
    !define INTERACTIVE_SWAP_ATTEMPTS 7
    StrCpy $R1 ${INTERACTIVE_SWAP_ATTEMPTS}
    ${If} ${Silent}
    ${OrIf} $IsUpdate == "1"
      StrCpy $R1 ${SWAP_ATTEMPTS}
    ${EndIf}
    !undef INTERACTIVE_SWAP_ATTEMPTS
    ClearErrors
    Rename "$INSTDIR" "$INSTDIR.${suffix}"
    ${IfNot} ${Errors}
      Return
    ${EndIf}
    IntOp $R0 $R0 + 1
    ${If} $R0 < $R1
      Sleep 500
      Goto retry
    ${EndIf}
    ${IfNot} ${Silent}
      MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(AppOpen)" IDCANCEL giveUp
      StrCpy $R0 0
      Goto retry
    ${EndIf}
  giveUp:
    Call ${failure}
FunctionEnd
!macroend

!insertmacro MoveCurrentAside "" "old" "FailInstall"
!insertmacro MoveCurrentAside "un." "removing" "un.FailUninstall"

Function un.FailUninstall
  SetErrorLevel 2
  Quit
FunctionEnd

; A Summa fica aberta durante a extração e só fecha ao ver este arquivo.
Function SignalReady
  ${If} $IsUpdate == "1"
    FileOpen $R0 "$INSTDIR.ready" w
    FileClose $R0
  ${EndIf}
FunctionEnd

Function SwapInstall
  Call MoveCurrentAside
  ClearErrors
  Rename "$INSTDIR.new" "$INSTDIR"
  ${If} ${Errors}
    Rename "$INSTDIR.old" "$INSTDIR"
    Call FailInstall
  ${EndIf}
FunctionEnd

Function RegisterInstall
  ; O atalho existente já tem o AppUserModelId gravado pela Summa na abertura.
  ${IfNot} ${FileExists} "$SMPROGRAMS\${APP_NAME}.lnk"
    SetOutPath "$INSTDIR\resources\app"
    CreateShortCut "$SMPROGRAMS\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\resources\app\assets\mesa.ico" 0 SW_SHOWNORMAL "" "${APP_NAME}"
  ${EndIf}
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayName" "${APP_NAME}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayIcon" "$INSTDIR\resources\app\assets\mesa.ico"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "Publisher" "${PUBLISHER}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "UninstallString" '"$INSTDIR\${UNINSTALLER}"'
  WriteRegStr HKCU "${UNINSTALL_KEY}" "QuietUninstallString" '"$INSTDIR\${UNINSTALLER}" /S'
  ; Medido no build: somar os arquivos aqui deixava a Summa fechada por 140 s na VM de teste.
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "EstimatedSize" ${INSTALLED_KB}
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoRepair" 1
FunctionEnd

; Quem instalou pelo clone pode ter sessões em <clone>\desk\.runtime: o app novo
; precisa saber onde elas estão, mesmo que a config ainda não tenha sido salva.
Function KeepCloneOrigin
  ClearErrors
  ${If} ${FileExists} "$INSTDIR\resources\app\install-source.json"
    CopyFiles /SILENT "$INSTDIR\resources\app\install-source.json" "$INSTDIR.new\resources\app\previous-install-source.json"
  ${ElseIf} ${FileExists} "$INSTDIR\resources\app\previous-install-source.json"
    CopyFiles /SILENT "$INSTDIR\resources\app\previous-install-source.json" "$INSTDIR.new\resources\app\previous-install-source.json"
  ${EndIf}
  IfErrors cloneCopyFailed
  Return
  cloneCopyFailed:
    Call FailInstall
FunctionEnd

Section "Summa"
  SetOutPath "$TEMP"
  Call RecoverInterruptedSwap
  Delete "$INSTDIR.ready"
  RMDir /r "$INSTDIR.new"
  SetOutPath "$INSTDIR.new"
  File /r "${STAGE_DIR}\*.*"
  WriteUninstaller "$INSTDIR.new\${UNINSTALLER}"
  Call KeepCloneOrigin
  ; A pasta de trabalho não pode ficar dentro das pastas que serão renomeadas.
  SetOutPath "$TEMP"
  ${IfNot} ${FileExists} "$INSTDIR.new\${APP_EXE}"
  ${OrIfNot} ${FileExists} "$INSTDIR.new\resources\app\package.json"
    Call FailInstall
  ${EndIf}
  Call SignalReady
  Call SwapInstall
  Delete "$INSTDIR.ready"
  Call RegisterInstall
  SetOutPath "$TEMP"
  ; A Summa não espera a limpeza da versão antiga para voltar.
  Call ReopenAfterUpdate
  RMDir /r "$INSTDIR.old"
SectionEnd

Section "Uninstall"
  SetShellVarContext current
  SetOutPath "$TEMP"
  ${If} "$INSTDIR" != "$LOCALAPPDATA\Programs\Summa"
    MessageBox MB_ICONSTOP "$(UninstallRefused)" /SD IDOK
    SetErrorLevel 2
    Quit
  ${EndIf}
  Call un.MoveCurrentAside
  RMDir /r "$INSTDIR.removing"
  Delete "$SMPROGRAMS\${APP_NAME}.lnk"
  DeleteRegKey HKCU "${UNINSTALL_KEY}"
SectionEnd
