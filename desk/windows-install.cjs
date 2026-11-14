/* Instalação por usuário no Windows (#181), irmã do `Summa.app` do
   macOS. Sem NSIS, Squirrel ou electron-builder (ADR 0005):
   - copia o Electron de `node_modules/electron/dist` e o MESMO payload do .app
     (`stageBundlePayload`) para `%LOCALAPPDATA%\Programs\Summa`,
     sem admin e sem tocar no PATH;
   - cria o atalho do menu Iniciar via PowerShell com o ícone da Mesa e o
     AppUserModelId que o `main.cjs` usa (#178);
   - registra a desinstalação em `HKCU\...\Uninstall\Summa`, chamando o
     `uninstall.ps1` do próprio payload, que apaga SÓ a pasta, o atalho e a
     chave — os dados do aluno em `%APPDATA%\Mesa de Estudos` ficam;
   - o updater assinado continua trocando só o payload: `install-source.json` e
     o `.update-manifest.json` entram pelo `stageBundlePayload` do .app.
   Uso: `npm run install-app` no Windows. No Linux/macOS o comando não chama
   este módulo. */
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {shortcutDetails,shortcutFile}=require('./windows-shortcut.cjs');
const {psLiteral}=require('./capture-win.cjs');

const INSTALL_DIR_NAME='Summa';
const UNINSTALL_KEY='HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Summa';
const UNINSTALL_SCRIPT='uninstall.ps1';
const PUBLISHER='Lucas Faria';

/* O WScript.Shell grava alvo, argumentos, pasta e ícone, mas não expõe o
   AppUserModelId do atalho — e sem ele o Iniciar e as notificações voltam para
   o ícone do Electron (#178). O AUMID mora no IPropertyStore do mesmo objeto
   COM (`System.AppUserModel.ID`); o C# abaixo pega o atalho já salvo, grava a
   propriedade e salva de novo. É o menor interop que resolve; trocar tudo por
   IShellLink só aumentaria a superfície sem ganho. */
const AUMID_INTEROP=`using System;
using System.Runtime.InteropServices;

[ComImport, Guid("00021401-0000-0000-C000-000000000046")]
public class ShellLink { }

[ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("000214F9-0000-0000-C000-000000000046")]
public interface IShellLinkW {
  void GetPath(IntPtr pszFile, int cchMaxPath, IntPtr pfd, uint fFlags);
  void GetIDList(out IntPtr ppidl);
  void SetIDList(IntPtr pidl);
  void GetDescription(IntPtr pszName, int cchMaxName);
  void SetDescription([MarshalAs(UnmanagedType.LPWStr)] string pszName);
  void GetWorkingDirectory(IntPtr pszDir, int cchMaxPath);
  void SetWorkingDirectory([MarshalAs(UnmanagedType.LPWStr)] string pszDir);
  void GetArguments(IntPtr pszArgs, int cchMaxPath);
  void SetArguments([MarshalAs(UnmanagedType.LPWStr)] string pszArgs);
  void GetHotkey(out short pwHotkey);
  void SetHotkey(short wHotkey);
  void GetShowCmd(out int piShowCmd);
  void SetShowCmd(int iShowCmd);
  void GetIconLocation(IntPtr pszIconPath, int cchIconPath, out int piIcon);
  void SetIconLocation([MarshalAs(UnmanagedType.LPWStr)] string pszIconPath, int iIcon);
  void SetRelativePath([MarshalAs(UnmanagedType.LPWStr)] string pszPathRel, int dwReserved);
  void Resolve(IntPtr hwnd, uint fFlags);
  void SetPath([MarshalAs(UnmanagedType.LPWStr)] string pszFile);
}

[ComImport, Guid("0000010b-0000-0000-C000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IPersistFile {
  void GetClassID(out Guid pClassID);
  [PreserveSig] int IsDirty();
  void Load([MarshalAs(UnmanagedType.LPWStr)] string pszFileName, uint dwMode);
  void Save([MarshalAs(UnmanagedType.LPWStr)] string pszFileName, [MarshalAs(UnmanagedType.Bool)] bool fRemember);
  void SaveCompleted([MarshalAs(UnmanagedType.LPWStr)] string pszFileName);
  void GetCurFile([MarshalAs(UnmanagedType.LPWStr)] out string ppszFileName);
}

[StructLayout(LayoutKind.Sequential, Pack = 4)]
public struct PROPERTYKEY { public Guid fmtid; public uint pid; }

[StructLayout(LayoutKind.Sequential)]
public struct PropVariant {
  public ushort vt;
  public ushort wReserved1;
  public ushort wReserved2;
  public ushort wReserved3;
  public IntPtr p;
}

[ComImport, Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IPropertyStore {
  void GetCount(out uint cProps);
  void GetAt(uint iProp, out PROPERTYKEY pkey);
  void GetValue(ref PROPERTYKEY key, out PropVariant pv);
  void SetValue(ref PROPERTYKEY key, ref PropVariant pv);
  void Commit();
}

public static class MesaShortcut {
  public static void SetAppUserModelId(string shortcutPath, string appId) {
    var link = (IShellLinkW)new ShellLink();
    var file = (IPersistFile)link;
    // 2 = STGM_READWRITE: com 0 (só leitura) o SetValue falha com STG_E_ACCESSDENIED
    // e o install-app aborta antes da chave de desinstalação (VM Win11 26100, PR #17).
    file.Load(shortcutPath, 2);
    var store = (IPropertyStore)link;
    var key = new PROPERTYKEY();
    key.fmtid = new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3");
    key.pid = 5;
    var value = new PropVariant();
    value.vt = 31;
    value.p = Marshal.StringToCoTaskMemUni(appId);
    try {
      store.SetValue(ref key, ref value);
      store.Commit();
    } finally {
      Marshal.FreeCoTaskMem(value.p);
    }
    file.Save(shortcutPath, true);
  }
}`;

