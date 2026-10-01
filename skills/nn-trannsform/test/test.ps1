<# 
  nn-trannsform â€” Test Script
  ===============================
  Run: pwsh -ExecutionPolicy Bypass -File test.ps1
  Requires: Node.js 18+
#>

$ErrorActionPreference = "Stop"
$SKILL_DIR = Resolve-Path "$PSScriptRoot\.."
$TEST_DIR = "$env:TEMP\nn-trannsform-test-$(Get-Random)"
$PASS = 0
$FAIL = 0

function Assert-Equal {
  param($Actual, $Expected, $Message)
  if ($Actual -ne $Expected) {
    Write-Host "  FAIL: $Message" -ForegroundColor Red
    Write-Host "    Expected: $Expected" -ForegroundColor Gray
    Write-Host "    Actual:   $Actual" -ForegroundColor Gray
    $script:FAIL++
  } else {
    Write-Host "  PASS: $Message" -ForegroundColor Green
    $script:PASS++
  }
}

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

Write-Host "+------------------------------------------+" -ForegroundColor Cyan
Write-Host "|  nn-trannsform - Integration Test    |" -ForegroundColor Cyan
Write-Host "+------------------------------------------+" -ForegroundColor Cyan
Write-Host "Skill dir: $SKILL_DIR"
Write-Host "Test dir:  $TEST_DIR"
Write-Host ""

# â”€â”€â”€ Step 1: Directory structure â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Write-Host "-- Step 1: Directory structure --" -ForegroundColor Yellow
Assert-True (Test-Path "$SKILL_DIR\SKILL.md") "SKILL.md exists"
Assert-True (Test-Path "$SKILL_DIR\package.json") "package.json exists"
Assert-True (Test-Path "$SKILL_DIR\scripts\index.js") "scripts/index.js exists"
Assert-True (Test-Path "$SKILL_DIR\scripts\scanner.js") "scripts/scanner.js exists"
Assert-True (Test-Path "$SKILL_DIR\scripts\transformer.js") "scripts/transformer.js exists"
Assert-True (Test-Path "$SKILL_DIR\scripts\config.js") "scripts/config.js exists"
Write-Host ""

# â”€â”€â”€ Step 2: package.json validity â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Write-Host "â”€â”€ Step 2: package.json validity â”€â”€" -ForegroundColor Yellow
$pkg = Get-Content "$SKILL_DIR\package.json" | ConvertFrom-Json
Assert-Equal $pkg.private $true "package.json is private"
Assert-True ($pkg.dependencies.mammoth -ne $null) "dependencies.mammoth declared"
Assert-True ($pkg.dependencies.minimist -ne $null) "dependencies.minimist declared"
Assert-True ($pkg.dependencies.prompts -ne $null) "dependencies.prompts declared"
Assert-True ($pkg.bin -eq $null) "package.json has no bin entry"
# Skills must not auto-execute on `npm install` (the agent runs install automatically).
# Explicit test scripts are fine — they only run on `npm run test*`. Forbid install-time
# lifecycle hooks instead of banning the whole scripts block (see TESTING.md).
$lifecycleHooks = @('preinstall','install','postinstall','preprepare','prepare','postprepare','prepublish','prepublishOnly','prepack','postpack')
$hasLifecycleHook = $false
if ($pkg.scripts) {
  foreach ($hook in $lifecycleHooks) {
    if ($pkg.scripts.PSObject.Properties.Name -contains $hook) { $hasLifecycleHook = $true }
  }
}
Assert-True (-not $hasLifecycleHook) "package.json has no install-time lifecycle scripts"
Write-Host ""

# â”€â”€â”€ Step 3: SKILL.md frontmatter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Write-Host "â”€â”€ Step 3: SKILL.md frontmatter â”€â”€" -ForegroundColor Yellow
$skillContent = Get-Content "$SKILL_DIR\SKILL.md" -Raw
Assert-True ($skillContent -match '^---\nname: nn-trannsform') "SKILL.md name matches directory"
Assert-True ($skillContent -match 'license: MIT') "SKILL.md has MIT license"
Write-Host ""

# â”€â”€â”€ Step 4: npm install â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Write-Host "â”€â”€ Step 4: npm install â”€â”€" -ForegroundColor Yellow
if (Test-Path "$SKILL_DIR\node_modules") {
  Write-Host "  SKIP: node_modules already exists (clean first if you want to retest)" -ForegroundColor DarkYellow
} else {
  Push-Location $SKILL_DIR
  try {
    npm install --loglevel=error 2>&1 | Out-Null
    Assert-True (Test-Path "$SKILL_DIR\node_modules") "node_modules created after npm install"
    Assert-True (Test-Path "$SKILL_DIR\node_modules\mammoth") "mammoth installed"
    Assert-True (Test-Path "$SKILL_DIR\node_modules\minimist") "minimist installed"
    Assert-True (Test-Path "$SKILL_DIR\node_modules\prompts") "prompts installed"
  } finally {
    Pop-Location
  }
}
Write-Host ""

