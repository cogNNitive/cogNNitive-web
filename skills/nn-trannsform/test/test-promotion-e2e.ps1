<#
  nn-trannsform — Conversation Promotion E2E
  =========================================
  Run: pwsh -ExecutionPolicy Bypass -File test-promotion-e2e.ps1
  Requires: Node.js 18+

  Verifies the retired-`_summary.md` promotion contract end to end:
    - promoting with --format full writes only <slug>_source.md
    - no <slug>_summary.md is ever produced
    - PROMOTION_OPTIONS is exactly [full], [none]
#>

$ErrorActionPreference = "Stop"
$SKILL_DIR = Resolve-Path "$PSScriptRoot\.."
$TEST_DIR = "$env:TEMP\nn-trannsform-promo-e2e-$(Get-Random)"
$PASS = 0
$FAIL = 0

function Assert-True {
  param($Condition, $Message)
  if (-not $Condition) {
    Write-Host "  FAIL: $Message" -ForegroundColor Red
    $script:FAIL++
  } else {
    Write-Host "  PASS: $Message" -ForegroundColor Green
    $script:PASS++
  }
}

Write-Host "nn-trannsform - Promotion E2E" -ForegroundColor Cyan
Write-Host "Test dir: $TEST_DIR"

try {
  $convDir = Join-Path $TEST_DIR "conversations"
  New-Item -ItemType Directory -Force -Path $convDir | Out-Null
  $session = Join-Path $convDir "2026-09-07_promo-e2e.md"
  Set-Content -Path $session -Value "# Session`nTurn one.`nTurn two." -Encoding utf8

  # --- promote full ---
  $idx = Join-Path $SKILL_DIR "scripts/index.js"
  & node $idx --src $TEST_DIR --promote-conv "conversations/2026-09-07_promo-e2e.md" --format full --slug "promo-e2e" | Out-Null
  Assert-True ($LASTEXITCODE -eq 0) "CLI --promote-conv --format full exits 0"

  $sourceFile = Join-Path $TEST_DIR "sources/conversations/promo-e2e_source.md"
  $summaryFile = Join-Path $TEST_DIR "sources/conversations/promo-e2e_summary.md"
  Assert-True (Test-Path $sourceFile) "_source.md transcript is written"
  Assert-True (-not (Test-Path $summaryFile)) "no _summary.md is written"

  # --- PROMOTION_OPTIONS contract ---
  $optJson = & node -e "process.stdout.write(JSON.stringify(require('$($SKILL_DIR -replace '\\','/')/scripts/lib/conversations.js').PROMOTION_OPTIONS.map(o=>o.value)))"
  Assert-True ($optJson -eq '["full","none"]') "PROMOTION_OPTIONS is exactly [full, none] (got $optJson)"
}
finally {
  if (Test-Path $TEST_DIR) { Remove-Item -Recurse -Force $TEST_DIR }
}

Write-Host ""
Write-Host "Result: $PASS passed, $FAIL failed" -ForegroundColor $(if ($FAIL -eq 0) { "Green" } else { "Red" })
if ($FAIL -gt 0) { exit 1 }
