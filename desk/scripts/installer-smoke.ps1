# Prova do instalador numa conta descartável (#119, ADR 0006).
param([Parameter(Mandatory = $true)][string]$Setup)
$ErrorActionPreference = 'Stop'
$dir = Join-Path $env:LOCALAPPDATA 'Programs\Summa'
$exe = Join-Path $dir 'electron.exe'
$key = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Summa'
$shortcut = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Summa.lnk'
$processes = New-Object 'System.Collections.Generic.List[System.Diagnostics.Process]'
$previousRuntime = $env:LEARNING_DESK_RUNTIME
$previousVault = $env:LEARNING_VAULT

function Assert-True([bool]$condition, [string]$what) {
  if (-not $condition) { throw "falhou: $what" }
  Write-Output "ok: $what"
}

function Assert-CleanAccount {
  foreach ($entry in @(@($dir, 'pasta instalada'), @($key, 'registro HKCU'), @($shortcut, 'atalho do menu Iniciar'))) {
    if (Test-Path -LiteralPath $entry[0]) {
      throw "Recebido: $($entry[1]) existente. Esperado: conta sem instalação, registro HKCU ou atalho da Summa. Nada foi alterado."
    }
  }
}

function Get-Summa {
  @(Get-Process -ErrorAction SilentlyContinue | Where-Object {
    $processPath = $_.Path
    $processPath -and $processPath.StartsWith("$dir\", [StringComparison]::OrdinalIgnoreCase)
  })
}

function Stop-Summa {
  Get-Summa | Stop-Process -Force -ErrorAction SilentlyContinue
  $deadline = (Get-Date).AddSeconds(30)
  while ((Get-Summa).Count -gt 0 -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 500 }
  Assert-True ((Get-Summa).Count -eq 0) 'a Summa fecha em até 30 s'
}

function Wait-Summa([string]$what) {
  $deadline = (Get-Date).AddSeconds(60)
  while ((Get-Summa).Count -eq 0 -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 500 }
  Assert-True ((Get-Summa).Count -gt 0) "$what (prazo: 60 s)"
}

function Start-Setup([string]$file, [string[]]$arguments) {
  $process = Start-Process -FilePath $file -ArgumentList $arguments -PassThru
  $processes.Add($process)
  return $process
}

function Start-Uninstall {
  $launcher = Start-Setup (Join-Path $dir 'Uninstall Summa.exe') @('/S')
  $deadline = (Get-Date).AddSeconds(10)
  while ((Get-Date) -lt $deadline) {
    $child = Get-CimInstance Win32_Process -Filter "ParentProcessId = $($launcher.Id)" | Select-Object -First 1
    if ($child) {
      $worker = Get-Process -Id $child.ProcessId -ErrorAction SilentlyContinue
      if ($worker) {
        $null = $worker.Handle
        $processes.Add($worker)
        return $worker
      }
    }
    Start-Sleep -Milliseconds 50
  }
  throw "Recebido: nenhum processo filho do desinstalador (PID $($launcher.Id)) em 10 s. Esperado: cópia temporária do desinstalador em execução."
}

function Wait-Setup([System.Diagnostics.Process]$process) {
  if (-not $process.WaitForExit(600000)) {
    throw 'Recebido: instalador em execução após 600 s. Esperado: término em até 600 s.'
  }
  return $process.ExitCode
}

function Wait-Removed {
  $deadline = (Get-Date).AddSeconds(60)
  while (((Test-Path -LiteralPath $dir) -or (Test-Path -LiteralPath $key) -or (Test-Path -LiteralPath $shortcut)) -and (Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 500
  }
  Assert-True (-not (Test-Path -LiteralPath $dir)) 'a pasta do app sai em até 60 s'
  Assert-True (-not (Test-Path -LiteralPath $key)) 'a entrada de Aplicativos instalados sai'
  Assert-True (-not (Test-Path -LiteralPath $shortcut)) 'o atalho sai'
}

Assert-CleanAccount
$sandbox = Join-Path ([IO.Path]::GetTempPath()) ('summa-instalador-' + [guid]::NewGuid())
$marker = Join-Path $sandbox 'runtime\prova-do-aluno.txt'
try {
  $env:LEARNING_DESK_RUNTIME = Join-Path $sandbox 'runtime'
  $env:LEARNING_VAULT = Join-Path $sandbox 'vault'
  New-Item -ItemType Directory -Force -Path $env:LEARNING_DESK_RUNTIME, $env:LEARNING_VAULT | Out-Null
  Set-Content -LiteralPath $marker -Value 'dados do aluno'
  $install = Start-Setup $Setup @('/S')
  Assert-True ((Wait-Setup $install) -eq 0) 'o instalador termina sem erro'
  Assert-True (Test-Path -LiteralPath $exe) 'o electron.exe fica na pasta do usuário'
  Assert-True (Test-Path -LiteralPath (Join-Path $dir 'resources\app\main.cjs')) 'o payload fica em resources\app'
  Assert-True (-not (Test-Path -LiteralPath (Join-Path $dir 'resources\app\install-source.json'))) 'a instalação não depende de um clone'
  Assert-True (Test-Path -LiteralPath $shortcut) 'o atalho entra no menu Iniciar'
  Assert-True ((Get-ItemProperty -LiteralPath $key).DisplayName -eq 'Summa') 'a Summa aparece em Aplicativos instalados'

  Start-Process -FilePath $exe | Out-Null
  Wait-Summa 'a Summa abre'
  Start-Sleep -Seconds 20
  Assert-True ((Get-Summa).Count -gt 0) 'a Summa continua aberta depois de 20 s'
  $update = Start-Setup $Setup @('/S', '/UPDATE')
  Start-Sleep -Seconds 8
  Assert-True (-not $update.HasExited) 'o instalador espera a Summa fechar'
  Assert-True (Test-Path -LiteralPath $exe) 'a versão aberta continua inteira durante a espera'
  Stop-Summa
  Assert-True ((Wait-Setup $update) -eq 0) 'a atualização termina sem erro'
  Wait-Summa 'a Summa reabre depois de atualizar'
  foreach ($suffix in @('old', 'new', 'ready')) {
    Assert-True (-not (Test-Path -LiteralPath "$dir.$suffix")) "não sobra Summa.$suffix"
  }

  $locked = Start-Setup $Setup @('/S', '/UPDATE')
  Assert-True ((Wait-Setup $locked) -eq 2) 'a atualização travada informa a falha'
  Assert-True (Test-Path -LiteralPath $exe) 'a versão anterior continua no lugar'
  Assert-True (-not (Test-Path -LiteralPath "$dir.new")) 'a tentativa travada não deixa pasta temporária'
  Assert-True (-not (Test-Path -LiteralPath "$dir.ready")) 'a tentativa travada não deixa o aviso de pronto'
  Assert-True ((Get-Summa).Count -gt 0) 'a Summa continua aberta depois da tentativa travada'
  Stop-Summa

  Start-Process -FilePath $exe | Out-Null
  Wait-Summa 'a Summa abre de novo'
  Start-Sleep -Seconds 5
  $uninstall = Start-Uninstall
  Assert-True ((Wait-Setup $uninstall) -eq 2) 'a desinstalação travada informa a falha'
  Assert-True (Test-Path -LiteralPath $dir) 'a pasta instalada continua no lugar depois da recusa'
  Assert-True (Test-Path -LiteralPath $exe) 'desinstalar com a Summa aberta não apaga a pasta'
  Stop-Summa
  Start-Sleep -Seconds 5
  Assert-True (Test-Path -LiteralPath $dir) 'a recusa não deixa uma remoção pendente ao fechar a Summa'

  Start-Process -FilePath $exe | Out-Null
  Wait-Summa 'a Summa reabre depois da recusa'
  Start-Sleep -Seconds 5
  $uninstall = Start-Uninstall
  Start-Sleep -Seconds 5
  Assert-True (-not $uninstall.HasExited) 'o desinstalador espera a Summa fechar'
  Assert-True (Test-Path -LiteralPath $exe) 'a versão aberta continua inteira durante a desinstalação'
  Stop-Summa
  Assert-True ((Wait-Setup $uninstall) -eq 0) 'a desinstalação termina sem erro'
  Wait-Removed
  Assert-True (-not (Test-Path -LiteralPath "$dir.removing")) 'não sobra pasta da remoção'
  Assert-True (Test-Path -LiteralPath $marker) 'os dados do aluno ficam'
} finally {
  foreach ($process in $processes) {
    if (-not $process.HasExited) { & taskkill.exe /PID $process.Id /T /F | Out-Null }
  }
  Stop-Summa
  if (Test-Path -LiteralPath (Join-Path $dir 'Uninstall Summa.exe')) {
    $cleanup = Start-Uninstall
    Wait-Setup $cleanup | Out-Null
    Wait-Removed
  }
  if (Test-Path -LiteralPath $sandbox) { Remove-Item -LiteralPath $sandbox -Recurse -Force }
  $env:LEARNING_DESK_RUNTIME = $previousRuntime
  $env:LEARNING_VAULT = $previousVault
}
Write-Output 'instalador aprovado'
