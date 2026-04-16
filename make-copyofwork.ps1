$repo = "E:\SHAYK\BSIT 3 - C\SYSTEM\library-coffee"
$out  = "E:\2ND SEMESTER\IT Elective 4\copyright\SPAVION Copyright\Source of Work - Class N.txt"

Set-Location $repo
if (Test-Path $out) { Remove-Item $out -Force }

$files = git ls-files

foreach ($f in $files) {
  $p = $f -replace '\\','/'

  if ($p -match '(^|/)(mariadb|test-cases|node_modules|dist|build|\.expo|temp|backend/data|backend/temp)(/|$)') { continue }
  if ($p -ieq 'MIGRATION_READINESS_TIDB_TO_RAILWAY.md') { continue }
  if ($p -match '(^|/)\.env($|\.)') { continue }
  if ($p -match '\.(pem|key|p12|pfx|jks|png|jpe?g|gif|webp|ico|pdf|zip|rar|exe|dll|bin)$') { continue }

  Add-Content -Path $out -Value ""
  Add-Content -Path $out -Value ("===== FILE: " + $p + " =====")
  Get-Content -Path $f | Add-Content -Path $out
}

Write-Host "DONE"
Write-Host $out
