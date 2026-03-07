# Fix: Configure POS-58 to use RAW datatype instead of NT EMF (GDI)
# This is the key issue - "Generic / Text Only" with default settings sends GDI
# Thermal printers need RAW data

Write-Host "=== Configuring POS-58 for RAW printing ===" -ForegroundColor Cyan

# Step 1: Remove existing printer
Write-Host "[1] Removing current POS-58 configuration..." -ForegroundColor Yellow
Get-PrintJob -PrinterName 'POS-58' -ErrorAction SilentlyContinue | Remove-PrintJob -ErrorAction SilentlyContinue
Remove-Printer -Name "POS-58" -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Write-Host "  Done."

# Step 2: Restart spooler clean
Write-Host "[2] Restarting spooler..." -ForegroundColor Yellow
Stop-Service -Name "Spooler" -Force
Start-Sleep -Seconds 2
Remove-Item -Path "$env:SystemRoot\System32\spool\PRINTERS\*" -Force -ErrorAction SilentlyContinue
Start-Service -Name "Spooler"
Start-Sleep -Seconds 3
Write-Host "  Done."

# Step 3: Re-add printer
Write-Host "[3] Adding POS-58 printer..." -ForegroundColor Yellow
Add-Printer -Name "POS-58" -DriverName "Generic / Text Only" -PortName "USB001"
Start-Sleep -Seconds 2
Write-Host "  Done."

# Step 4: Set default datatype to RAW
Write-Host "[4] Setting default datatype to RAW..." -ForegroundColor Yellow
$regPath = "HKLM:\SYSTEM\CurrentControlSet\Control\Print\Printers\POS-58"
if (Test-Path $regPath) {
    Set-ItemProperty -Path $regPath -Name "Datatype" -Value "RAW"
    Write-Host "  Set Datatype = RAW" -ForegroundColor Green
    
    # Also set attributes to direct printing (skip spooler rendering)
    # PRINTER_ATTRIBUTE_DIRECT = 0x00000002
    $currentAttrs = (Get-ItemProperty -Path $regPath -Name "Attributes").Attributes
    $newAttrs = $currentAttrs -bor 0x00000002  # Add DIRECT flag
    Set-ItemProperty -Path $regPath -Name "Attributes" -Value $newAttrs
    Write-Host "  Set DIRECT printing flag" -ForegroundColor Green
    Write-Host "  Attributes: $currentAttrs -> $newAttrs"
} else {
    Write-Host "  WARNING: Registry path not found" -ForegroundColor Red
}

# Step 5: Restart spooler to apply
Write-Host "[5] Restarting spooler to apply changes..." -ForegroundColor Yellow
Restart-Service -Name "Spooler" -Force
Start-Sleep -Seconds 3
Write-Host "  Done."

# Step 6: Set as default printer
Write-Host "[6] Setting as default printer..." -ForegroundColor Yellow
$wmiPrinter = Get-WmiObject -Query "SELECT * FROM Win32_Printer WHERE Name='POS-58'"
$wmiPrinter.SetDefaultPrinter() | Out-Null
Write-Host "  Done."

# Verify
Write-Host ""
Write-Host "=== Verification ===" -ForegroundColor Cyan
$p = Get-Printer -Name "POS-58"
Write-Host "  Name: $($p.Name)"
Write-Host "  Driver: $($p.DriverName)"
Write-Host "  Port: $($p.PortName)"
Write-Host "  Status: $($p.PrinterStatus)"

$regDatatype = (Get-ItemProperty -Path $regPath -Name "Datatype" -ErrorAction SilentlyContinue).Datatype
$regAttrs = (Get-ItemProperty -Path $regPath -Name "Attributes" -ErrorAction SilentlyContinue).Attributes
Write-Host "  Datatype: $regDatatype"
Write-Host "  Attributes: $regAttrs (2=DIRECT)"

Write-Host ""
Write-Host "=== Sending test print ===" -ForegroundColor Cyan

