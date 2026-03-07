# Ultra-simple test: Just send plain ASCII text, no ESC/POS commands
# If this doesn't print, the problem is hardware/connection

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class SimplePrint {
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

$printerName = "POS-58"
[IntPtr]$hPrinter = [IntPtr]::Zero

Write-Host "Opening printer '$printerName'..."
$ok = [SimplePrint]::OpenPrinter($printerName, [ref]$hPrinter, [IntPtr]::Zero)
Write-Host "OpenPrinter: $ok (Handle: $hPrinter)"

$di = New-Object SimplePrint+DOCINFOA
$di.pDocName = "Simple Test"
$di.pDatatype = "RAW"

$docId = [SimplePrint]::StartDocPrinter($hPrinter, 1, [ref]$di)
Write-Host "StartDocPrinter: $docId"

$spOk = [SimplePrint]::StartPagePrinter($hPrinter)
Write-Host "StartPagePrinter: $spOk"

# Just send plain text with newlines - absolute minimum
$text = "Hello POS-58!`r`nThis is a test.`r`n`r`n`r`n`r`n`r`n"
$textBytes = [System.Text.Encoding]::ASCII.GetBytes($text)
Write-Host "Sending $($textBytes.Length) bytes of plain text..."

$written = 0
$wpOk = [SimplePrint]::WritePrinter($hPrinter, $textBytes, $textBytes.Length, [ref]$written)
Write-Host "WritePrinter: $wpOk, written: $written"

[SimplePrint]::EndPagePrinter($hPrinter)
[SimplePrint]::EndDocPrinter($hPrinter)
[SimplePrint]::ClosePrinter($hPrinter)

Write-Host ""
Write-Host "Done. If nothing printed, try:" -ForegroundColor Yellow
Write-Host "  1. Turn printer OFF and ON" -ForegroundColor Yellow
Write-Host "  2. Check if paper is loaded and cover is closed" -ForegroundColor Yellow
Write-Host "  3. Unplug USB and replug" -ForegroundColor Yellow
Write-Host "  4. Open 'Devices and Printers' > right-click POS-58 > 'See what's printing'" -ForegroundColor Yellow
Write-Host "     Check if jobs are stuck in the queue" -ForegroundColor Yellow

# Also try a second method - copy to printer port
Write-Host ""
Write-Host "=== Method 2: Trying 'copy' to printer ===" -ForegroundColor Cyan
$tempFile = "$env:TEMP\pos58test.txt"
Set-Content -Path $tempFile -Value "Hello from copy method!`r`n`r`n`r`n`r`n" -Encoding ASCII
Write-Host "Running: copy /b $tempFile \\%COMPUTERNAME%\POS-58"
$env:PRINTER_FILE = $tempFile
Start-Process -FilePath "cmd.exe" -ArgumentList "/c copy /b `"$tempFile`" `"\\$env:COMPUTERNAME\POS-58`"" -Wait -NoNewWindow
Write-Host "Copy command completed."

# Method 3: .NET System.IO.Ports - try to find the COM port
Write-Host ""
Write-Host "=== Method 3: Check for COM ports ===" -ForegroundColor Cyan
$ports = [System.IO.Ports.SerialPort]::GetPortNames()
Write-Host "Available COM ports: $($ports -join ', ')"
if ($ports.Count -eq 0) {
    Write-Host "No COM ports found (printer is USB, not serial)"
}
