!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"

; Uygulama bilgileri
!define APP_NAME "Tekstil AI Studio"
!define APP_VERSION "1.0.0"
!define APP_PUBLISHER "Tekstil AI Studio"
!define APP_EXE "Tekstil AI Studio (Offline Edition).exe"
!define APP_UNINSTALL "Uninstall.exe"

; Kurulum dizini
!define INSTALL_DIR "$PROGRAMFILES64\Tekstil AI Studio"

; Modern UI ayarları
!define MUI_ABORTWARNING

; Sayfa sırası
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

; Kaldırma sayfaları
!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

; Kurulum bölümü
Section "MainApplication" SecMain
    SectionIn RO
    SetOutPath "$INSTDIR"
    
    ; Ana dosyaları kopyala
    ; File /r "dist\*"
    ; File /r "electron\*"
    ; File /r "assets\*"
    
    ; Başlat menüsü kısayolu
    CreateDirectory "$SMPROGRAMS\Tekstil AI Studio"
    CreateShortCut "$SMPROGRAMS\Tekstil AI Studio\Tekstil AI Studio.lnk" "$INSTDIR\${APP_EXE}"
    CreateShortCut "$SMPROGRAMS\Tekstil AI Studio\Kaldır.lnk" "$INSTDIR\${APP_UNINSTALL}"
    
    ; Masaüstü kısayolu
    CreateShortCut "$DESKTOP\Tekstil AI Studio.lnk" "$INSTDIR\${APP_EXE}"
    
    ; Kaldırma bilgilerini yaz
    WriteUninstaller "$INSTDIR\${APP_UNINSTALL}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Tekstil AI Studio" "DisplayName" "${APP_NAME}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Tekstil AI Studio" "UninstallString" "$INSTDIR\${APP_UNINSTALL}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Tekstil AI Studio" "DisplayIcon" "$INSTDIR\${APP_EXE}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Tekstil AI Studio" "Publisher" "${APP_PUBLISHER}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Tekstil AI Studio" "DisplayVersion" "${APP_VERSION}"
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Tekstil AI Studio" "NoModify" 1
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Tekstil AI Studio" "NoRepair" 1
    
    ; Dosya ilişkilendirmeleri
    WriteRegStr HKCR ".tekstil" "" "TekstilAIStudio.Project"
    WriteRegStr HKCR "TekstilAIStudio.Project" "" "Tekstil AI Studio Project"
    WriteRegStr HKCR "TekstilAIStudio.Project\DefaultIcon" "" "$INSTDIR\${APP_EXE},0"
    WriteRegStr HKCR "TekstilAIStudio.Project\shell\open\command" "" '"$INSTDIR\${APP_EXE}" "%1"'
SectionEnd

; Kaldırma bölümü
Section "Uninstall"
    ; Uygulamayı durdur
    nsExec::ExecToStack 'taskkill /f /im "${APP_EXE}"'
    
    ; Dosyaları sil
    RMDir /r "$INSTDIR"
    
    ; Kısayolları sil
    Delete "$SMPROGRAMS\Tekstil AI Studio\Tekstil AI Studio.lnk"
    Delete "$SMPROGRAMS\Tekstil AI Studio\Kaldır.lnk"
    RMDir "$SMPROGRAMS\Tekstil AI Studio"
    Delete "$DESKTOP\Tekstil AI Studio.lnk"
    
    ; Kayıt defteri girdilerini sil
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Tekstil AI Studio"
    DeleteRegKey HKCR ".tekstil"
    DeleteRegKey HKCR "TekstilAIStudio.Project"
    
    ; Kullanıcı verilerini sil (isteğe bağlı)
    MessageBox MB_YESNO "Kullanıcı verilerinizi de silmek istiyor musunuz? (Arama geçmişi, ayarlar vb.)" IDYES DeleteUserData IDNO SkipUserData
    DeleteUserData:
        RMDir /r "$APPDATA\Tekstil AI Studio (Offline Edition)"
    SkipUserData:
SectionEnd

; Kaldırma sonrası
Function un.onUninstSuccess
    MessageBox MB_OK "Tekstil AI Studio başarıyla kaldırıldı."
FunctionEnd 