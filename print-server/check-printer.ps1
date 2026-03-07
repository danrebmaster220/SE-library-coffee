Write-Host "=== PnP Devices (USB/Printer related) ===" -ForegroundColor Cyan
Get-PnpDevice | Where-Object { 
    $_.FriendlyName -like '*POS*' -or 
    $_.FriendlyName -like '*printer*' -or 
    $_.FriendlyName -like '*58*' -or
    $_.FriendlyName -like '*thermal*' -or
    $_.Class -eq 'Printer' -or
    $_.Class -eq 'USB' -and $_.Status -eq 'OK'
} | Format-Table FriendlyName, InstanceId, Status, Class -AutoSize

Write-Host ""
Write-Host "=== USB Devices ===" -ForegroundColor Cyan  
Get-PnpDevice -Class USB -Status OK | Format-Table FriendlyName, InstanceId -AutoSize

Write-Host ""
Write-Host "=== Printer Port ===" -ForegroundColor Cyan
Get-PrinterPort -Name 'USB001' -ErrorAction SilentlyContinue | Format-List *

Write-Host ""
Write-Host "=== Print Jobs ===" -ForegroundColor Cyan
Get-PrintJob -PrinterName 'POS-58' -ErrorAction SilentlyContinue | Format-Table Id, JobStatus, DocumentName, TotalPages -AutoSize

Write-Host ""
Write-Host "=== Printer Driver Details ===" -ForegroundColor Cyan
Get-PrinterDriver -Name 'Generic / Text Only' -ErrorAction SilentlyContinue | Format-List *
