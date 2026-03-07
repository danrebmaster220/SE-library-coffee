# Try to find the actual device path and write directly to it
# Also share the printer so we can use 'net use' and 'copy' methods

Write-Host "=== Computer Name ===" -ForegroundColor Cyan
Write-Host $env:COMPUTERNAME

Write-Host ""
Write-Host "=== Sharing POS-58 printer ===" -ForegroundColor Cyan
try {
    Set-Printer -Name "POS-58" -Shared $true -ShareName "POS58" -ErrorAction Stop
    Write-Host "Printer shared as 'POS58'" -ForegroundColor Green
} catch {
    Write-Host "Could not share: $_" -ForegroundColor Yellow
}

Start-Sleep -Seconds 1

Write-Host ""
Write-Host "=== Method: net use LPT1 ===" -ForegroundColor Cyan
# Map LPT1 to the shared printer
$compName = $env:COMPUTERNAME
& net use LPT1: /delete 2>$null
& net use LPT1: "\\$compName\POS58" 2>&1
Start-Sleep -Seconds 1

# Write to LPT1
$tempFile = "$env:TEMP\pos58_lpt_test.txt"
[System.IO.File]::WriteAllBytes($tempFile, [System.Text.Encoding]::ASCII.GetBytes("LPT1 TEST`r`n`r`n`r`n`r`n"))
& cmd /c "copy /b `"$tempFile`" LPT1:" 2>&1

Write-Host ""
Write-Host "=== Check printer's 'See what's printing' ===" -ForegroundColor Cyan
# Open the print queue window
Write-Host "Opening print queue window..."
& rundll32 printui.dll,PrintUIEntry /o /n "POS-58"

Write-Host ""
Write-Host "=== Send a Windows test page ===" -ForegroundColor Cyan
Write-Host "Sending Windows test page to POS-58..."
# This sends the standard Windows printer test page
$printer = Get-WmiObject -Query "SELECT * FROM Win32_Printer WHERE Name='POS-58'"
$result = $printer.PrintTestPage()
Write-Host "Test page result: ReturnValue = $($result.ReturnValue)"
Write-Host "(0 = success, any other = failure)"
