#define MyAppName "LUNA桌宠"
#define MyAppVersion "1.3.1"
#define MyAppPublisher "WB40"
#define MyAppExeName "LUNA桌宠.exe"
#define MyAppId "{{1BB42E46-221C-4E47-85B5-0B5C4DB25639}"

[Setup]
AppId={#MyAppId}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\Programs\LUNA桌宠
DefaultGroupName=LUNA桌宠
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
UsePreviousAppDir=yes
OutputDir=..\dist
OutputBaseFilename=LUNA桌宠-安装程序
SetupIconFile=..\assets\tray-icon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
CloseApplications=yes
RestartApplications=no
VersionInfoVersion=1.3.1.0
VersionInfoProductName={#MyAppName}
VersionInfoProductVersion={#MyAppVersion}
VersionInfoDescription={#MyAppName} 安装程序
VersionInfoCompany={#MyAppPublisher}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "创建桌面快捷方式"; GroupDescription: "附加任务："; Flags: checkedonce

[Files]
Source: "..\dist\LUNA桌宠-win64\*"; DestDir: "{app}"; Excludes: "thoughts.json"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\dist\LUNA桌宠-win64\thoughts.json"; DestDir: "{app}"; Flags: onlyifdoesntexist

[Icons]
Name: "{group}\LUNA桌宠"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"
Name: "{group}\卸载 LUNA桌宠"; Filename: "{uninstallexe}"
Name: "{autodesktop}\LUNA桌宠"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "启动 LUNA桌宠"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}"