/* Literal PowerShell: o `psLiteral` do Conferir já dobra também as aspas
   curvas que o PowerShell lê como `'` (auditoria de segurança da #181). */
function psQuote(value){
 return `'${psLiteral(value)}'`;
}

/**
 * Pasta da instalação por usuário. `LOCALAPPDATA` vazio é recusado: sem ele o
 * caminho relativo cairia na raiz do disco.
 * @param {{env: Record<string,string|undefined>}} input
 * @returns {string}
 * @example installDir({env:{LOCALAPPDATA:'C:\\Users\\ana\\AppData\\Local'}}) // 'C:\\Users\\ana\\AppData\\Local\\Programs\\Summa'
 */
function installDir({env}){
 const local=String(env.LOCALAPPDATA||'');
 if(!local)throw Error(`LOCALAPPDATA ausente; esperado o caminho de %LOCALAPPDATA% para instalar em %LOCALAPPDATA%\\Programs\\${INSTALL_DIR_NAME}`);
 return path.join(local,'Programs',INSTALL_DIR_NAME);
}

/**
 * Payload dentro da instalação, no mesmo papel de `Contents/Resources/app` do
 * `.app`: o Electron carrega `resources\app` sozinho ao abrir o electron.exe.
 * @param {{env: Record<string,string|undefined>}} input
 * @returns {string}
 * @example payloadDir({env:{LOCALAPPDATA:'C:\\Users\\ana\\AppData\\Local'}}) // 'C:\\...\\Summa\\resources\\app'
 */
function payloadDir({env}){
 return path.join(installDir({env}),'resources','app');
}

/**
 * Os únicos alvos do desinstalador: a pasta da instalação, o atalho do menu
 * Iniciar e a chave de "Aplicativos instalados". Nada de `%APPDATA%\Mesa de
 * Estudos` (dados do aluno).
 * @param {{env: Record<string,string|undefined>}} input
 * @returns {{installDir: string, shortcut: string, key: string}}
 * @example uninstallTargets({env:{LOCALAPPDATA:'C:\\Users\\ana\\AppData\\Local',APPDATA:'C:\\Users\\ana\\AppData\\Roaming'}})
 */
function uninstallTargets({env}){
 return {installDir:installDir({env}),shortcut:shortcutFile(env),key:UNINSTALL_KEY};
}

