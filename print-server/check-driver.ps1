# Check the actual USB driver for the POS-58 hardware device
Write-Host "=== Driver for POS-58 USB Device ===" -ForegroundColor Cyan

# Get the device and its driver info
$device = Get-PnpDevice | Where-Object { $_.InstanceId -like '*VID_0483&PID_5743*' }
if ($device) {
    Write-Host "Device found: $($device.FriendlyName)"
    Write-Host "InstanceId: $($device.InstanceId)"
    Write-Host "Class: $($device.Class)"
    Write-Host "Status: $($device.Status)"
    
    Write-Host ""
    Write-Host "=== Driver details ===" -ForegroundColor Cyan
    Get-PnpDeviceProperty -InstanceId $device.InstanceId | Where-Object {
        $_.KeyName -like '*Driver*' -or 
        $_.KeyName -like '*Service*' -or
        $_.KeyName -like '*Inf*' -or
        $_.KeyName -like '*Manufacturer*' -or
        $_.KeyName -like '*Class*'
    } | Format-Table KeyName, Data -AutoSize
}

Write-Host ""
Write-Host "=== USBPRINT device driver ===" -ForegroundColor Cyan
$usbPrint = Get-PnpDevice | Where-Object { $_.InstanceId -like '*USBPRINT*POS*' }
if ($usbPrint) {
    Write-Host "USBPRINT Device: $($usbPrint.FriendlyName)"
    Write-Host "Class: $($usbPrint.Class)"
    
    Get-PnpDeviceProperty -InstanceId $usbPrint.InstanceId | Where-Object {
        $_.KeyName -like '*Driver*' -or 
        $_.KeyName -like '*Service*' -or
        $_.KeyName -like '*Inf*'
    } | Format-Table KeyName, Data -AutoSize
}

Write-Host ""
Write-Host "=== Check if WinUSB or libusb is installed ===" -ForegroundColor Cyan
Get-PnpDevice | Where-Object { 
    ($_.InstanceId -like '*VID_0483*') -and ($_.Class -eq 'USBDevice' -or $_.Class -eq 'libusb' -or $_.Class -eq 'libusbK')
} | Format-Table FriendlyName, Class, InstanceId, Status -AutoSize

# Also check service name
Write-Host ""
Write-Host "=== Service name for USB device ===" -ForegroundColor Cyan
$allPOS = Get-PnpDevice | Where-Object { $_.FriendlyName -like '*POS*' }
foreach ($d in $allPOS) {
    Write-Host "--- $($d.FriendlyName) ($($d.InstanceId)) ---"
    $svcProp = Get-PnpDeviceProperty -InstanceId $d.InstanceId -KeyName 'DEVPKEY_Device_Service' -ErrorAction SilentlyContinue
    if ($svcProp) {
        Write-Host "  Service: $($svcProp.Data)"
    }
    $drvProp = Get-PnpDeviceProperty -InstanceId $d.InstanceId -KeyName 'DEVPKEY_Device_DriverInfPath' -ErrorAction SilentlyContinue
    if ($drvProp) {
        Write-Host "  INF: $($drvProp.Data)"
    }
}
