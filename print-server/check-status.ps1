# Check for stuck print jobs and printer status
Write-Host "=== Printer Status ===" -ForegroundColor Cyan
Get-WmiObject -Query "SELECT * FROM Win32_Printer WHERE Name='POS-58'" | 
    Format-List Name, PrinterStatus, PrinterState, DetectedErrorState, ExtendedPrinterStatus, WorkOffline, SpoolEnabled

Write-Host ""
Write-Host "=== Print Queue ===" -ForegroundColor Cyan
Get-PrintJob -PrinterName 'POS-58' -ErrorAction SilentlyContinue | 
    Format-Table Id, JobStatus, DocumentName, SubmittedTime, Size -AutoSize

Write-Host ""
Write-Host "=== Printer Port Status ===" -ForegroundColor Cyan
Get-WmiObject -Query "SELECT * FROM Win32_Printer WHERE Name='POS-58'" |
    Select-Object PortName, WorkOffline, SpoolEnabled, PrinterStatus, PrinterState | Format-List

Write-Host ""
Write-Host "=== USB Device Status ===" -ForegroundColor Cyan
Get-WmiObject -Query "SELECT * FROM Win32_USBControllerDevice" | ForEach-Object {
    $dep = [wmi]$_.Dependent
    if ($dep.Name -like '*POS*' -or $dep.Name -like '*058*' -or $dep.PNPDeviceID -like '*0483*') {
        $dep | Format-List Name, PNPDeviceID, Status, StatusInfo, Availability
    }
}

Write-Host ""
Write-Host "=== Try direct file write to USB port ===" -ForegroundColor Cyan
# Try writing directly to the USB port file
try {
    $testBytes = [byte[]](0x1B, 0x40, 0x1B, 0x61, 0x01)  # ESC @ (init) + ESC a 1 (center)
    $testBytes += [System.Text.Encoding]::ASCII.GetBytes("DIRECT USB TEST`n`n`n`n")
    
    # Method: Use .NET file stream to write to printer share path
    $printerPath = "\\.\USB001"
    Write-Host "Trying to write to: $printerPath"
    try {
        $fs = [System.IO.File]::OpenWrite($printerPath)
        $fs.Write($testBytes, 0, $testBytes.Length)
        $fs.Flush()
        $fs.Close()
        Write-Host "Direct USB write succeeded!" -ForegroundColor Green
    } catch {
        Write-Host "Direct USB write failed: $_" -ForegroundColor Yellow
    }
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