# Now send RAW text directly - this should work with DIRECT + RAW datatype
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class RawPrn {
    [StructLayout(LayoutKind.Sequential)]
    public struct DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDatatype;
    }
    [DllImport("winspool.drv", EntryPoint="OpenPrinterA", SetLastError=true, CharSet=CharSet.Ansi)]
    public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);
    [DllImport("winspool.drv", EntryPoint="ClosePrinter", SetLastError=true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", EntryPoint="StartDocPrinterA", SetLastError=true, CharSet=CharSet.Ansi)]
    public static extern int StartDocPrinter(IntPtr hPrinter, int level, ref DOCINFOA di);
    [DllImport("winspool.drv", EntryPoint="EndDocPrinter", SetLastError=true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", EntryPoint="StartPagePrinter", SetLastError=true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", EntryPoint="EndPagePrinter", SetLastError=true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", EntryPoint="WritePrinter", SetLastError=true)]
    public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int dwCount, out int dwWritten);
}
"@

$ESC = [byte]0x1B
$GS  = [byte]0x1D

$bytes = New-Object System.Collections.Generic.List[byte]

# INIT
$bytes.Add($ESC); $bytes.Add([byte][char]'@')

# Center
$bytes.Add($ESC); $bytes.Add([byte][char]'a'); $bytes.Add([byte]1)

# Bold + Double
$bytes.Add($ESC); $bytes.Add([byte][char]'E'); $bytes.Add([byte]1)
$bytes.Add($GS); $bytes.Add([byte][char]'!'); $bytes.Add([byte]0x30)

$bytes.AddRange([System.Text.Encoding]::ASCII.GetBytes("THE LIBRARY`n"))

# Normal
$bytes.Add($GS); $bytes.Add([byte][char]'!'); $bytes.Add([byte]0)
$bytes.AddRange([System.Text.Encoding]::ASCII.GetBytes("Coffee + Study`n"))
$bytes.Add($ESC); $bytes.Add([byte][char]'E'); $bytes.Add([byte]0)

$bytes.AddRange([System.Text.Encoding]::ASCII.GetBytes("--------------------------------`n"))

# Left
$bytes.Add($ESC); $bytes.Add([byte][char]'a'); $bytes.Add([byte]0)
$bytes.AddRange([System.Text.Encoding]::ASCII.GetBytes("PRINTER TEST`n"))
$bytes.AddRange([System.Text.Encoding]::ASCII.GetBytes("Date: $(Get-Date -Format 'MM/dd/yyyy hh:mm tt')`n"))
$bytes.AddRange([System.Text.Encoding]::ASCII.GetBytes("Status: ONLINE`n"))
$bytes.AddRange([System.Text.Encoding]::ASCII.GetBytes("Mode: RAW + DIRECT`n"))
$bytes.AddRange([System.Text.Encoding]::ASCII.GetBytes("--------------------------------`n"))

# Center
$bytes.Add($ESC); $bytes.Add([byte][char]'a'); $bytes.Add([byte]1)
$bytes.AddRange([System.Text.Encoding]::ASCII.GetBytes("If you can read this`n"))
$bytes.AddRange([System.Text.Encoding]::ASCII.GetBytes("printing works!`n"))

# Feed + Cut
$bytes.Add($ESC); $bytes.Add([byte][char]'d'); $bytes.Add([byte]4)
$bytes.Add($GS); $bytes.Add([byte][char]'V'); $bytes.Add([byte]1)

$data = $bytes.ToArray()
Write-Host "Sending $($data.Length) raw bytes..."

[IntPtr]$hPrinter = [IntPtr]::Zero
[RawPrn]::OpenPrinter("POS-58", [ref]$hPrinter, [IntPtr]::Zero) | Out-Null

$di = New-Object RawPrn+DOCINFOA
$di.pDocName = "Test Receipt"
$di.pDatatype = "RAW"

$docId = [RawPrn]::StartDocPrinter($hPrinter, 1, [ref]$di)
Write-Host "  StartDoc: $docId"

[RawPrn]::StartPagePrinter($hPrinter) | Out-Null

$written = 0
$ok = [RawPrn]::WritePrinter($hPrinter, $data, $data.Length, [ref]$written)
Write-Host "  WritePrinter: $ok, bytes: $written/$($data.Length)"

if (-not $ok) {
    $err = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
    Write-Host "  Win32 Error: $err" -ForegroundColor Red
}

[RawPrn]::EndPagePrinter($hPrinter) | Out-Null
[RawPrn]::EndDocPrinter($hPrinter) | Out-Null
[RawPrn]::ClosePrinter($hPrinter) | Out-Null

Write-Host ""
Write-Host "CHECK YOUR PRINTER NOW!" -ForegroundColor Green
Write-Host "If nothing printed, the USB communication may be broken." -ForegroundColor Yellow
Write-Host "Try: Unplug USB cable, wait 10 seconds, plug back in, run this again." -ForegroundColor Yellow
