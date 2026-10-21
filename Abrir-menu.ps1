$ErrorActionPreference = 'Stop'
$menuUrl = 'http://127.0.0.1:4173'
$menuRunning = $false
try {
    $menuResponse = Invoke-WebRequest -Uri $menuUrl -UseBasicParsing -TimeoutSec 2
    $menuRunning = $menuResponse.Content -match 'Crash of the Titans'
} catch {}
if (-not $menuRunning) {
    $menuNode = (Get-Command node -ErrorAction Stop).Source
    $menuScript = Join-Path $PSScriptRoot 'serve.mjs'
    Start-Process -FilePath $menuNode -ArgumentList @('"' + $menuScript + '"') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden
    for ($menuAttempt = 0; $menuAttempt -lt 20; $menuAttempt++) {
        Start-Sleep -Milliseconds 200
        try {
            $menuResponse = Invoke-WebRequest -Uri $menuUrl -UseBasicParsing -TimeoutSec 1
            if ($menuResponse.Content -match 'Crash of the Titans') { $menuRunning = $true; break }
        } catch {}
    }
    if (-not $menuRunning) { throw 'O servidor não iniciou. Verifique se a porta 4173 está ocupada.' }
}
Start-Process $menuUrl
