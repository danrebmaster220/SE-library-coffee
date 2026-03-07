# FIX: Remove and re-add the POS-58 printer to fix the broken USB port mapping

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  POS-58 Printer Fix Script" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Clear stuck print jobs
Write-Host "[1/5] Clearing stuck print jobs..." -ForegroundColor Yellow
Get-PrintJob -PrinterName 'POS-58' -ErrorAction SilentlyContinue | Remove-PrintJob -ErrorAction SilentlyContinue
Write-Host "  Done." -ForegroundColor Green

# Step 2: Remove the broken printer
Write-Host "[2/5] Removing broken POS-58 printer..." -ForegroundColor Yellow
Remove-Printer -Name "POS-58" -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Write-Host "  Done." -ForegroundColor Green

# Step 3: Restart spooler
Write-Host "[3/5] Restarting Print Spooler service..." -ForegroundColor Yellow
Restart-Service -Name "Spooler" -Force
Start-Sleep -Seconds 3
Write-Host "  Done." -ForegroundColor Green

# Step 4: Find the correct USB port for the printer
Write-Host "[4/5] Looking for POS-58 USB port..." -ForegroundColor Yellow
$usbPorts = Get-PrinterPort | Where-Object { $_.Name -like 'USB*' }
Write-Host "  Found USB ports:"
$usbPorts | ForEach-Object { Write-Host "    - $($_.Name): $($_.Description)" }

# Identify the right port
$targetPort = $null
foreach ($port in $usbPorts) {
    if ($port.Description -like '*POS*' -or $port.Name -eq 'USB001') {
        $targetPort = $port.Name
        break
    }
}

if (-not $targetPort -and $usbPorts.Count -gt 0) {
    $targetPort = $usbPorts[0].Name
}

if (-not $targetPort) {
    Write-Host ""
    Write-Host "  ERROR: No USB printer port found!" -ForegroundColor Red
    Write-Host "  Try: Unplug POS-58 USB cable, wait 5 sec, plug it back in" -ForegroundColor Red
    Write-Host "  Then run this script again." -ForegroundColor Red
    exit 1
}

Write-Host "  Using port: $targetPort" -ForegroundColor Green

# Step 5: Re-add the printer with the correct port
Write-Host "[5/5] Adding POS-58 printer on port $targetPort..." -ForegroundColor Yellow
Add-Printer -Name "POS-58" -DriverName "Generic / Text Only" -PortName $targetPort
Start-Sleep -Seconds 2
Write-Host "  Done." -ForegroundColor Green

# Verify
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Verification" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
$p = Get-Printer -Name "POS-58" -ErrorAction SilentlyContinue
if ($p) {
    Write-Host "  Printer: $($p.Name)" -ForegroundColor Green
    Write-Host "  Driver:  $($p.DriverName)" -ForegroundColor Green
    Write-Host "  Port:    $($p.PortName)" -ForegroundColor Green
    Write-Host "  Status:  $($p.PrinterStatus)" -ForegroundColor Green
} else {
    Write-Host "  ERROR: Printer was not re-added!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  NEXT STEPS:" -ForegroundColor Cyan  
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  1. Make sure POS-58 is ON and has paper" -ForegroundColor White
Write-Host "  2. Run the test print:" -ForegroundColor White
Write-Host "     notepad /p notepad-test.txt" -ForegroundColor Gray
Write-Host ""
Write-Host "  If it still doesn't print, try:" -ForegroundColor Yellow
Write-Host "     - Unplug USB, wait 10 sec, replug" -ForegroundColor Yellow
Write-Host "     - Then run this script again" -ForegroundColor Yellow
