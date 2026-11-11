param(
    [string]$PhpBinary = $env:PHP_BIN,
    [ValidateRange(1024, 65535)][int]$Port = 8080
)

$ErrorActionPreference = 'Stop'
$taskRepoRoot = Split-Path -Parent $PSScriptRoot
$taskEnvFile = Join-Path $taskRepoRoot '.env'

# Load only API settings as literal values; never execute .env or print credentials.
if (Test-Path -LiteralPath $taskEnvFile) {
    $taskAllowedSettings = @('DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'CLIENT_URL', 'APP_ENV', 'ORDER_STORAGE_MODE', 'VNPAY_TMN_CODE', 'VNPAY_HASH_SECRET', 'VNPAY_RETURN_URL', 'BANK_TRANSFER_BIN', 'BANK_TRANSFER_ACCOUNT_NO', 'BANK_TRANSFER_ACCOUNT_NAME', 'CHECKOUT_SHIPPING_VND', 'CHECKOUT_FREE_SHIPPING_MIN_VND', 'STORE_NAME', 'STORE_ADDRESS', 'STORE_PHONE')
    foreach ($taskLine in Get-Content -LiteralPath $taskEnvFile -Encoding UTF8) {
        if ($taskLine -notmatch '^\s*([A-Z_]+)\s*=(.*)$') { continue }
        $taskKey = $Matches[1]
        $taskValue = $Matches[2].Trim()
        if ($taskKey -notin $taskAllowedSettings) { continue }
        if ($taskValue.Length -ge 2 -and (($taskValue.StartsWith('"') -and $taskValue.EndsWith('"')) -or ($taskValue.StartsWith("'") -and $taskValue.EndsWith("'")))) {
            $taskValue = $taskValue.Substring(1, $taskValue.Length - 2)
        }
        [Environment]::SetEnvironmentVariable($taskKey, $taskValue, 'Process')
    }
}

if (!$PhpBinary) {
    $taskPhpCommand = Get-Command php -ErrorAction SilentlyContinue
    if ($taskPhpCommand) { $PhpBinary = $taskPhpCommand.Source }
}
if (!$PhpBinary) {
    throw 'PHP is missing. Install PHP 8.3 CLI or set PHP_BIN to the full path of php.exe.'
}
if (!(Test-Path -LiteralPath $PhpBinary -PathType Leaf)) { throw 'PHP_BIN must point to an existing php.exe.' }

# Portable Windows PHP has no php.ini by default; enable available extensions without editing global configuration.
$taskPhpOptions = @()
$taskExtensionDir = Join-Path (Split-Path -Parent $PhpBinary) 'ext'
if (Test-Path -LiteralPath (Join-Path $taskExtensionDir 'php_pdo_mysql.dll')) {
    $taskLoadedModules = & $PhpBinary -m
    if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect PHP extensions.' }
    $taskPhpOptions += @('-d', "extension_dir=$taskExtensionDir")
    foreach ($taskExtension in @('pdo_mysql', 'fileinfo', 'mbstring', 'gd')) {
        if ($taskExtension -notin $taskLoadedModules -and (Test-Path -LiteralPath (Join-Path $taskExtensionDir "php_$taskExtension.dll"))) {
            $taskPhpOptions += @('-d', "extension=$taskExtension")
        }
    }
}

if (!$env:CLIENT_URL) { $env:CLIENT_URL = 'http://localhost:5173,http://127.0.0.1:5173' }
if (!$env:APP_ENV) { $env:APP_ENV = 'development' }
if (!$env:ORDER_STORAGE_MODE) { $env:ORDER_STORAGE_MODE = 'disabled' }
if (!(Test-Path -LiteralPath $taskEnvFile)) {
    Write-Warning 'No root .env found. Anonymous session checks work; login and real orders need a configured database. See server/db/README.md.'
}
if ($env:DB_HOST -eq 'db') {
    Write-Warning 'DB_HOST=db is a Docker hostname. For native Windows MySQL, set DB_HOST=127.0.0.1 in .env.'
}

# Foreground dev process; Ctrl+C stops only this API, never MySQL or another service.
$taskServerRoot = Join-Path $taskRepoRoot 'server'
Write-Host "HomeCare development API: http://localhost:$Port (Ctrl+C to stop)"
& $PhpBinary @taskPhpOptions -S "localhost:$Port" -t $taskServerRoot (Join-Path $taskServerRoot 'index.php')
if ($LASTEXITCODE -ne 0) { throw "PHP server exited with code $LASTEXITCODE." }