/**
 * Conteúdo do `uninstall.ps1` gravado no payload. Os caminhos entram literais
 * (calculados na instalação), e antes de apagar a pasta o script confere o
 * caminho canônico e o nome; pasta que virou link simbólico/junção só perde o
 * link, nunca o alvo. Os dados do aluno (`%APPDATA%\Mesa de Estudos`) não
 * aparecem aqui.
 * @param {{env: Record<string,string|undefined>}} input
 * @returns {string} script PowerShell
 * @example uninstallScript({env:{LOCALAPPDATA:'C:\\Users\\ana\\AppData\\Local',APPDATA:'C:\\Users\\ana\\AppData\\Roaming'}})
 */
function uninstallScript({env}){
 const targets=uninstallTargets({env});
 const parent=path.dirname(targets.installDir);
 return [
  `$ErrorActionPreference = 'Stop'`,
  `$installDir = ${psQuote(targets.installDir)}`,
  `$full = [System.IO.Path]::GetFullPath($installDir)`,
  `$parent = [System.IO.Path]::GetFullPath(${psQuote(parent)}) + [System.IO.Path]::DirectorySeparatorChar`,
  `if (-not $full.StartsWith($parent, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'recusado: a pasta de instalação não está em %LOCALAPPDATA%\\Programs' }`,
  `if (-not [System.StringComparer]::OrdinalIgnoreCase.Equals([System.IO.Path]::GetFileName($full), ${psQuote(INSTALL_DIR_NAME)})) { throw 'recusado: a pasta de instalação não é a da Summa' }`,
  `if (Test-Path -LiteralPath $full) {`,
  ` $item = Get-Item -LiteralPath $full -Force`,
  ` if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {`,
  `  Remove-Item -LiteralPath $full -Force`,
  ` } else {`,
  /* `Remove-Item -Recurse` do PowerShell 5.1 pode atravessar junção DENTRO da
     pasta e apagar o alvo; o `Directory.Delete` recursivo do .NET remove o
     ponto de reparse sem entrar nele (auditoria de segurança da #181). */
  `  [System.IO.Directory]::Delete($full, $true)`,
  ` }`,
  `}`,
  `Remove-Item -LiteralPath ${psQuote(targets.shortcut)} -Force -ErrorAction SilentlyContinue`,
  `Remove-Item -LiteralPath ${psQuote(targets.key)} -Recurse -Force -ErrorAction SilentlyContinue`,
 ].join('\n');
}

/**
 * Valores da chave de desinstalação. `UninstallString` chama o `.ps1` do
 * payload com aspas em volta do caminho (o perfil do usuário pode ter espaço).
 * @param {{env: Record<string,string|undefined>, version: string}} input
 * @returns {{DisplayName: string, DisplayVersion: string, DisplayIcon: string, Publisher: string, UninstallString: string}}
 * @example registryValues({env, version:'1.2.0'}).DisplayVersion // '1.2.0'
 */
function registryValues({env,version}){
 const payload=payloadDir({env});
 return {
  DisplayName:INSTALL_DIR_NAME,
  DisplayVersion:String(version||''),
  DisplayIcon:path.join(payload,'assets','mesa.ico'),
  Publisher:PUBLISHER,
  UninstallString:`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${path.join(payload,'scripts',UNINSTALL_SCRIPT)}"`,
 };
}

/**
 * Script PowerShell que grava a chave em `HKCU`, sem admin.
 * @param {{env: Record<string,string|undefined>, version: string}} input
 * @returns {string}
 * @example registryScript({env, version:'1.2.0'})
 */
function registryScript({env,version}){
 const values=registryValues({env,version});
 const lines=[
  `$ErrorActionPreference = 'Stop'`,
  `$key = ${psQuote(UNINSTALL_KEY)}`,
  `New-Item -Path $key -Force | Out-Null`,
 ];
 for(const [name,value] of Object.entries(values)){
  lines.push(`New-ItemProperty -LiteralPath $key -Name ${psQuote(name)} -Value ${psQuote(value)} -PropertyType String -Force | Out-Null`);
 }
 return lines.join('\n');
}

/**
 * Script PowerShell do atalho: WScript.Shell para alvo/ícone e
 * `SetAppUserModelId` (IPropertyStore via C# inline) para o AUMID.
 * @param {{env: Record<string,string|undefined>, execPath: string, appPath: string, assetsDir: string}} input
 * @returns {string}
 * @example shortcutScript({env, execPath:'C:\\...\\electron.exe', appPath:'C:\\...\\resources\\app', assetsDir:'C:\\...\\assets'})
 */
