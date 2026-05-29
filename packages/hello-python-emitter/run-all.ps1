#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Runs the hello-python-emitter once per renderer, writing each renderer's
  output into its own sibling directory under test/.

.EXAMPLE
  # default: build first, then emit all four renderers
  ./run-all.ps1

.EXAMPLE
  # skip the tsc build (useful for repeated runs)
  ./run-all.ps1 -SkipBuild

.EXAMPLE
  # just one renderer
  ./run-all.ps1 -Renderer alloy
#>
[CmdletBinding()]
param(
  [ValidateSet("alloy", "string", "template", "ef-mix", "all")]
  [string[]] $Renderer = @("alloy", "string", "template", "ef-mix"),
  [switch] $SkipBuild,
  [string] $Sample = "test/sample.tsp",
  [string] $OutputRoot = "test"
)

$ErrorActionPreference = "Stop"
$packageDir = Split-Path -Parent $PSCommandPath
Push-Location $packageDir
try {
  if (-not $SkipBuild) {
    Write-Host "==> tsc -p ." -ForegroundColor Cyan
    & npx tsc -p .
    if ($LASTEXITCODE -ne 0) { throw "tsc failed" }
  }

  $tspCli = Resolve-Path "../compiler/cmd/tsp.js"

  foreach ($r in $Renderer) {
    $outDir = Join-Path $OutputRoot "tsp-output-$r"
    if (Test-Path $outDir) { Remove-Item -Recurse -Force $outDir }

    Write-Host "==> renderer = $r  →  $outDir" -ForegroundColor Cyan
    & node $tspCli compile $Sample `
      --emit "@typespec/hello-python-emitter" `
      --option "@typespec/hello-python-emitter.renderer=$r" `
      --output-dir $outDir
    if ($LASTEXITCODE -ne 0) { throw "tsp compile failed for renderer=$r" }
  }

  Write-Host ""
  Write-Host "Done. Outputs:" -ForegroundColor Green
  foreach ($r in $Renderer) {
    $p = Join-Path $OutputRoot "tsp-output-$r\@typespec\hello-python-emitter"
    Write-Host "  $r`t→ $p"
  }
}
finally {
  Pop-Location
}
