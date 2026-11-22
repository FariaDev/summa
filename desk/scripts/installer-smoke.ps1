# Prova do instalador numa conta do Windows (#119): instala, abre, atualiza com a
# Summa aberta, recusa a troca enquanto ela não fecha e desinstala sem tocar nos
# dados do aluno. Roda no workflow Instalador do Windows e na VM de teste.
param([Parameter(Mandatory = $true)][string]$Setup)
$ErrorActionPreference = 'Stop'

$dir = Join-Path $env:LOCALAPPDATA 'Programs\Summa'
$exe = Join-Path $dir 'electron.exe'
$key = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Summa'
$shortcut = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Summa.lnk'
$data = Join-Path $env:APPDATA 'Mesa de Estudos'
$marker = Join-Path $data 'prova-do-instalador.txt'
$env:LEARNING_DESK_RUNTIME = Join-Path $env:TEMP 'summa-instalador-prova'

function Assert-True([bool]$condition, [string]$what) {
  if (-not $condition) { throw "falhou: $what" }
  Write-Output "ok: $what"
}

function Get-Summa {
  @(Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.StartsWith("$dir\", [StringComparison]::OrdinalIgnoreCase) })
}

function Stop-Summa {
  Get-Summa | Stop-Process -Force -ErrorAction SilentlyContinue
  $deadline = (Get-Date).AddSeconds(30)
  while ((Get-Summa).Count -gt 0 -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 500 }
}

function Wait-Summa([string]$what) {
  $deadline = (Get-Date).AddSeconds(60)
  while ((Get-Summa).Count -eq 0 -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 500 }
  Assert-True ((Get-Summa).Count -gt 0) $what
}

New-Item -ItemType Directory -Force -Path $data | Out-Null
Set-Content -LiteralPath $marker -Value 'dados do aluno'

# Instalação nova, sem nenhuma pergunta.
$install = Start-Process -FilePath $Setup -ArgumentList '/S' -PassThru -Wait
Assert-True ($install.ExitCode -eq 0) 'o instalador termina sem erro'
Assert-True (Test-Path -LiteralPath $exe) 'o electron.exe fica na pasta do usuário'
Assert-True (Test-Path -LiteralPath (Join-Path $dir 'resources\app\main.cjs')) 'o payload fica em resources\app'
Assert-True (-not (Test-Path -LiteralPath (Join-Path $dir 'resources\app\install-source.json'))) 'a instalação não depende de um clone'
Assert-True (Test-Path -LiteralPath $shortcut) 'o atalho entra no menu Iniciar'
Assert-True ((Get-ItemProperty -LiteralPath $key).DisplayName -eq 'Summa') 'a Summa aparece em Aplicativos instalados'

# A Summa abre e continua de pé.
Start-Process -FilePath $exe | Out-Null
Wait-Summa 'a Summa abre'
Start-Sleep -Seconds 20
Assert-True ((Get-Summa).Count -gt 0) 'a Summa continua aberta depois de 20 s'

# Atualizar com a Summa aberta: o instalador espera ela fechar e reabre sozinho.
$update = Start-Process -FilePath $Setup -ArgumentList '/S', '/UPDATE' -PassThru
Start-Sleep -Seconds 8
Assert-True (-not $update.HasExited) 'o instalador espera a Summa fechar'
Assert-True (Test-Path -LiteralPath $exe) 'a versão aberta continua inteira durante a espera'
Stop-Summa
$update.WaitForExit()
Assert-True ($update.ExitCode -eq 0) 'a atualização termina sem erro'
Wait-Summa 'a Summa reabre depois de atualizar'
Assert-True (-not (Test-Path -LiteralPath "$dir.old")) 'a versão anterior sai depois da troca'
Assert-True (-not (Test-Path -LiteralPath "$dir.new")) 'não sobra pasta temporária'
Assert-True (-not (Test-Path -LiteralPath "$dir.ready")) 'não sobra o aviso de pronto'

# Se a Summa nunca fechar, a versão anterior fica no lugar e continua aberta.
$locked = Start-Process -FilePath $Setup -ArgumentList '/S', '/UPDATE' -PassThru
$locked.WaitForExit()
Assert-True ($locked.ExitCode -eq 2) 'a atualização travada informa a falha'
Assert-True (Test-Path -LiteralPath $exe) 'a versão anterior continua no lugar'
Assert-True (-not (Test-Path -LiteralPath "$dir.new")) 'a tentativa travada não deixa pasta temporária'
Assert-True (-not (Test-Path -LiteralPath "$dir.ready")) 'a tentativa travada não deixa o aviso de pronto'
Assert-True ((Get-Summa).Count -gt 0) 'a Summa continua aberta depois da tentativa travada'
Stop-Summa

# Desinstalar com a Summa aberta é recusado e não apaga nada.
Start-Process -FilePath $exe | Out-Null
Wait-Summa 'a Summa abre de novo'
Start-Sleep -Seconds 5
Start-Process -FilePath (Join-Path $dir 'Uninstall Summa.exe') -ArgumentList '/S' -Wait
Start-Sleep -Seconds 10
Assert-True (Test-Path -LiteralPath $exe) 'desinstalar com a Summa aberta não apaga a pasta'
Stop-Summa

# Desinstalar remove o app e mantém os dados do aluno.
Start-Process -FilePath (Join-Path $dir 'Uninstall Summa.exe') -ArgumentList '/S' -Wait
$deadline = (Get-Date).AddSeconds(60)
while ((Test-Path -LiteralPath $dir) -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 500 }
Start-Sleep -Seconds 3
Assert-True (-not (Test-Path -LiteralPath $dir)) 'a pasta do app sai'
Assert-True (-not (Test-Path -LiteralPath "$dir.removing")) 'não sobra pasta da remoção'
Assert-True (-not (Test-Path -LiteralPath $shortcut)) 'o atalho sai'
Assert-True (-not (Test-Path -LiteralPath $key)) 'a entrada de Aplicativos instalados sai'
Assert-True (Test-Path -LiteralPath $marker) 'os dados do aluno ficam'
Remove-Item -LiteralPath $marker -Force
Write-Output 'instalador aprovado'
