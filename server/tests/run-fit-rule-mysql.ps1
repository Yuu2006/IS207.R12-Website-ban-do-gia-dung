# Run from repo root: powershell -File server/tests/run-fit-rule-mysql.ps1
# Creates a temporary MySQL container only; never uses project Compose volumes.
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$name = 'is207-fit-rule-test-' + ([guid]::NewGuid().ToString('N').Substring(0, 8))
$password = 'fit_test_only'
$created = $false
$files = @(
  'database/schema_database.sql',
  'server/db/migrations/008_product_attributes.sql',
  'server/db/migrations/009_product_attribute_values.sql',
  'server/db/migrations/012_decision_tools.sql',
  'server/tests/fit-rule-existing.sql',
  'server/db/migrations/013_fit_rule_versions.sql'
)

try {
  docker run -d --rm --name $name -e "MYSQL_ROOT_PASSWORD=$password" -e MYSQL_DATABASE=fit_rule_isolated mysql:8.4 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Could not create MySQL test container.' }
  $created = $true
  $ready = $false
  for ($attempt = 0; $attempt -lt 45; $attempt++) {
    try { docker exec -e "MYSQL_PWD=$password" $name mysql -uroot fit_rule_isolated -e 'SELECT 1' 2>$null | Out-Null } catch { }
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 1
  }
  if (-not $ready) { throw 'MySQL test was not ready.' }
  foreach ($file in $files) {
    $source = Join-Path $repo $file
    Write-Host "Apply $file"
    docker cp $source "${name}:/tmp/fit-import.sql" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Could not copy $file" }
    docker exec -e "MYSQL_PWD=$password" $name sh -c 'mysql -uroot fit_rule_isolated < /tmp/fit-import.sql'
    if ($LASTEXITCODE -ne 0) { throw "Migration failed at $file" }
  }
  $server = Join-Path $repo 'server'
  docker run --rm --network "container:$name" --mount "type=bind,source=$server,target=/app,readonly" -e DB_HOST=127.0.0.1 -e DB_NAME=fit_rule_isolated -e DB_USER=root -e "DB_PASSWORD=$password" --entrypoint php is207r12-website-ban-do-gia-dung-api:latest /app/tests/fit-rule-integration.php
  if ($LASTEXITCODE -ne 0) { throw 'FitRule integration test failed.' }
} finally {
  if ($created) { docker rm -f $name | Out-Null }
}
