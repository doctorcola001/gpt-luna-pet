Unicode true
!include "MUI2.nsh"
!include "LogicLib.nsh"

!define APP_NAME "LUNA桌宠"
!define APP_EXE "LUNA桌宠.exe"
!define APP_VERSION "1.0.0"
!define PUBLISHER "WB40"
!define SOURCE_DIR "F:\TLBK\luna-desktop-pet\dist\LUNA桌宠-win64"
!define OUT_FILE "F:\TLBK\luna-desktop-pet\dist\LUNA桌宠-安装程序.exe"

Name "${APP_NAME}"
OutFile "${OUT_FILE}"
InstallDir "$LOCALAPPDATA\Programs\LUNA桌宠"
InstallDirRegKey HKCU "Software\WB40\LUNA桌宠" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
SetCompressorDictSize 64
BrandingText "LUNA Desktop Companion"

VIProductVersion "1.0.0.0"
VIAddVersionKey /LANG=2052 "ProductName" "${APP_NAME}"
VIAddVersionKey /LANG=2052 "ProductVersion" "${APP_VERSION}"
VIAddVersionKey /LANG=2052 "Publisher" "${PUBLISHER}"
VIAddVersionKey /LANG=2052 "FileDescription" "${APP_NAME} 安装程序"

!define MUI_ICON "F:\TLBK\luna-desktop-pet\assets\tray-icon.ico"
!define MUI_UNICON "F:\TLBK\luna-desktop-pet\assets\tray-icon.ico"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "安装 LUNA桌宠"
!define MUI_WELCOMEPAGE_TEXT "安装程序会创建独立的 LUNA桌宠程序文件夹。$\r$\n$\r$\n可编辑的思考气泡文本 thoughts.json 会随程序一起安装。"
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APP_EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "启动 LUNA桌宠"
!define MUI_FINISHPAGE_LINK "打开程序文件夹"
!define MUI_FINISHPAGE_LINK_LOCATION "$INSTDIR"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "SimpChinese"

Section "LUNA桌宠主程序" SecMain
  SetOutPath "$INSTDIR"

  StrCpy $0 "$TEMP\luna-thoughts-backup.json"
  IfFileExists "$INSTDIR\thoughts.json" 0 no_thougths_backup
    CopyFiles /SILENT "$INSTDIR\thoughts.json" "$0"
  no_thougths_backup:

  File /r "${SOURCE_DIR}\*.*"

  IfFileExists "$0" 0 no_thougths_restore
    CopyFiles /SILENT "$0" "$INSTDIR\thoughts.json"
    Delete "$0"
  no_thougths_restore:

  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\WB40\LUNA桌宠" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LUNA桌宠" "DisplayName" "${APP_NAME}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LUNA桌宠" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LUNA桌宠" "Publisher" "${PUBLISHER}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LUNA桌宠" "DisplayIcon" "$INSTDIR\${APP_EXE}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LUNA桌宠" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LUNA桌宠" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LUNA桌宠" "QuietUninstallString" '"$INSTDIR\Uninstall.exe" /S'
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LUNA桌宠" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LUNA桌宠" "NoRepair" 1

  ${IfNot} ${Silent}
    CreateDirectory "$SMPROGRAMS\LUNA桌宠"
    CreateShortcut "$SMPROGRAMS\LUNA桌宠\LUNA桌宠.lnk" "$INSTDIR\${APP_EXE}"
    CreateShortcut "$SMPROGRAMS\LUNA桌宠\卸载 LUNA桌宠.lnk" "$INSTDIR\Uninstall.exe"
    CreateShortcut "$DESKTOP\LUNA桌宠.lnk" "$INSTDIR\${APP_EXE}"
  ${EndIf}
SectionEnd

Section "Uninstall"
  Delete "$SMPROGRAMS\LUNA桌宠\LUNA桌宠.lnk"
  Delete "$SMPROGRAMS\LUNA桌宠\卸载 LUNA桌宠.lnk"
  RMDir "$SMPROGRAMS\LUNA桌宠"
  Delete "$DESKTOP\LUNA桌宠.lnk"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\LUNA桌宠"
  DeleteRegKey HKCU "Software\WB40\LUNA桌宠"
  RMDir /r "$INSTDIR"
SectionEnd
