# Fix POS-58 "Use Printer Offline" status

Write-Host "=== Fixing POS-58 Offline Status ===" -ForegroundColor Cyan

# Step 1: Clear all stuck jobs
Write-Host "[1] Clearing stuck print jobs..." -ForegroundColor Yellow
Get-PrintJob -PrinterName 'POS-58' -ErrorAction SilentlyContinue | Remove-PrintJob -ErrorAction SilentlyContinue
Write-Host "  Done."

# Step 2: Stop spooler, clear spool folder, restart
Write-Host "[2] Clearing spooler..." -ForegroundColor Yellow
Stop-Service -Name "Spooler" -Force
Start-Sleep -Seconds 2
Remove-Item -Path "$env:SystemRoot\System32\spool\PRINTERS\*" -Force -ErrorAction SilentlyContinue
Start-Service -Name "Spooler"
Start-Sleep -Seconds 3
Write-Host "  Spooler restarted."

# Step 3: Set printer ONLINE using WMI
Write-Host "[3] Setting POS-58 to ONLINE..." -ForegroundColor Yellow
$wmiPrinter = Get-WmiObject -Query "SELECT * FROM Win32_Printer WHERE Name='POS-58'"
if ($wmiPrinter) {
    Write-Host "  Current WorkOffline: $($wmiPrinter.WorkOffline)"
    if ($wmiPrinter.WorkOffline) {
        $wmiPrinter.WorkOffline = $false
        $wmiPrinter.Put() | Out-Null
        Write-Host "  Set WorkOffline to FALSE" -ForegroundColor Green
    }
}

# Step 4: Also use registry to make sure OFFLINE bit is cleared
Write-Host "[4] Clearing offline flag in registry..." -ForegroundColor Yellow
$regPath = "HKLM:\SYSTEM\CurrentControlSet\Control\Print\Printers\POS-58"
if (Test-Path $regPath) {
    $attrs = Get-ItemProperty -Path $regPath -Name "Attributes" -ErrorAction SilentlyContinue
    if ($attrs) {
        $currentAttrs = $attrs.Attributes
        # Bit 0x00000400 = PRINTER_ATTRIBUTE_WORK_OFFLINE
        $offlineBit = 0x00000400
        if ($currentAttrs -band $offlineBit) {
            $newAttrs = $currentAttrs -bxor $offlineBit
            Set-ItemProperty -Path $regPath -Name "Attributes" -Value $newAttrs
            Write-Host "  Cleared offline bit in registry" -ForegroundColor Green
        } else {
            Write-Host "  Offline bit was not set in registry"
        }
        Write-Host "  Attributes: $currentAttrs -> $(Get-ItemProperty -Path $regPath -Name 'Attributes' | Select-Object -ExpandProperty Attributes)"
    }
}

# Step 5: Restart spooler again after registry change
Write-Host "[5] Restarting spooler after registry fix..." -ForegroundColor Yellow
Restart-Service -Name "Spooler" -Force
Start-Sleep -Seconds 3
Write-Host "  Done."

# Step 6: Verify status
Write-Host ""
Write-Host "=== Verification ===" -ForegroundColor Cyan
$p = Get-WmiObject -Query "SELECT * FROM Win32_Printer WHERE Name='POS-58'"
Write-Host "  Name: $($p.Name)"
Write-Host "  WorkOffline: $($p.WorkOffline)"
Write-Host "  PrinterStatus: $($p.PrinterStatus) (3=Idle, 2=Unknown)"
Write-Host "  PrinterState: $($p.PrinterState)"

$p2 = Get-Printer -Name "POS-58"
Write-Host "  PrinterStatus (Get-Printer): $($p2.PrinterStatus)"

Write-Host ""
if ($p.WorkOffline -eq $false -and $p2.PrinterStatus -eq 'Normal') {
    Write-Host "  PRINTER IS ONLINE!" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Sending test print..." -ForegroundColor Yellow
    
    # Send a simple test
    $testFile = "$env:TEMP\pos58_online_test.txt"
    Set-Content -Path $testFile -Value "HELLO POS-58!`r`nPrinter is ONLINE`r`nTest successful!`r`n`r`n`r`n`r`n" -Encoding ASCII
    
    # Print using Out-Printer
    Get-Content -Path $testFile -Raw | Out-Printer -Name "POS-58"
    Write-Host "  Test print sent! Check printer." -ForegroundColor Green
} else {
    Write-Host "  WARNING: Printer may still be offline" -ForegroundColor Red
    Write-Host "  Try: Right-click POS-58 in print queue > uncheck 'Use Printer Offline'" -ForegroundColor Yellow
}