function shortcutScript({env,execPath,appPath,assetsDir}){
 const file=shortcutFile(env);
 const details=shortcutDetails({execPath,appPath,assetsDir,defaultApp:false});
 return [
  `$ErrorActionPreference = 'Stop'`,
  `$shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut(${psQuote(file)})`,
  `$shortcut.TargetPath = ${psQuote(details.target)}`,
  `$shortcut.Arguments = ${psQuote(details.args)}`,
  `$shortcut.WorkingDirectory = ${psQuote(details.cwd)}`,
  `$shortcut.IconLocation = ${psQuote(`${details.icon},${details.iconIndex}`)}`,
  `$shortcut.Description = ${psQuote(details.description)}`,
  `$shortcut.Save()`,
  `Add-Type -TypeDefinition @'`,
  AUMID_INTEROP,
  `'@`,
  `[MesaShortcut]::SetAppUserModelId(${psQuote(file)}, ${psQuote(details.appUserModelId)})`,
 ].join('\n');
}

/* Cópia do Electron de `node_modules`. O `default_app.asar` sai: com ele, uma
   instalação sem payload abriria o app genérico do Electron em vez de falhar. */
function copyElectronDist({source,dest}){
 const exe=path.join(source,'electron.exe');
 if(!fs.existsSync(exe))throw Error(`Electron ausente: esperava ${exe}; rode npm ci antes de instalar`);
 fs.mkdirSync(dest,{recursive:true});
 fs.cpSync(source,dest,{recursive:true,force:true,filter:file=>path.basename(file)!=='default_app.asar'});
 fs.rmSync(path.join(dest,'resources','default_app.asar'),{force:true});
}

function defaultInstallPayload(input){
 return require('./bundle-runtime.cjs').installWindowsBundle(input);
}

/* `-EncodedCommand` (UTF-16LE em base64) evita o parser de linha de comando do
   PowerShell: o script tem aspas (C#) e quebras de linha, que o `-Command`
   repassa de forma frágil por CreateProcess. */
function defaultRunPowerShell(script){
 const encoded=Buffer.from(script,'utf16le').toString('base64');
 execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-EncodedCommand',encoded],{stdio:'inherit'});
}

/**
 * Instala/atualiza a cópia por usuário: Electron, payload, `uninstall.ps1`,
 * atalho do menu Iniciar e chave de desinstalação. Os comandos entram por
 * parâmetro (`deps`) para os testes não chamarem PowerShell de verdade.
 * @param {{desk: string, root: string, electronDir: string, env: Record<string,string|undefined>, version: string, deps?: {copyElectron?: (input: {source: string, dest: string}) => unknown, installPayload?: (input: {desk: string, root: string, installDir: string, version: string}) => {dest: string}, runPowerShell?: (script: string) => unknown}}} input
 * @returns {{installDir: string, payloadDir: string, shortcut: string}}
 * @example installWindows({desk, root, electronDir, env: process.env, version: '1.2.0'})
 */
function installWindows({desk,root,electronDir,env,version,deps={}}){
 const copyElectron=deps.copyElectron||copyElectronDist;
 const installPayload=deps.installPayload||defaultInstallPayload;
 const runPowerShell=deps.runPowerShell||defaultRunPowerShell;
 const target=installDir({env});
 copyElectron({source:path.join(electronDir,'dist'),dest:target});
 const payload=installPayload({desk,root,installDir:target,version});
 const uninstallFile=path.join(payload.dest,'scripts',UNINSTALL_SCRIPT);
 fs.mkdirSync(path.dirname(uninstallFile),{recursive:true});
 fs.writeFileSync(uninstallFile,uninstallScript({env}));
 runPowerShell(shortcutScript({env,execPath:path.join(target,'electron.exe'),appPath:payload.dest,assetsDir:path.join(payload.dest,'assets')}));
 runPowerShell(registryScript({env,version}));
 return {installDir:target,payloadDir:payload.dest,shortcut:shortcutFile(env)};
}

module.exports={INSTALL_DIR_NAME,UNINSTALL_KEY,UNINSTALL_SCRIPT,PUBLISHER,installDir,payloadDir,shortcutScript,registryValues,registryScript,uninstallScript,uninstallTargets,installWindows,copyElectronDist};
