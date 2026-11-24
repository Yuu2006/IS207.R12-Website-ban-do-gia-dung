param([switch]$HttpDemo)
$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
Push-Location $projectDirectory
try {
    # These commands never migrate the shared DB; the MySQL runner owns its private containers.
    function Invoke-Checked([string]$Command, [string[]]$Arguments) {
        & $Command @Arguments
        if ($LASTEXITCODE -ne 0) { throw "Failed: $Command $($Arguments -join ' ')" }
    }
    Invoke-Checked 'python' @('scripts/check-tco-reference.py')
    Invoke-Checked 'npm.cmd' @('test', '--prefix', 'client')
    Invoke-Checked 'npm.cmd' @('run', 'build', '--prefix', 'client')
    Invoke-Checked 'node' @('server/tests/run-order-mysql-tests.mjs', '--docker')
    if ($HttpDemo) { Invoke-Checked 'node' @('scripts/test-week4-http.mjs') }
    Write-Host 'PASS: week 4 regression. Review manual browser checks and external Sandbox/team sign-off separately.'
} finally { Pop-Location }
