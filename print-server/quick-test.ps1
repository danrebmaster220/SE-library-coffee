# Quick test - send raw ESC/POS bytes immediately after USB reconnect

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class QP {
    [StructLayout(LayoutKind.Sequential)]
    public struct DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDatatype;
    }
    [DllImport("winspool.drv", EntryPoint="OpenPrinterA", SetLastError=true, CharSet=CharSet.Ansi)]
    public static extern bool OpenPrinter(string s, out IntPtr h, IntPtr p);
    [DllImport("winspool.drv", EntryPoint="ClosePrinter", SetLastError=true)]
    public static extern bool ClosePrinter(IntPtr h);
    [DllImport("winspool.drv", EntryPoint="StartDocPrinterA", SetLastError=true, CharSet=CharSet.Ansi)]
    public static extern int StartDocPrinter(IntPtr h, int l, ref DOCINFOA d);
    [DllImport("winspool.drv", EntryPoint="EndDocPrinter", SetLastError=true)]
    public static extern bool EndDocPrinter(IntPtr h);
    [DllImport("winspool.drv", EntryPoint="StartPagePrinter", SetLastError=true)]
    public static extern bool StartPagePrinter(IntPtr h);
    [DllImport("winspool.drv", EntryPoint="EndPagePrinter", SetLastError=true)]
    public static extern bool EndPagePrinter(IntPtr h);
    [DllImport("winspool.drv", EntryPoint="WritePrinter", SetLastError=true)]
    public static extern bool WritePrinter(IntPtr h, byte[] b, int c, out int w);
}
"@

# Build simple ESC/POS receipt
$ESC = [byte]0x1B
$GS  = [byte]0x1D
$b = New-Object System.Collections.Generic.List[byte]

# INIT printer
$b.Add($ESC); $b.Add([byte][char]'@')

# Center align
$b.Add($ESC); $b.Add([byte][char]'a'); $b.Add([byte]1)

# Bold ON + Double size
$b.Add($ESC); $b.Add([byte][char]'E'); $b.Add([byte]1)
$b.Add($GS); $b.Add([byte][char]'!'); $b.Add([byte]0x30)
$b.AddRange([System.Text.Encoding]::ASCII.GetBytes("THE LIBRARY`n"))

# Normal size
$b.Add($GS); $b.Add([byte][char]'!'); $b.Add([byte]0)
$b.AddRange([System.Text.Encoding]::ASCII.GetBytes("Coffee + Study`n"))
$b.Add($ESC); $b.Add([byte][char]'E'); $b.Add([byte]0)

$b.AddRange([System.Text.Encoding]::ASCII.GetBytes("--------------------------------`n"))

# Left align
$b.Add($ESC); $b.Add([byte][char]'a'); $b.Add([byte]0)
$b.AddRange([System.Text.Encoding]::ASCII.GetBytes("TEST RECEIPT`n"))
$now = Get-Date -Format "MM/dd/yyyy hh:mm tt"
$b.AddRange([System.Text.Encoding]::ASCII.GetBytes("Date: $now`n"))
$b.AddRange([System.Text.Encoding]::ASCII.GetBytes("--------------------------------`n"))

# Center
$b.Add($ESC); $b.Add([byte][char]'a'); $b.Add([byte]1)
$b.AddRange([System.Text.Encoding]::ASCII.GetBytes("Printing works!`n"))
$b.AddRange([System.Text.Encoding]::ASCII.GetBytes("--------------------------------`n"))

# Feed 5 lines
$b.Add($ESC); $b.Add([byte][char]'d'); $b.Add([byte]5)

# Partial cut
$b.Add($GS); $b.Add([byte][char]'V'); $b.Add([byte]1)

$data = $b.ToArray()

Write-Host "Sending $($data.Length) bytes to POS-58..." -ForegroundColor Cyan

[IntPtr]$h = [IntPtr]::Zero
$openOk = [QP]::OpenPrinter("POS-58", [ref]$h, [IntPtr]::Zero)
Write-Host "Open: $openOk"

$di = New-Object QP+DOCINFOA
$di.pDocName = "Receipt"
$di.pDatatype = "RAW"

$doc = [QP]::StartDocPrinter($h, 1, [ref]$di)
Write-Host "StartDoc: $doc"

[QP]::StartPagePrinter($h) | Out-Null

$w = 0
$writeOk = [QP]::WritePrinter($h, $data, $data.Length, [ref]$w)
Write-Host "Write: $writeOk ($w bytes)"

[QP]::EndPagePrinter($h) | Out-Null
[QP]::EndDocPrinter($h) | Out-Null
[QP]::ClosePrinter($h) | Out-Null

Write-Host ""
Write-Host "Done! Check printer!" -ForegroundColor Green
