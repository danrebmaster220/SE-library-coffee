# Set POS-58 as default and print using different methods

Write-Host "=== Setting POS-58 as Default Printer ===" -ForegroundColor Cyan
$printer = Get-WmiObject -Query "SELECT * FROM Win32_Printer WHERE Name='POS-58'"
$printer.SetDefaultPrinter() | Out-Null
Write-Host "Default printer set to POS-58"

Start-Sleep -Seconds 1

# Verify
$default = Get-WmiObject -Query "SELECT * FROM Win32_Printer WHERE Default=True"
Write-Host "Confirmed default: $($default.Name)"

Write-Host ""
Write-Host "=== Method: Notepad /p (prints to default printer) ===" -ForegroundColor Cyan
$testFile = "e:\SHAYK\BSIT 3 - C\SYSTEM\library-coffee\print-server\notepad-test.txt"
Start-Process -FilePath "notepad.exe" -ArgumentList "/p `"$testFile`"" -Wait -NoNewWindow
Write-Host "Notepad print completed"

Write-Host ""
Write-Host "=== Check print queue now ===" -ForegroundColor Cyan
Get-PrintJob -PrinterName 'POS-58' -ErrorAction SilentlyContinue | Format-Table Id, JobStatus, DocumentName, SubmittedTime, Size -AutoSize
Write-Host "(If empty, jobs were processed but printer may not be responding)"

Write-Host ""
Write-Host "=== Printer error state ===" -ForegroundColor Cyan
$p = Get-WmiObject -Query "SELECT * FROM Win32_Printer WHERE Name='POS-58'"
Write-Host "Status: $($p.PrinterStatus)"
Write-Host "State: $($p.PrinterState)"
Write-Host "DetectedErrorState: $($p.DetectedErrorState)"
Write-Host "ExtendedDetectedErrorState: $($p.ExtendedDetectedErrorState)"
Write-Host "ExtendedPrinterStatus: $($p.ExtendedPrinterStatus)"
Write-Host ""
Write-Host "Status meanings: 1=Other, 2=Unknown, 3=Idle, 4=Printing, 5=Warmup"
Write-Host "ErrorState: 0=Unknown, 1=Other, 2=No Error, 3=Low Paper, 4=No Paper, 5=Low Toner"
