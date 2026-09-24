param(
    [Parameter(Mandatory=$true)][string]$ExcelPath,
    [switch]$Apply
)
$ErrorActionPreference = 'Stop'
$runtime = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
if (-not (Test-Path -LiteralPath $runtime)) {
    $runtime = (Get-Command python -ErrorAction Stop).Source
}
$syncArgs = @((Join-Path $PSScriptRoot 'sync-products.py'), (Resolve-Path -LiteralPath $ExcelPath).Path)
if ($Apply) { $syncArgs += '--apply' }
& $runtime @syncArgs
exit $LASTEXITCODE
