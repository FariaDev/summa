# Regressões reais em conta descartável: mutex e cópia da origem (#119).
param(
  [Parameter(Mandatory = $true)][string]$Setup,
  [Parameter(Mandatory = $true)][ValidateSet('mutex', 'clone')][string]$Scenario
)
$ErrorActionPreference = 'Stop'
$dir = Join-Path $env:LOCALAPPDATA 'Programs\Summa'
$key = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Summa'
$shortcut = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Summa.lnk'
foreach ($entry in @($dir, $key, $shortcut)) {
  if (Test-Path -LiteralPath $entry) { throw 'Recebido: estado instalado. Esperado: conta descartável sem Summa.' }
}
$processes = New-Object 'System.Collections.Generic.List[System.Diagnostics.Process]'
$previousRuntime = $env:LEARNING_DESK_RUNTIME
$previousVault = $env:LEARNING_VAULT
$sandbox = Join-Path ([IO.Path]::GetTempPath()) ('summa-repro-' + [guid]::NewGuid())
$lock = $null

function Assert-Repro([bool]$condition, [string]$what) {
  if (-not $condition) { throw "Recebido: condição falsa. Esperado: $what" }
  Write-Output "ok: $what"
}

function Start-Setup([string]$file, [string[]]$arguments) {
  $process = Start-Process -FilePath $file -ArgumentList $arguments -PassThru
  $processes.Add($process)
  return $process
}

function Wait-Setup([System.Diagnostics.Process]$process, [int]$seconds = 600) {
  if (-not $process.WaitForExit($seconds * 1000)) { throw "Recebido: instalador em execução. Esperado: saída em até $seconds s." }
  return $process.ExitCode
}

function Wait-Ready([System.Diagnostics.Process]$process) {
  $deadline = (Get-Date).AddSeconds(180)
  while (-not (Test-Path -LiteralPath "$dir.ready") -and -not $process.HasExited -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 100 }
  Assert-Repro (Test-Path -LiteralPath "$dir.ready") 'o primeiro instalador chegou ao aviso de pronto em até 180 s'
}

function Stop-Summa {
  Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.StartsWith("$dir\", [StringComparison]::OrdinalIgnoreCase) } | Stop-Process -Force -ErrorAction SilentlyContinue
}

try {
  $env:LEARNING_DESK_RUNTIME = Join-Path $sandbox 'runtime'
  $env:LEARNING_VAULT = Join-Path $sandbox 'vault'
  New-Item -ItemType Directory -Force -Path $env:LEARNING_DESK_RUNTIME, $env:LEARNING_VAULT | Out-Null
  $install = Start-Setup $Setup @('/S')
  Assert-Repro ((Wait-Setup $install) -eq 0) 'a instalação inicial termina com código 0'
  $exe = Join-Path $dir 'electron.exe'
  $package = Join-Path $dir 'resources\app\package.json'
  $hash = (Get-FileHash -LiteralPath $package).Hash
  if ($Scenario -eq 'mutex') {
    $lock = [IO.File]::Open($exe, 'Open', 'Read', 'Read')
    $first = Start-Setup $Setup @('/S', '/UPDATE')
    Wait-Ready $first
    $stagedHash = (Get-FileHash -LiteralPath "$dir.new\resources\app\package.json").Hash
    $second = Start-Setup $Setup @('/S', '/UPDATE')
    $secondExit = Wait-Setup $second 15
    Write-Output "second exit=$secondExit"
    Assert-Repro ($secondExit -eq 3) 'o segundo instalador silencioso recusa com código 3'
    Assert-Repro (-not $first.HasExited) 'o primeiro continua em execução'
    Assert-Repro ((Get-FileHash -LiteralPath "$dir.new\resources\app\package.json").Hash -eq $stagedHash) 'o segundo não altera a extração do primeiro'
    Assert-Repro (Test-Path -LiteralPath "$dir.ready") 'o segundo não apaga o aviso do primeiro'
    $lock.Dispose(); $lock = $null
    $firstExit = Wait-Setup $first
    Write-Output "first exit=$firstExit"
    Assert-Repro ($firstExit -eq 0) 'o primeiro conclui com código 0 após liberar a instalação'
    Assert-Repro ((Get-FileHash -LiteralPath $package).Hash -eq $hash) 'o payload instalado continua íntegro'
  } else {
    $origin = Join-Path $dir 'resources\app\install-source.json'
    Set-Content -LiteralPath $origin -Value '{"kind":"clone","path":"X:\\clone-inexistente"}'
    $sentinel = Join-Path $dir 'old-install-sentinel.txt'
    Set-Content -LiteralPath $sentinel -Value 'old installation'
    $lock = [IO.File]::Open($origin, 'Open', 'Read', 'None')
    $update = Start-Setup $Setup @('/S', '/UPDATE')
    $sawReady = $false
    $deadline = (Get-Date).AddSeconds(600)
    while (-not $update.HasExited -and (Get-Date) -lt $deadline) {
      if (Test-Path -LiteralPath "$dir.ready") { $sawReady = $true; break }
      Start-Sleep -Milliseconds 10
    }
    Write-Output "ready observed=$sawReady"
    Assert-Repro (-not $sawReady) 'a falha de cópia aborta antes de sinalizar pronto'
    $exit = Wait-Setup $update 15
    Write-Output "copy-failure exit=$exit"
    Assert-Repro ($exit -eq 2) 'a origem bloqueada causa código 2'
    Assert-Repro (Test-Path -LiteralPath $sentinel) 'a pasta da instalação antiga não foi substituída'
    Assert-Repro ((Get-FileHash -LiteralPath $package).Hash -eq $hash) 'o payload antigo continua íntegro'
    Assert-Repro (-not (Test-Path -LiteralPath "$dir.old")) 'a instalação antiga não foi movida'
  }
  Write-Output "repro $Scenario aprovado"
} finally {
  if ($lock) { $lock.Dispose() }
  foreach ($process in $processes) {
    if (-not $process.HasExited) { & taskkill.exe /PID $process.Id /T /F | Out-Null }
  }
  Stop-Summa
  if (Test-Path -LiteralPath (Join-Path $dir 'Uninstall Summa.exe')) {
    $cleanup = Start-Setup (Join-Path $dir 'Uninstall Summa.exe') @('/S')
    Wait-Setup $cleanup | Out-Null
  }
  $deadline = (Get-Date).AddSeconds(60)
  while ((Test-Path -LiteralPath $dir) -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 500 }
  Assert-Repro (-not (Test-Path -LiteralPath $dir)) 'a instalação de prova foi removida'
  foreach ($suffix in @('new', 'old', 'ready')) {
    if (Test-Path -LiteralPath "$dir.$suffix") { Remove-Item -LiteralPath "$dir.$suffix" -Recurse -Force }
  }
  Remove-Item -LiteralPath $sandbox -Recurse -Force
  $env:LEARNING_DESK_RUNTIME = $previousRuntime
  $env:LEARNING_VAULT = $previousVault
}