# â”€â”€â”€ Step 5: Bootstrap a test project â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Write-Host "â”€â”€ Step 5: Bootstrap test project â”€â”€" -ForegroundColor Yellow
New-Item -ItemType Directory -Path "$TEST_DIR\source" -Force | Out-Null
@"
# Test Document
Hello world. This is a test.
"@ | Out-File -FilePath "$TEST_DIR\source\hello.txt" -Encoding utf8

Push-Location $SKILL_DIR
try {
  node scripts/index.js --src "$TEST_DIR\source" --dest "$TEST_DIR" --name "test-project" 2>&1 | Out-Null
  Assert-True (Test-Path "$TEST_DIR\test-project") "Project directory created"
  Assert-True (Test-Path "$TEST_DIR\test-project\sources\import") "sources/import/ directory created"
  Assert-True (Test-Path "$TEST_DIR\test-project\sources\nn") "sources/nn/ directory created"
  Assert-True (-not (Test-Path "$TEST_DIR\test-project\sources\raw")) "sources/raw/ directory NOT created"
  Assert-True (Test-Path "$TEST_DIR\test-project\traNNsformations") "traNNsformations/ directory created"
  Assert-True (Test-Path "$TEST_DIR\test-project\models") "models/ directory created"
  Assert-True (Test-Path "$TEST_DIR\test-project\procedures") "procedures/ directory created"
  Assert-True (Test-Path "$TEST_DIR\test-project\export") "export/ directory created"
  Assert-True (Test-Path "$TEST_DIR\test-project\sources\import\hello.txt") "Source file copied to sources/import/"
} finally {
  Pop-Location
}
Write-Host ""

# â”€â”€â”€ Step 6: Run scan â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Write-Host "â”€â”€ Step 6: Run scan â”€â”€" -ForegroundColor Yellow
Push-Location $SKILL_DIR
try {
  node scripts/index.js --scan --src "$TEST_DIR\test-project" 2>&1 | Out-Null
  Assert-True (Test-Path "$TEST_DIR\test-project\sources\nn\index.md") "ingestion manifest created at sources/nn/index.md"
  Assert-True (Test-Path "$TEST_DIR\test-project\index.md") "semantic workspace index.md created"
  Assert-True (Test-Path "$TEST_DIR\test-project\sources\nn\import\hello.md") "hello.md created in sources/nn/import/"

  $provModel = Get-ChildItem "$TEST_DIR\test-project" -Filter "*_NN.md" -Recurse -ErrorAction SilentlyContinue
  Assert-True ($null -ne $provModel) "provenance model (*_workspace_NN.md / *_cogNNitive_NN.md) created"

  $helloContent = Get-Content "$TEST_DIR\test-project\sources\nn\import\hello.md" -Raw
  Assert-True ($helloContent -match 'Hello world') "hello.md contains 'Hello world'"
  Assert-True ($helloContent -match 'source_file: "sources/import/hello.txt"') "hello.md frontmatter has flat source_file field"
  Assert-True ($helloContent -match 'sha256: "[a-f0-9]{64}"') "hello.md frontmatter has sha256 field"
} finally {
  Pop-Location
}
Write-Host ""

# â”€â”€â”€ Step 7: Cleanup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Write-Host "â”€â”€ Step 7: Cleanup â”€â”€" -ForegroundColor Yellow
Remove-Item -Path $TEST_DIR -Recurse -Force -ErrorAction SilentlyContinue
Assert-True (-not (Test-Path $TEST_DIR)) "Test directory cleaned up"
Write-Host ""

# â”€â”€â”€ Results â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Write-Host "+------------------------------------------+" -ForegroundColor Cyan
Write-Host "|  Results                                 |" -ForegroundColor Cyan
Write-Host "+------------------------------------------+" -ForegroundColor Cyan
Write-Host "|  Passed: $($PASS.ToString().PadLeft(3))                           |" -ForegroundColor Green
Write-Host "|  Failed: $($FAIL.ToString().PadLeft(3))                           |" -ForegroundColor $(if ($FAIL -gt 0) { "Red" } else { "Green" })
Write-Host "+------------------------------------------+" -ForegroundColor Cyan

if ($FAIL -gt 0) { exit 1 }
