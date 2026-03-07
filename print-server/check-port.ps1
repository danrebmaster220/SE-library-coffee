Get-PrinterPort | Where-Object { $_.Name -like 'USB*' } | Format-Table Name, Description -AutoSize
Write-Host ""
Get-Printer -Name "POS-58" -ErrorAction SilentlyContinue | Format-List Name, PortName, DriverName, PrinterStatus
